/* =====================================================================
   main.js — arranque y cableado de la interfaz
   ===================================================================== */

import { Store, slug } from "./store.js";
import { StageView, preloadScene, loadImage } from "./stage.js";
import { TEMPLATES, wolfITTemplate, LOGO_SRC } from "./templates.js";
import { CANVAS_PRESETS, TYPE_PRESETS, applyTypePreset, BRAND, FONTS, BLEND_MODES } from "./presets.js";
import { defaultData } from "./schema.js";
import { readImageFile, fitBox } from "./assets.js";
import { exportImage, copyToClipboard, printSheet, saveProjectFile, exportName, FORMATS } from "./exporter.js";

const $ = id => document.getElementById(id);
const store = new Store();
let view = null;
let toastTimer = null;
let exportOpts = { format: "png", scale: 2, transparent: false };

/* ---------------- utilidades de interfaz ---------------- */
function toast(msg, bad){
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("bad", !!bad);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), bad ? 5000 : 2600);
}

const TYPE_LABEL = { text: "Texto", image: "Imagen", rect: "Rect", ellipse: "Elipse", line: "Línea" };

/* =====================================================================
   ARRANQUE
   ===================================================================== */
async function boot(){
  if (typeof Konva === "undefined"){
    document.body.innerHTML =
      '<p style="padding:40px;font:15px system-ui;color:#e5e7eb">' +
      'No se pudo cargar <code>vendor/konva.min.js</code>.<br><br>' +
      'Este editor necesita abrirse con un servidor local (no con doble clic).<br>' +
      'Ejecutá <code>abrir.bat</code> o <code>python -m http.server 8900</code> en la carpeta del proyecto.</p>';
    return;
  }

  fillStaticControls();

  const saved = await store.restoreAutosave();
  store.load(saved || wolfITTemplate());

  view = new StageView($("viewport"), store);
  view.onCreate = onCanvasCreate;
  view.onView = () => updateStatus();

  await preloadScene(store.scene);
  view.render();
  view.fit();

  bindStore();
  bindToolbar();
  bindPanels();
  bindKeyboard();
  buildAssets();
  buildPalette();
  buildTypePresets();

  syncAll();
  toast(saved ? "Borrador recuperado" : "Listo: editá el flyer de WOLF IT 🐺");

  window.addEventListener("resize", () => { view.resize(); updateStatus(); });

  /* El primer fit() puede correr antes de que el layout tenga ancho real
     (el lienzo quedaría en 2%). Se reajusta en cuanto el viewport mide algo. */
  let ajustado = $("viewport").clientWidth > 0;
  new ResizeObserver(() => {
    view.resize();
    if (!ajustado && $("viewport").clientWidth > 0){
      ajustado = true;
      view.fit();
    }
    updateStatus();
  }).observe($("viewport"));

  /* Puente para el control por texto/audio: permite que la consola (o un
     agente) inspeccione y edite la escena sin tocar la interfaz. */
  window.flyer = {
    store, view,
    get scene(){ return store.scene; },
    load: raw => { store.tx("carga externa", () => store.load(raw, { resetHistory: false })); },
    apply: fn => store.tx("cambio externo", () => fn(store.scene)),
    refresh: () => { preloadScene(store.scene).then(() => { view.render(); syncAll(); }); }
  };
}

function fillStaticControls(){
  const tpl = $("tpl-sel");
  TEMPLATES.forEach((t, i) => tpl.add(new Option(t.name, String(i))));

  const preset = $("p-preset");
  CANVAS_PRESETS.forEach(p => preset.add(new Option(p.label, p.id)));
  preset.add(new Option("Personalizado…", "custom"));

  const font = $("p-font");
  FONTS.forEach(f => font.add(new Option(f === "Segoe UI Emoji" ? "Emoji" : f, f)));

  const blend = $("fx-blend");
  BLEND_MODES.forEach(b => blend.add(new Option(b.label, b.id)));
}

/* =====================================================================
   EVENTOS DEL STORE
   ===================================================================== */
function bindStore(){
  store.addEventListener("load", () => {
    preloadScene(store.scene).then(() => { view.render(); view.syncTransformer(); });
    view.render();
  });
  store.addEventListener("change", () => { syncPanels(); syncLayers(); updateStatus(); });
  store.addEventListener("selection", () => { view.syncTransformer(); syncPanels(); syncLayers(); updateStatus(); });
  store.addEventListener("saved", () => setSaveState("ok"));
  store.addEventListener("saveerror", e => {
    setSaveState("warn");
    toast("No se pudo autoguardar. Guardá una copia con 💾", true);
    console.warn(e.detail && e.detail.error);
  });
  store.addEventListener("warn", e => toast(e.detail.message, true));
  store.addEventListener("filelink", e => {
    $("sb-file").textContent = e.detail.name ? "🔗 " + e.detail.name : "";
    $("btn-link").classList.toggle("on", !!e.detail.name);
  });
  store.addEventListener("filesync", e => {
    if (e.detail.direction === "in"){
      preloadScene(store.scene).then(() => { view.render(); syncAll(); });
      toast("Cambio recibido desde el archivo");
    }
  });
}

function setSaveState(state){
  const el = $("sb-save");
  if (state === "ok") el.innerHTML = '<span class="dot"></span> guardado';
  else if (state === "warn") el.innerHTML = '<span class="dot warn"></span> sin guardar';
  else el.innerHTML = '<span class="dot off"></span> —';
}

/* =====================================================================
   CREACIÓN DE ELEMENTOS
   ===================================================================== */
function newElement(type, cx, cy){
  const base = { id: store.uid(), type, rot: 0, opacity: 1, visible: true, locked: false,
                 group: "", name: "", data: defaultData(type), fx: {} };
  const k = store.scene.w / 1080;
  if (type === "text"){
    Object.assign(base, { x: cx - 200 * k, y: cy - 35 * k, w: 400 * k, h: 70 * k });
    Object.assign(base.data, { text: "Texto nuevo", size: Math.round(34 * k),
      color: "#f8fafc", align: "center", valign: "middle" });
  } else if (type === "rect"){
    Object.assign(base, { x: cx - 120 * k, y: cy - 70 * k, w: 240 * k, h: 140 * k });
    Object.assign(base.data, { fill: "#164e63", radius: Math.round(14 * k) });
  } else if (type === "ellipse"){
    Object.assign(base, { x: cx - 100 * k, y: cy - 100 * k, w: 200 * k, h: 200 * k });
    base.data.fill = "#164e63";
  } else if (type === "line"){
    Object.assign(base, { x: cx - 120 * k, y: cy, w: 240 * k, h: 0 });
    Object.assign(base.data, { stroke: "#22d3ee", sw: Math.max(2, Math.round(5 * k)) });
  }
  return base;
}

function onCanvasCreate(tool, x, y){
  if (tool === "image"){ $("file-img").click(); return; }
  const el = newElement(tool, x, y);
  store.tx("agregar " + TYPE_LABEL[tool], () => {
    store.scene.elements.push(el);
    store.sel = [el.id];
  });
  view.render();
  setTool("select");
  syncAll();
}

async function addImageFromFile(file){
  try {
    const r = await readImageFile(file);
    await loadImage(r.src);
    const box = fitBox(r.width, r.height, store.scene.w, store.scene.h);
    const el = {
      id: store.uid(), type: "image", group: "", name: "",
      x: (store.scene.w - box.w) / 2, y: (store.scene.h - box.h) / 2,
      w: box.w, h: box.h, rot: 0, opacity: 1, visible: true, locked: false,
      data: { ...defaultData("image"), src: r.src, fit: "cover" }, fx: {}
    };
    store.tx("agregar imagen", () => { store.scene.elements.push(el); store.sel = [el.id]; });
    view.render(); syncAll();
    toast(r.resized
      ? `Imagen agregada y reescalada a ${r.width}×${r.height} para no inflar el proyecto`
      : "Imagen agregada");
  } catch (e){
    toast(e.message, true);
  }
}

/* =====================================================================
   TOOLBAR
   ===================================================================== */
function setTool(t){
  view.tool = t;
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.toggle("active", b.dataset.tool === t));
  $("viewport").classList.toggle("panning", t === "pan");
}

function bindToolbar(){
  document.querySelectorAll(".tool-btn").forEach(b =>
    b.addEventListener("click", () => setTool(b.dataset.tool)));

  $("btn-undo").addEventListener("click", () => { if (store.undo()) toast("Deshecho"); });
  $("btn-redo").addEventListener("click", () => { if (store.redo()) toast("Rehecho"); });

  $("tpl-sel").addEventListener("change", e => {
    const i = parseInt(e.target.value, 10);
    e.target.selectedIndex = 0;
    if (isNaN(i)) return;
    if (!confirm(`¿Aplicar la plantilla «${TEMPLATES[i].name}»? Se reemplaza el lienzo actual.`)) return;
    store.load(TEMPLATES[i].build());
    preloadScene(store.scene).then(() => { view.render(); view.fit(); syncAll(); });
    toast("Plantilla aplicada");
  });

  /* --- exportación --- */
  const pop = $("pop-export");
  $("btn-export").addEventListener("click", e => {
    e.stopPropagation();
    pop.classList.toggle("show");
    refreshExportName();
  });
  document.addEventListener("click", e => {
    if (!pop.contains(e.target) && e.target !== $("btn-export")) pop.classList.remove("show");
  });
  pop.querySelectorAll("[data-fmt]").forEach(b => b.addEventListener("click", () => {
    exportOpts.format = b.dataset.fmt;
    pop.querySelectorAll("[data-fmt]").forEach(x => x.classList.toggle("on", x === b));
    refreshExportName();
  }));
  pop.querySelectorAll("[data-scale]").forEach(b => b.addEventListener("click", () => {
    exportOpts.scale = parseInt(b.dataset.scale, 10);
    pop.querySelectorAll("[data-scale]").forEach(x => x.classList.toggle("on", x === b));
    refreshExportName();
  }));
  pop.querySelectorAll("[data-bg]").forEach(b => b.addEventListener("click", () => {
    exportOpts.transparent = b.dataset.bg === "transparent";
    pop.querySelectorAll("[data-bg]").forEach(x => x.classList.toggle("on", x === b));
  }));

  $("do-export").addEventListener("click", doExport);
  $("do-copy").addEventListener("click", doCopy);
  $("btn-copy").addEventListener("click", doCopy);
  $("btn-print").addEventListener("click", async () => {
    try { await printSheet(view, store); }
    catch (e){ toast(e.message, true); }
  });

  /* --- proyecto --- */
  $("btn-savefile").addEventListener("click", () => { saveProjectFile(store); toast("Proyecto guardado"); });
  $("btn-openfile").addEventListener("click", () => $("file-json").click());
  $("file-json").addEventListener("change", e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        store.load(JSON.parse(r.result));
        preloadScene(store.scene).then(() => { view.render(); view.fit(); syncAll(); });
        toast("Proyecto abierto");
      } catch (err){ toast("Ese .json no es un proyecto válido.", true); }
    };
    r.readAsText(f);
  });

  $("btn-link").addEventListener("click", async () => {
    if (store.fileName){
      store.unlinkFile();
      toast("Archivo desvinculado");
      return;
    }
    const quiere = confirm(
      "Vincular el proyecto a un archivo .flyer.json del disco.\n\n" +
      "Aceptar = elegir dónde guardarlo (archivo nuevo).\n" +
      "Cancelar = abrir uno existente."
    );
    try {
      const name = quiere ? await store.linkNewFile() : await store.linkExistingFile();
      if (!quiere){ preloadScene(store.scene).then(() => { view.render(); view.fit(); syncAll(); }); }
      toast("Vinculado a " + name + " — ya podés pedirle cambios a Claude Code");
    } catch (e){
      if (e.name !== "AbortError") toast(e.message, true);
    }
  });

  /* --- acciones --- */
  $("btn-upload").addEventListener("click", () => $("file-img").click());
  $("file-img").addEventListener("change", e => {
    const f = e.target.files[0]; e.target.value = "";
    if (f) addImageFromFile(f);
  });
  $("file-bg").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const r = await readImageFile(f);
      await loadImage(r.src);
      store.tx("fondo", () => { store.scene.bg = { type: "image", src: r.src, c1: "#ffffff", c2: "#1e293b", angle: 160 }; });
      view.render(); syncAll();
      toast("Fondo aplicado");
    } catch (err){ toast(err.message, true); }
  });

  $("btn-dup").addEventListener("click", duplicateSel);
  $("btn-del").addEventListener("click", deleteSel);
  $("btn-front").addEventListener("click", () => reorder("front"));
  $("btn-back").addEventListener("click", () => reorder("back"));
  $("btn-group").addEventListener("click", () => {
    if (store.groupSelection()){ toast("Agrupado"); syncLayers(); }
    else toast("Elegí al menos 2 elementos", true);
  });
  $("btn-ungroup").addEventListener("click", () => { store.ungroupSelection(); toast("Separado"); syncLayers(); });

  /* --- alinear --- */
  const A = { "al-l": "left", "al-cx": "centerX", "al-r": "right",
              "al-t": "top", "al-cy": "centerY", "al-b": "bottom" };
  Object.entries(A).forEach(([id, mode]) => $(id).addEventListener("click", () => align(mode)));

  /* --- zoom --- */
  $("btn-fit").addEventListener("click", () => { view.fit(); updateStatus(); });
  $("btn-1to1").addEventListener("click", () => { view.zoomTo(1); updateStatus(); });
  $("chk-snap").addEventListener("change", e => { view.snapEnabled = e.target.checked; });
}

function refreshExportName(){
  const fmt = FORMATS.find(f => f.id === exportOpts.format);
  $("export-name").textContent = exportName(store.scene, fmt, exportOpts.scale);
}

async function doExport(){
  try {
    await exportImage(view, store, exportOpts);
    toast("Imagen exportada");
    $("pop-export").classList.remove("show");
  } catch (e){ toast(e.message, true); }
}
async function doCopy(){
  try {
    await copyToClipboard(view, exportOpts);
    toast("Imagen copiada — pegala en WhatsApp o Instagram");
    $("pop-export").classList.remove("show");
  } catch (e){ toast(e.message, true); }
}

/* =====================================================================
   ACCIONES SOBRE ELEMENTOS
   ===================================================================== */
function duplicateSel(){
  const sel = store.selected;
  if (!sel.length) return;
  const nuevos = [];
  store.tx("duplicar", () => {
    for (const el of sel){
      const cp = JSON.parse(JSON.stringify(el));
      cp.id = store.uid();
      cp.x += 24; cp.y += 24;
      cp.group = "";
      store.scene.elements.push(cp);
      nuevos.push(cp.id);
    }
    store.sel = nuevos;
  });
  view.render(); syncAll();
}

function deleteSel(){
  if (!store.sel.length) return;
  const ids = new Set(store.sel);
  store.tx("eliminar", () => {
    store.scene.elements = store.scene.elements.filter(e => !ids.has(e.id));
    store.sel = [];
  });
  view.render(); syncAll();
}

function reorder(mode){
  if (!store.sel.length) return;
  store.tx(mode === "front" ? "traer al frente" : "enviar al fondo", () => {
    const sel = store.scene.elements.filter(e => store.sel.includes(e.id));
    const rest = store.scene.elements.filter(e => !store.sel.includes(e.id));
    store.scene.elements = mode === "front" ? [...rest, ...sel] : [...sel, ...rest];
  });
  view.render(); syncAll();
}

function nudgeZ(dir){
  if (store.sel.length !== 1) return;
  const arr = store.scene.elements;
  const i = arr.findIndex(e => e.id === store.sel[0]);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  store.tx("orden de capa", () => { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; });
  view.render(); syncAll();
}

function align(mode){
  const sel = store.selected;
  if (!sel.length) return;
  const scene = store.scene;
  let box;
  if (sel.length === 1){
    box = { x: 0, y: 0, w: scene.w, h: scene.h };          // alinear al lienzo
  } else {
    const x1 = Math.min(...sel.map(e => e.x));
    const y1 = Math.min(...sel.map(e => e.y));
    const x2 = Math.max(...sel.map(e => e.x + e.w));
    const y2 = Math.max(...sel.map(e => e.y + e.h));
    box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  store.tx("alinear", () => {
    for (const e of sel){
      if (mode === "left") e.x = box.x;
      else if (mode === "right") e.x = box.x + box.w - e.w;
      else if (mode === "centerX") e.x = box.x + (box.w - e.w) / 2;
      else if (mode === "top") e.y = box.y;
      else if (mode === "bottom") e.y = box.y + box.h - e.h;
      else if (mode === "centerY") e.y = box.y + (box.h - e.h) / 2;
    }
  });
  view.render(); syncAll();
}

/* =====================================================================
   TECLADO
   ===================================================================== */
function bindKeyboard(){
  window.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    const editing = tag === "input" || tag === "textarea" || tag === "select";
    const mod = e.ctrlKey || e.metaKey;

    if (e.code === "Space" && !editing && !e.repeat){
      view.spacePan = true;
      $("viewport").classList.add("panning");
      e.preventDefault();
      return;
    }

    if (mod && e.key.toLowerCase() === "z"){ e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
    if (mod && e.key.toLowerCase() === "y"){ e.preventDefault(); store.redo(); return; }
    if (mod && e.key.toLowerCase() === "s"){ e.preventDefault(); saveProjectFile(store); toast("Proyecto guardado"); return; }
    if (mod && e.key.toLowerCase() === "d"){ e.preventDefault(); if (!editing) duplicateSel(); return; }
    if (mod && e.key.toLowerCase() === "a"){
      if (editing) return;
      e.preventDefault();
      store.select(store.scene.elements.filter(x => !x.locked && x.visible).map(x => x.id));
      return;
    }
    if (mod && e.key.toLowerCase() === "g"){
      e.preventDefault();
      e.shiftKey ? store.ungroupSelection() : store.groupSelection();
      syncLayers();
      return;
    }
    if (mod && e.key === "0"){ e.preventDefault(); view.fit(); updateStatus(); return; }
    if (mod && e.key === "1"){ e.preventDefault(); view.zoomTo(1); updateStatus(); return; }

    if (editing) return;

    /* herramientas por una tecla */
    const tools = { v: "select", h: "pan", t: "text", r: "rect", e: "ellipse", l: "line" };
    if (!mod && tools[e.key.toLowerCase()]){ setTool(tools[e.key.toLowerCase()]); return; }
    if (!mod && e.key.toLowerCase() === "i"){ $("file-img").click(); return; }

    if (e.key === "Escape"){ store.clearSelection(); return; }
    if (e.key === "Delete" || e.key === "Backspace"){ e.preventDefault(); deleteSel(); return; }
    if (e.key === "["){ nudgeZ(-1); return; }
    if (e.key === "]"){ nudgeZ(1); return; }

    if (e.key.startsWith("Arrow")){
      const sel = store.selected.filter(x => !x.locked);
      if (!sel.length) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      store.tx("mover", () => {
        for (const el of sel){
          if (e.key === "ArrowLeft") el.x -= step;
          else if (e.key === "ArrowRight") el.x += step;
          else if (e.key === "ArrowUp") el.y -= step;
          else if (e.key === "ArrowDown") el.y += step;
        }
      });
      for (const el of sel) view.syncNode(el);
      view.syncTransformer();
    }
  });

  window.addEventListener("keyup", e => {
    if (e.code === "Space"){
      view.spacePan = false;
      $("viewport").classList.toggle("panning", view.tool === "pan");
    }
  });
}

/* =====================================================================
   PANELES
   ===================================================================== */
/* Par slider + número que editan el mismo valor */
function pair(rangeId, numId, read, write, label){
  const r = $(rangeId), n = $(numId);
  const apply = v => {
    if (!isFinite(v)) return;
    store.begin();
    write(v);
    store.end(label);
    refreshSelectedNodes();
  };
  if (r) r.addEventListener("input", () => { if (n) n.value = r.value; apply(parseFloat(r.value)); });
  if (n) n.addEventListener("input", () => { if (r) r.value = n.value; apply(parseFloat(n.value)); });
  return { r, n, read };
}

const PAIRS = [];

function bindPanels(){
  /* --- escena --- */
  $("p-name").addEventListener("input", e => {
    store.begin(); store.scene.name = e.target.value; store.end("nombre");
  });
  $("p-preset").addEventListener("change", e => {
    const p = CANVAS_PRESETS.find(x => x.id === e.target.value);
    if (!p) return;
    store.tx("formato", () => { store.scene.w = p.w; store.scene.h = p.h; });
    view.render(); view.fit(); syncAll();
    toast(`Lienzo ${p.w}×${p.h}`);
  });
  const sceneNum = (id, key) => $(id).addEventListener("change", e => {
    const v = parseInt(e.target.value, 10);
    if (!isFinite(v)) return;
    store.tx("lienzo", () => { store.scene[key] = Math.max(50, Math.min(8000, v)); });
    view.render(); view.fit(); syncAll();
  });
  sceneNum("p-w", "w"); sceneNum("p-h", "h");

  $("p-bgtype").addEventListener("change", e => {
    store.tx("fondo", () => { store.scene.bg.type = e.target.value; });
    view.render(); syncPanels();
  });
  const bgColor = (id, key) => $(id).addEventListener("input", e => {
    store.begin(); store.scene.bg[key] = e.target.value; store.end("fondo");
    view.buildBackground();
  });
  bgColor("p-bgc1", "c1"); bgColor("p-bgc2", "c2");
  $("p-bgang").addEventListener("input", e => {
    store.begin(); store.scene.bg.angle = parseFloat(e.target.value) || 0; store.end("fondo");
    view.buildBackground();
  });
  $("p-bgimg").addEventListener("click", () => $("file-bg").click());

  /* --- transformación --- */
  const each = fn => { for (const el of store.selected) fn(el); };
  const numField = (id, fn) => $(id).addEventListener("input", e => {
    const v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    store.begin(); each(el => fn(el, v)); store.end("editar");
    refreshSelectedNodes();
  });
  numField("p-x", (el, v) => el.x = v);
  numField("p-y", (el, v) => el.y = v);
  numField("p-elw", (el, v) => el.w = Math.max(1, v));
  numField("p-elh", (el, v) => el.h = Math.max(1, v));

  PAIRS.push(pair("p-rot", "p-rotn", el => el.rot, v => each(el => el.rot = v), "rotar"));
  PAIRS.push(pair("p-op", "p-opn", el => el.opacity, v => each(el => el.opacity = Math.min(1, Math.max(0, v))), "opacidad"));

  /* --- texto --- */
  $("p-text").addEventListener("input", e => {
    store.begin(); each(el => { if (el.type === "text") el.data.text = e.target.value; });
    store.end("texto"); refreshSelectedNodes();
  });
  $("p-font").addEventListener("change", e => {
    store.tx("fuente", () => each(el => { if (el.type === "text") el.data.font = e.target.value; }));
    refreshSelectedNodes();
  });
  PAIRS.push(pair("p-size", "p-sizen", el => el.data.size,
    v => each(el => { if (el.type === "text") el.data.size = Math.max(1, v); }), "tamaño"));
  PAIRS.push(pair("p-lh", "p-lhn", el => el.data.lh,
    v => each(el => { if (el.type === "text") el.data.lh = v; }), "interlínea"));
  PAIRS.push(pair("p-ls", "p-lsn", el => el.data.ls,
    v => each(el => { if (el.type === "text") el.data.ls = v; }), "espaciado"));

  const toggle = (id, fn) => $(id).addEventListener("click", () => {
    store.tx("estilo", () => each(el => { if (el.type === "text") fn(el); }));
    refreshSelectedNodes(); syncPanels();
  });
  toggle("p-bold", el => el.data.weight = el.data.weight >= 700 ? 400 : 700);
  toggle("p-italic", el => el.data.italic = !el.data.italic);
  toggle("p-under", el => el.data.underline = !el.data.underline);

  $("p-color").addEventListener("input", e => {
    store.begin(); each(el => { if (el.type === "text") el.data.color = e.target.value; });
    store.end("color"); refreshSelectedNodes();
  });
  document.querySelectorAll("[data-align]").forEach(b => b.addEventListener("click", () => {
    store.tx("alinear texto", () => each(el => { if (el.type === "text") el.data.align = b.dataset.align; }));
    refreshSelectedNodes(); syncPanels();
  }));
  document.querySelectorAll("[data-valign]").forEach(b => b.addEventListener("click", () => {
    store.tx("alinear vertical", () => each(el => { if (el.type === "text") el.data.valign = b.dataset.valign; }));
    refreshSelectedNodes(); syncPanels();
  }));
  $("p-tbg").addEventListener("input", e => {
    store.begin(); each(el => { if (el.type === "text") el.data.bg = e.target.value; });
    store.end("fondo texto"); refreshSelectedNodes(); syncPanels();
  });
  $("p-tbg-off").addEventListener("change", e => {
    store.tx("fondo texto", () => each(el => { if (el.type === "text") el.data.bg = e.target.checked ? "" : "#000000"; }));
    refreshSelectedNodes(); syncPanels();
  });

  /* --- formas --- */
  const isShape = el => el.type === "rect" || el.type === "ellipse" || el.type === "line";
  $("p-fill").addEventListener("input", e => {
    store.begin(); each(el => { if (isShape(el)) el.data.fill = e.target.value; });
    store.end("relleno"); refreshSelectedNodes();
  });
  $("p-fill-off").addEventListener("change", e => {
    store.tx("relleno", () => each(el => { if (isShape(el)) el.data.fill = e.target.checked ? "" : "#164e63"; }));
    refreshSelectedNodes(); syncPanels();
  });
  $("p-stroke").addEventListener("input", e => {
    store.begin(); each(el => { if (isShape(el)) el.data.stroke = e.target.value; });
    store.end("borde"); refreshSelectedNodes();
  });
  $("p-stroke-off").addEventListener("change", e => {
    store.tx("borde", () => each(el => { if (isShape(el)) el.data.stroke = e.target.checked ? "" : "#22d3ee"; }));
    refreshSelectedNodes(); syncPanels();
  });
  PAIRS.push(pair("p-sw", "p-swn", el => el.data.sw,
    v => each(el => { if (isShape(el)) el.data.sw = v; }), "grosor"));
  PAIRS.push(pair("p-radius", "p-radiusn", el => el.data.radius,
    v => each(el => { if (el.type === "rect") el.data.radius = v; }), "radio"));

  /* --- imagen --- */
  $("p-fit").addEventListener("change", e => {
    store.tx("ajuste", () => each(el => { if (el.type === "image") el.data.fit = e.target.value; }));
    refreshSelectedNodes();
  });
  PAIRS.push(pair("p-iradius", "p-iradiusn", el => el.data.radius,
    v => each(el => { if (el.type === "image") el.data.radius = v; }), "radio"));
  PAIRS.push(pair("p-ibw", "p-ibwn", el => el.data.bw,
    v => each(el => { if (el.type === "image") el.data.bw = v; }), "grosor"));
  $("p-iborder").addEventListener("input", e => {
    store.begin(); each(el => { if (el.type === "image") el.data.border = e.target.value; });
    store.end("borde"); refreshSelectedNodes();
  });
  $("p-iborder-off").addEventListener("change", e => {
    store.tx("borde", () => each(el => { if (el.type === "image") el.data.border = e.target.checked ? "" : "#22d3ee"; }));
    refreshSelectedNodes(); syncPanels();
  });

  /* --- efectos --- */
  $("fx-shadow").addEventListener("change", e => {
    store.tx("sombra", () => each(el => el.fx.shadow = e.target.checked));
    refreshSelectedNodes(); syncPanels();
  });
  $("fx-scolor").addEventListener("input", e => {
    store.begin(); each(el => el.fx.shadowColor = e.target.value); store.end("sombra");
    refreshSelectedNodes();
  });
  $("fx-sop").addEventListener("input", e => {
    store.begin(); each(el => el.fx.shadowOpacity = parseFloat(e.target.value) || 0); store.end("sombra");
    refreshSelectedNodes();
  });
  PAIRS.push(pair("fx-sblur", "fx-sblurn", el => el.fx.shadowBlur, v => each(el => el.fx.shadowBlur = v), "sombra"));
  PAIRS.push(pair("fx-sx", "fx-sxn", el => el.fx.shadowX, v => each(el => el.fx.shadowX = v), "sombra"));
  PAIRS.push(pair("fx-sy", "fx-syn", el => el.fx.shadowY, v => each(el => el.fx.shadowY = v), "sombra"));
  $("fx-blend").addEventListener("change", e => {
    store.tx("mezcla", () => each(el => el.fx.blend = e.target.value));
    refreshSelectedNodes();
  });
}

function refreshSelectedNodes(){
  for (const el of store.selected) view.syncNode(el);
  view.syncTransformer();
}

function buildTypePresets(){
  const box = $("preset-list");
  box.innerHTML = "";
  for (const p of TYPE_PRESETS){
    const b = document.createElement("button");
    b.className = "preset-btn";
    b.dataset.preset = p.id;
    b.innerHTML = `${p.label}<small>${p.hint}</small>`;
    b.addEventListener("click", () => {
      store.tx("estilo " + p.label, () => {
        for (const el of store.selected) applyTypePreset(el, p.id, store.scene.w);
      });
      refreshSelectedNodes(); syncPanels();
      toast("Estilo " + p.label);
    });
    box.appendChild(b);
  }
}

function buildPalette(){
  const box = $("palette");
  box.innerHTML = "";
  for (const c of BRAND.palette){
    const d = document.createElement("div");
    d.className = "sw";
    d.style.background = c.hex;
    d.title = `${c.name} · ${c.hex}`;
    d.addEventListener("click", () => {
      const sel = store.selected;
      if (!sel.length){ toast("Elegí un elemento primero", true); return; }
      store.tx("color", () => {
        for (const el of sel){
          if (el.type === "text") el.data.color = c.hex;
          else if (el.type === "line") el.data.stroke = c.hex;
          else if (el.type !== "image") el.data.fill = c.hex;
        }
      });
      refreshSelectedNodes(); syncPanels();
    });
    box.appendChild(d);
  }
}

function buildAssets(){
  const list = $("asset-list");
  list.innerHTML = "";
  const assets = [
    { src: LOGO_SRC, name: "Logo WOLF IT", size: "webp" },
    { src: "assets/Flyer.png", name: "Flyer anterior", size: "png" }
  ];
  for (const a of assets){
    const row = document.createElement("div");
    row.className = "asset-thumb";
    const img = document.createElement("img");
    img.src = a.src; img.alt = "";
    const info = document.createElement("div");
    info.innerHTML = `<div class="nm"></div><div class="sz">${a.size}</div>`;
    info.querySelector(".nm").textContent = a.name;
    row.append(img, info);
    row.addEventListener("click", async () => {
      try {
        const im = await loadImage(a.src);
        const box = fitBox(im.width, im.height, store.scene.w, store.scene.h);
        const el = {
          id: store.uid(), type: "image", group: "", name: a.name,
          x: (store.scene.w - box.w) / 2, y: (store.scene.h - box.h) / 2,
          w: box.w, h: box.h, rot: 0, opacity: 1, visible: true, locked: false,
          data: { ...defaultData("image"), src: a.src, fit: "contain" }, fx: {}
        };
        store.tx("agregar imagen", () => { store.scene.elements.push(el); store.sel = [el.id]; });
        view.render(); syncAll();
      } catch (e){ toast("No se pudo cargar la imagen", true); }
    });
    list.appendChild(row);
  }
}

/* ---------------- sincronización de los paneles ---------------- */
function syncAll(){ syncPanels(); syncLayers(); updateStatus(); }

function setVal(id, v){ const n = $(id); if (n && document.activeElement !== n) n.value = v; }
function setPair(rangeId, numId, v){ setVal(rangeId, v); setVal(numId, v); }

function syncPanels(){
  const scene = store.scene;
  setVal("p-name", scene.name);
  const preset = CANVAS_PRESETS.find(p => p.w === scene.w && p.h === scene.h);
  setVal("p-preset", preset ? preset.id : "custom");
  setVal("p-w", scene.w); setVal("p-h", scene.h);
  setVal("p-bgtype", scene.bg.type);
  setVal("p-bgc1", hexOnly(scene.bg.c1, "#0f172a"));
  setVal("p-bgc2", hexOnly(scene.bg.c2, "#1e293b"));
  setVal("p-bgang", scene.bg.angle);
  $("row-bg1").style.display = scene.bg.type === "image" ? "none" : "";
  $("row-bg2").style.display = scene.bg.type === "gradient" ? "" : "none";
  $("row-bgimg").style.display = scene.bg.type === "image" ? "" : "none";

  const sel = store.selected;
  const el = sel[0];
  const has = sel.length > 0;
  const kinds = new Set(sel.map(e => e.type));

  $("sec-common").style.display = has ? "" : "none";
  $("sec-text").style.display = has && kinds.has("text") ? "" : "none";
  $("sec-shape").style.display = has && (kinds.has("rect") || kinds.has("ellipse") || kinds.has("line")) ? "" : "none";
  $("sec-image").style.display = has && kinds.has("image") ? "" : "none";
  $("sec-fx").style.display = has ? "" : "none";
  $("sel-count").textContent = sel.length > 1 ? `(${sel.length} elementos)` : "";
  if (!has) return;

  setVal("p-x", Math.round(el.x)); setVal("p-y", Math.round(el.y));
  setVal("p-elw", Math.round(el.w)); setVal("p-elh", Math.round(el.h));
  setPair("p-rot", "p-rotn", Math.round(el.rot || 0));
  setPair("p-op", "p-opn", +(el.opacity ?? 1).toFixed(2));

  if (el.type === "text"){
    const d = el.data;
    setVal("p-text", d.text);
    setVal("p-font", d.font);
    setPair("p-size", "p-sizen", Math.round(d.size));
    setPair("p-lh", "p-lhn", d.lh);
    setPair("p-ls", "p-lsn", d.ls || 0);
    setVal("p-color", hexOnly(d.color, "#ffffff"));
    $("p-bold").classList.toggle("on", d.weight >= 700);
    $("p-italic").classList.toggle("on", !!d.italic);
    $("p-under").classList.toggle("on", !!d.underline);
    document.querySelectorAll("[data-align]").forEach(b => b.classList.toggle("on", b.dataset.align === d.align));
    document.querySelectorAll("[data-valign]").forEach(b => b.classList.toggle("on", b.dataset.valign === d.valign));
    setVal("p-tbg", hexOnly(d.bg, "#000000"));
    $("p-tbg-off").checked = !d.bg;
    document.querySelectorAll("[data-preset]").forEach(b =>
      b.classList.toggle("active", b.dataset.preset === d.preset));
  }
  if (el.type === "rect" || el.type === "ellipse" || el.type === "line"){
    setVal("p-fill", hexOnly(el.data.fill, "#164e63"));
    $("p-fill-off").checked = !el.data.fill;
    setVal("p-stroke", hexOnly(el.data.stroke, "#22d3ee"));
    $("p-stroke-off").checked = !el.data.stroke;
    setPair("p-sw", "p-swn", el.data.sw || 0);
    $("row-radius").style.display = el.type === "rect" ? "" : "none";
    setPair("p-radius", "p-radiusn", el.data.radius || 0);
  }
  if (el.type === "image"){
    setVal("p-fit", el.data.fit);
    setPair("p-iradius", "p-iradiusn", el.data.radius || 0);
    setVal("p-iborder", hexOnly(el.data.border, "#22d3ee"));
    $("p-iborder-off").checked = !el.data.border;
    setPair("p-ibw", "p-ibwn", el.data.bw || 0);
  }
  const fx = el.fx || {};
  $("fx-shadow").checked = !!fx.shadow;
  $("fx-shadow-rows").style.display = fx.shadow ? "" : "none";
  setVal("fx-scolor", hexOnly(fx.shadowColor, "#000000"));
  setVal("fx-sop", fx.shadowOpacity ?? 0.35);
  setPair("fx-sblur", "fx-sblurn", fx.shadowBlur ?? 12);
  setPair("fx-sx", "fx-sxn", fx.shadowX ?? 0);
  setPair("fx-sy", "fx-syn", fx.shadowY ?? 6);
  setVal("fx-blend", fx.blend || "normal");
}

/* Los <input type=color> solo aceptan #rrggbb */
function hexOnly(v, fallback){
  return (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) ? v : fallback;
}

function syncLayers(){
  const list = $("layer-list");
  list.innerHTML = "";
  const arr = store.scene.elements.slice().reverse();
  for (const el of arr){
    const row = document.createElement("div");
    row.className = "layer-row" + (store.sel.includes(el.id) ? " active" : "");
    row.dataset.id = el.id;

    const lb = document.createElement("span");
    lb.className = "lb";
    lb.textContent = TYPE_LABEL[el.type];

    const nm = document.createElement("span");
    nm.className = "name";
    nm.textContent = (el.name || (el.type === "text" ? el.data.text : TYPE_LABEL[el.type]) || "…").slice(0, 26);
    if (el.group) nm.textContent = "⛓ " + nm.textContent;

    const mk = (cls, txt, title) => {
      const b = document.createElement("button");
      b.className = cls; b.textContent = txt; b.title = title;
      return b;
    };
    const vis = mk("vis", el.visible ? "👁" : "🚫", "Visibilidad");
    const lock = mk("lk", el.locked ? "🔒" : "🔓", "Bloquear");
    const del = mk("del", "✕", "Eliminar");

    row.append(lb, nm, vis, lock, del);

    row.addEventListener("click", ev => {
      if (ev.target === vis){
        store.tx("visibilidad", () => { el.visible = !el.visible; });
        view.render(); syncAll(); return;
      }
      if (ev.target === lock){
        store.tx("bloqueo", () => { el.locked = !el.locked; });
        view.render(); syncAll(); return;
      }
      if (ev.target === del){
        store.select(el.id); deleteSel(); return;
      }
      store.select(store.expandGroup(el.id),
        { additive: ev.shiftKey || ev.ctrlKey || ev.metaKey });
    });
    list.appendChild(row);
  }
}

function updateStatus(){
  const s = store.scene;
  $("sb-size").innerHTML = `Lienzo: <b>${s.w}×${s.h}</b> · Elementos: <b>${s.elements.length}</b>` +
    (store.sel.length ? ` · Selección: <b>${store.sel.length}</b>` : "");
  if (view) $("sb-zoom").textContent = Math.round(view.zoom * 100) + "%";
  $("btn-undo").disabled = !store.canUndo();
  $("btn-redo").disabled = !store.canRedo();
}

boot();
