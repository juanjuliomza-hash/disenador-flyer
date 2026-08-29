/* =====================================================================
   stage.js — motor de dibujo (Konva)
   ---------------------------------------------------------------------
   UN SOLO RENDERER. Lo que se ve en pantalla y lo que se exporta salen
   de los mismos nodos, así que no pueden desincronizarse. Ese era el bug
   del texto corrido 14 px en el PNG.
   ===================================================================== */

import { EMOJI_FONT } from "./presets.js";

const MIN_SIZE = 4;
const SNAP_TOL = 6;          // px de escena
const GUIDE_COLOR = "#f472b6";

/* ---------------- caché de imágenes ---------------- */
const imgCache = new Map();
export function loadImage(src){
  if (!src) return Promise.reject(new Error("sin src"));
  if (!imgCache.has(src)){
    imgCache.set(src, new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("No se pudo cargar la imagen"));
      im.src = src;
    }));
  }
  return imgCache.get(src);
}
export function preloadScene(scene){
  const jobs = [];
  if (scene.bg.type === "image" && scene.bg.src) jobs.push(loadImage(scene.bg.src).catch(() => {}));
  for (const el of scene.elements){
    if (el.type === "image" && el.data.src) jobs.push(loadImage(el.data.src).catch(() => {}));
  }
  return Promise.all(jobs);
}

function fontFamily(name){
  if (name === "Segoe UI Emoji") return EMOJI_FONT;
  return `"${name}", "Segoe UI", Arial, sans-serif`;
}
function fontStyle(d){
  const parts = [];
  if (d.italic) parts.push("italic");
  parts.push(d.weight >= 700 ? "bold" : "normal");
  return parts.join(" ");
}

/* ===================================================================== */
export class StageView {
  constructor(container, store){
    this.store = store;
    this.container = container;
    this.tool = "select";
    this.nodes = new Map();          // id → Konva.Group
    this.spacePan = false;
    this.snapEnabled = true;
    this.onCreate = null;            // callback(tipo, x, y)
    this.onView = null;              // callback tras zoom/paneo
    this._dragStart = null;

    this.stage = new Konva.Stage({ container, width: 100, height: 100 });
    this.bgLayer = new Konva.Layer({ listening: false });
    this.mainLayer = new Konva.Layer();
    this.uiLayer = new Konva.Layer();
    this.stage.add(this.bgLayer, this.mainLayer, this.uiLayer);

    this.tr = new Konva.Transformer({
      rotateEnabled: true,
      keepRatio: false,
      ignoreStroke: true,
      padding: 2,
      anchorSize: 9,
      anchorStroke: "#22d3ee",
      anchorFill: "#0b1017",
      anchorCornerRadius: 2,
      borderStroke: "#22d3ee",
      borderStrokeWidth: 1.5,
      rotateAnchorOffset: 26,
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE) return oldBox;
        return newBox;
      }
    });
    this.uiLayer.add(this.tr);

    this.guides = new Konva.Group({ listening: false });
    this.uiLayer.add(this.guides);

    this.marquee = new Konva.Rect({
      fill: "rgba(34,211,238,0.12)", stroke: "#22d3ee", strokeWidth: 1,
      visible: false, listening: false
    });
    this.uiLayer.add(this.marquee);

    this._wire();
  }

  /* ---------------- construcción de nodos ---------------- */
  buildBackground(){
    this.bgLayer.destroyChildren();
    const s = this.store.scene;
    const b = s.bg;
    const rect = new Konva.Rect({ x: 0, y: 0, width: s.w, height: s.h });
    if (b.type === "gradient"){
      const a = (b.angle || 0) * Math.PI / 180;
      const dx = Math.cos(a) * s.w, dy = Math.sin(a) * s.h;
      rect.fillLinearGradientStartPoint({ x: s.w / 2 - dx / 2, y: s.h / 2 - dy / 2 });
      rect.fillLinearGradientEndPoint({ x: s.w / 2 + dx / 2, y: s.h / 2 + dy / 2 });
      rect.fillLinearGradientColorStops([0, b.c1, 1, b.c2]);
    } else if (b.type === "image" && b.src){
      rect.fill("#ffffff");
      const im = imgCache.get(b.src);
      if (im && im.then){
        im.then(img => {
          const sc = Math.max(s.w / img.width, s.h / img.height);
          rect.fillPatternImage(img);
          rect.fillPatternScale({ x: sc, y: sc });
          rect.fillPatternOffset({
            x: (img.width - s.w / sc) / 2,
            y: (img.height - s.h / sc) / 2
          });
          this.bgLayer.batchDraw();
        }).catch(() => {});
      }
    } else {
      rect.fill(b.c1 || "#ffffff");
    }
    this.bgLayer.add(rect);
    this.bgLayer.batchDraw();
  }

  /* Contenido interno del grupo, redibujado cuando cambia el tamaño */
  layoutGroup(group, el){
    group.destroyChildren();

    /* caja de impacto: hace que el click funcione en toda el área y que el
       bounding box del grupo sea exactamente w×h */
    group.add(new Konva.Rect({
      x: 0, y: 0, width: el.w, height: el.h,
      fill: "rgba(0,0,0,0.001)", name: "hit"
    }));

    const d = el.data;
    if (el.type === "text"){
      if (d.bg){
        group.add(new Konva.Rect({
          x: 0, y: 0, width: el.w, height: el.h,
          fill: d.bg, cornerRadius: 6
        }));
      }
      const pad = d.bgpad || 0;
      /* Konva parte por caracteres las "palabras" que no entran en el ancho, y
         eso rompe los pares sustitutos (un emoji queda partido al medio y sale
         como tofu). Para textos de una sola pieza corta desactivamos el corte. */
      const puntos = [...d.text];
      const piezaUnica = !/\s/.test(d.text) && puntos.length <= 4;
      group.add(new Konva.Text({
        x: pad, y: pad,
        width: Math.max(1, el.w - pad * 2),
        height: Math.max(1, el.h - pad * 2),
        text: d.text,
        fontFamily: fontFamily(d.font),
        fontSize: d.size,
        fontStyle: fontStyle(d),
        textDecoration: d.underline ? "underline" : "",
        fill: d.color,
        align: d.align,
        verticalAlign: d.valign,        // ← el control que faltaba
        lineHeight: d.lh,
        letterSpacing: d.ls,
        wrap: piezaUnica ? "none" : "word",
        listening: false
      }));
    } else if (el.type === "image"){
      const p = imgCache.get(d.src);
      const node = new Konva.Image({
        x: 0, y: 0, width: el.w, height: el.h,
        cornerRadius: d.radius || 0,
        stroke: d.border || undefined,
        strokeWidth: d.border ? (d.bw || 0) : 0,
        listening: false
      });
      group.add(node);
      if (p && p.then){
        p.then(img => {
          node.image(img);
          applyFit(node, img, el);
          this.mainLayer.batchDraw();
        }).catch(() => {});
      }
    } else if (el.type === "rect"){
      group.add(new Konva.Rect({
        x: 0, y: 0, width: el.w, height: el.h,
        fill: d.fill || undefined,
        stroke: d.stroke || undefined,
        strokeWidth: d.stroke ? (d.sw || 0) : 0,
        cornerRadius: d.radius || 0,
        listening: false
      }));
    } else if (el.type === "ellipse"){
      group.add(new Konva.Ellipse({
        x: el.w / 2, y: el.h / 2,
        radiusX: Math.max(0.5, el.w / 2), radiusY: Math.max(0.5, el.h / 2),
        fill: d.fill || undefined,
        stroke: d.stroke || undefined,
        strokeWidth: d.stroke ? (d.sw || 0) : 0,
        listening: false
      }));
    } else if (el.type === "line"){
      group.add(new Konva.Line({
        points: [0, 0, el.w, el.h],
        stroke: d.stroke || "#000",
        strokeWidth: d.sw || 1,
        lineCap: "round",
        listening: false
      }));
    }

    /* efectos */
    const fx = el.fx || {};
    if (fx.shadow){
      group.getChildren().forEach(n => {
        if (n.name() === "hit") return;
        n.shadowColor(fx.shadowColor);
        n.shadowBlur(fx.shadowBlur);
        n.shadowOffset({ x: fx.shadowX, y: fx.shadowY });
        n.shadowOpacity(fx.shadowOpacity);
      });
    }
    group.globalCompositeOperation(
      fx.blend && fx.blend !== "normal" ? fx.blend : null
    );
  }

  buildElement(el){
    const group = new Konva.Group({
      id: el.id,
      x: el.x + el.w / 2,
      y: el.y + el.h / 2,
      offsetX: el.w / 2,
      offsetY: el.h / 2,
      rotation: el.rot || 0,
      opacity: el.opacity,
      visible: el.visible,
      draggable: !el.locked,
      listening: !el.locked
    });
    this.layoutGroup(group, el);
    this._wireNode(group, el);
    return group;
  }

  /* Redibuja todo desde la escena */
  render(){
    const scene = this.store.scene;
    this.stage.width(this.container.clientWidth);
    this.stage.height(this.container.clientHeight);
    this.buildBackground();
    this.mainLayer.destroyChildren();
    this.nodes.clear();
    for (const el of scene.elements){
      const g = this.buildElement(el);
      this.nodes.set(el.id, g);
      this.mainLayer.add(g);
    }
    this.mainLayer.batchDraw();
    this.syncTransformer();
  }

  /* Actualiza sin reconstruir (para arrastres) */
  syncNode(el){
    const g = this.nodes.get(el.id);
    if (!g) return;
    g.position({ x: el.x + el.w / 2, y: el.y + el.h / 2 });
    g.offset({ x: el.w / 2, y: el.h / 2 });
    g.rotation(el.rot || 0);
    g.opacity(el.opacity);
    g.visible(el.visible);
    g.draggable(!el.locked);
    g.listening(!el.locked);
    this.layoutGroup(g, el);
    this.mainLayer.batchDraw();
  }

  syncTransformer(){
    const sel = this.store.sel
      .map(id => this.nodes.get(id))
      .filter(n => n && n.visible() && n.draggable());
    this.tr.nodes(sel);
    this.uiLayer.batchDraw();
  }

  /* ---------------- zoom / paneo ---------------- */
  setView(zoom, x, y){
    this.stage.scale({ x: zoom, y: zoom });
    this.stage.position({ x, y });
    this.stage.batchDraw();
  }
  get zoom(){ return this.stage.scaleX(); }

  fit(){
    const s = this.store.scene;
    const vw = this.container.clientWidth - 64;
    const vh = this.container.clientHeight - 64;
    const z = Math.max(0.02, Math.min(vw / s.w, vh / s.h, 3));
    this.setView(z,
      (this.container.clientWidth - s.w * z) / 2,
      (this.container.clientHeight - s.h * z) / 2);
    return z;
  }
  zoomTo(z, cx, cy){
    const old = this.zoom;
    const nz = Math.min(8, Math.max(0.05, z));
    const px = cx ?? this.container.clientWidth / 2;
    const py = cy ?? this.container.clientHeight / 2;
    const pos = this.stage.position();
    const wx = (px - pos.x) / old, wy = (py - pos.y) / old;
    this.setView(nz, px - wx * nz, py - wy * nz);
    return nz;
  }

  resize(){
    this.stage.width(this.container.clientWidth);
    this.stage.height(this.container.clientHeight);
    this.stage.batchDraw();
  }

  /* ---------------- guías de alineación ---------------- */
  /* Destinos de alineación, separados en dos niveles.
     El lienzo (bordes, centro y márgenes) tiene PRIORIDAD sobre los elementos:
     con una escena densa, si no, todo queda "cerca de algo" y el imán no sirve.
     De los elementos solo cuentan los que además se solapan en el otro eje,
     que es cuando la guía significa algo visualmente. */
  _snapTargets(exceptIds, el){
    const s = this.store.scene;
    const M = 70;                                  // margen de la plantilla
    const canvasV = [0, M, s.w / 2, s.w - M, s.w];
    const canvasH = [0, M, s.h / 2, s.h - M, s.h];
    const elV = [], elH = [];
    for (const o of s.elements){
      if (exceptIds.includes(o.id) || !o.visible) continue;
      const solapaY = o.y < el.y + el.h && o.y + o.h > el.y;
      const solapaX = o.x < el.x + el.w && o.x + o.w > el.x;
      if (solapaY) elV.push(o.x, o.x + o.w / 2, o.x + o.w);
      if (solapaX) elH.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    return { canvasV, canvasH, elV, elH };
  }

  _applySnap(el, ids){
    const { canvasV, canvasH, elV, elH } = this._snapTargets(ids, el);
    const tol = SNAP_TOL / this.zoom;
    const lines = [];
    const bordes = (p, w) => [{ p, o: 0 }, { p: p + w / 2, o: w / 2 }, { p: p + w, o: w }];

    const mejor = (mios, targets) => {
      let best = null;
      for (const m of mios){
        for (const t of targets){
          const d = Math.abs(m.p - t);
          if (d < tol && (!best || d < best.d)) best = { d, t, o: m.o };
        }
      }
      return best;
    };

    const misV = bordes(el.x, el.w), misH = bordes(el.y, el.h);
    const bestV = mejor(misV, canvasV) || mejor(misV, elV);
    const bestH = mejor(misH, canvasH) || mejor(misH, elH);

    if (bestV){ el.x = bestV.t - bestV.o; lines.push({ vertical: true, at: bestV.t }); }
    if (bestH){ el.y = bestH.t - bestH.o; lines.push({ vertical: false, at: bestH.t }); }
    return lines;
  }

  _drawGuides(lines){
    this.guides.destroyChildren();
    const s = this.store.scene;
    for (const l of lines){
      this.guides.add(new Konva.Line({
        points: l.vertical ? [l.at, -4000, l.at, 4000] : [-4000, l.at, 4000, l.at],
        stroke: GUIDE_COLOR,
        strokeWidth: 1 / this.zoom,
        dash: [4 / this.zoom, 4 / this.zoom],
        listening: false
      }));
    }
    this.uiLayer.batchDraw();
  }
  clearGuides(){ this.guides.destroyChildren(); this.uiLayer.batchDraw(); }

  /* ---------------- eventos por nodo ---------------- */
  _wireNode(group, el){
    const store = this.store;

    group.on("dragstart", () => {
      if (!store.sel.includes(el.id)) store.select(store.expandGroup(el.id));
      store.begin();
      /* posiciones de partida de todo lo seleccionado, para el arrastre múltiple */
      this._dragStart = new Map();
      for (const e of store.selected) this._dragStart.set(e.id, { x: e.x, y: e.y });
      this._dragAnchor = { x: el.x, y: el.y };
    });

    group.on("dragmove", () => {
      const e = store.byId(el.id);
      if (!e || !this._dragStart) return;
      e.x = group.x() - e.w / 2;
      e.y = group.y() - e.h / 2;
      const lines = this.snapEnabled ? this._applySnap(e, store.sel) : [];
      group.position({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

      /* el resto de la selección acompaña con el mismo delta */
      const dx = e.x - this._dragAnchor.x;
      const dy = e.y - this._dragAnchor.y;
      for (const other of store.selected){
        if (other.id === el.id) continue;
        const s0 = this._dragStart.get(other.id);
        if (!s0) continue;
        other.x = s0.x + dx;
        other.y = s0.y + dy;
        const g = this.nodes.get(other.id);
        if (g) g.position({ x: other.x + other.w / 2, y: other.y + other.h / 2 });
      }
      this._drawGuides(lines);
      this.mainLayer.batchDraw();
      store.touch();
    });

    group.on("dragend", () => {
      this.clearGuides();
      this._dragStart = null;
      store.end("mover");
    });

    /* Redimensionado: se normaliza en vivo (patrón oficial de Konva) para
       que el texto no se estire mientras arrastrás. */
    group.on("transformstart", () => store.begin());
    group.on("transform", () => {
      const e = store.byId(el.id);
      if (!e) return;
      const sx = group.scaleX(), sy = group.scaleY();
      const w = Math.max(MIN_SIZE, e.w * Math.abs(sx));
      const h = Math.max(MIN_SIZE, e.h * Math.abs(sy));
      const cx = group.x(), cy = group.y();
      e.w = w; e.h = h;
      e.rot = group.rotation();
      group.scale({ x: 1, y: 1 });
      group.offset({ x: w / 2, y: h / 2 });
      group.position({ x: cx, y: cy });
      e.x = cx - w / 2;
      e.y = cy - h / 2;
      this.layoutGroup(group, e);
      store.touch();
    });
    group.on("transformend", () => store.end("redimensionar"));
  }

  /* ---------------- eventos del stage ---------------- */
  _wire(){
    const store = this.store;
    const stage = this.stage;

    stage.on("mousedown touchstart", ev => {
      const isEmpty = ev.target === stage || ev.target.getLayer() === this.bgLayer;

      /* paneo: herramienta H, barra espaciadora o botón del medio */
      if (this.tool === "pan" || this.spacePan || ev.evt.button === 1){
        this._startPan(ev);
        ev.evt.preventDefault();
        return;
      }

      if (!isEmpty){
        const group = ev.target.findAncestor("Group", true);
        if (group && group.id()){
          const ids = store.expandGroup(group.id());
          const additive = ev.evt.shiftKey || ev.evt.ctrlKey || ev.evt.metaKey;
          if (additive) store.select(ids, { additive: true });
          else if (!store.sel.includes(group.id())) store.select(ids);
        }
        return;
      }

      /* clic en vacío con una herramienta de creación */
      if (this.tool !== "select" && this.tool !== "marquee"){
        const p = this._scenePoint();
        if (this.onCreate) this.onCreate(this.tool, p.x, p.y);
        return;
      }

      /* marquee / deseleccionar */
      store.clearSelection();
      this._startMarquee();
    });

    /* rueda: Ctrl = zoom, si no = paneo (convención de herramientas de diseño) */
    this.container.addEventListener("wheel", e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey){
        const rect = this.container.getBoundingClientRect();
        this.zoomTo(this.zoom * Math.exp(-e.deltaY * 0.0015),
          e.clientX - rect.left, e.clientY - rect.top);
        this.onView && this.onView();
      } else {
        const pos = stage.position();
        if (e.shiftKey) stage.position({ x: pos.x - e.deltaY, y: pos.y });
        else stage.position({ x: pos.x - e.deltaX, y: pos.y - e.deltaY });
        stage.batchDraw();
      }
    }, { passive: false });
  }

  _scenePoint(){
    const p = this.stage.getPointerPosition();
    const pos = this.stage.position();
    const z = this.zoom;
    return { x: (p.x - pos.x) / z, y: (p.y - pos.y) / z };
  }

  _startPan(){
    const stage = this.stage;
    const start = stage.getPointerPosition();
    const origin = stage.position();
    const move = () => {
      const p = stage.getPointerPosition();
      if (!p) return;
      stage.position({ x: origin.x + (p.x - start.x), y: origin.y + (p.y - start.y) });
      stage.batchDraw();
    };
    const up = () => {
      stage.off("mousemove.pan touchmove.pan");
      window.removeEventListener("mouseup", up);
      this.onView && this.onView();
    };
    stage.on("mousemove.pan touchmove.pan", move);
    window.addEventListener("mouseup", up);
  }

  _startMarquee(){
    const store = this.store;
    const startPt = this._scenePoint();
    this.marquee.setAttrs({ x: startPt.x, y: startPt.y, width: 0, height: 0, visible: true });
    const move = () => {
      const p = this._scenePoint();
      this.marquee.setAttrs({
        x: Math.min(startPt.x, p.x), y: Math.min(startPt.y, p.y),
        width: Math.abs(p.x - startPt.x), height: Math.abs(p.y - startPt.y)
      });
      this.uiLayer.batchDraw();
    };
    const up = () => {
      this.stage.off("mousemove.mq");
      window.removeEventListener("mouseup", up);
      const box = this.marquee.getClientRect({ relativeTo: this.mainLayer });
      this.marquee.visible(false);
      this.uiLayer.batchDraw();
      if (box.width < 3 && box.height < 3) return;
      const hits = store.scene.elements.filter(el =>
        el.visible && !el.locked &&
        el.x < box.x + box.width && el.x + el.w > box.x &&
        el.y < box.y + box.height && el.y + el.h > box.y
      ).map(el => el.id);
      if (hits.length) store.select(hits);
    };
    this.stage.on("mousemove.mq", move);
    window.addEventListener("mouseup", up);
  }

  /* ---------------------------------------------------------------------
     Exportación: usa EXACTAMENTE los mismos nodos que la pantalla.
     Se apaga la capa de UI, se lleva el stage a escala 1 y se recorta el
     lienzo. Por construcción, no puede diferir de lo que ves.
     --------------------------------------------------------------------- */
  async snapshot({ pixelRatio = 1, mimeType = "image/png", quality = 0.92, transparent = false } = {}){
    const s = this.store.scene;
    const prevScale = this.stage.scale();
    const prevPos = this.stage.position();
    const prevW = this.stage.width(), prevH = this.stage.height();
    const uiVisible = this.uiLayer.visible();
    const bgVisible = this.bgLayer.visible();

    this.uiLayer.visible(false);
    if (transparent) this.bgLayer.visible(false);
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.stage.width(s.w);
    this.stage.height(s.h);
    this.stage.draw();

    let out;
    try {
      out = await this.stage.toBlob({
        pixelRatio, mimeType, quality,
        x: 0, y: 0, width: s.w, height: s.h
      });
    } finally {
      this.uiLayer.visible(uiVisible);
      this.bgLayer.visible(bgVisible);
      this.stage.scale(prevScale);
      this.stage.position(prevPos);
      this.stage.width(prevW);
      this.stage.height(prevH);
      this.stage.draw();
    }
    return out;
  }
}

/* Ajuste cover/contain de una imagen dentro de su caja */
function applyFit(node, img, el){
  const fit = el.data.fit || "cover";
  if (fit === "cover"){
    const sc = Math.max(el.w / img.width, el.h / img.height);
    const cw = el.w / sc, ch = el.h / sc;
    node.crop({ x: (img.width - cw) / 2, y: (img.height - ch) / 2, width: cw, height: ch });
    node.size({ width: el.w, height: el.h });
    node.position({ x: 0, y: 0 });
  } else {
    const sc = Math.min(el.w / img.width, el.h / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    node.crop(null);
    node.size({ width: dw, height: dh });
    node.position({ x: (el.w - dw) / 2, y: (el.h - dh) / 2 });
  }
}
