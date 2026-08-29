/* =====================================================================
   schema.js — contrato del proyecto (.flyer.json)
   Formato abierto y versionado. Toda escena que entra al editor pasa
   por migrate() + normalize(), así los proyectos viejos siguen abriendo.
   ===================================================================== */

export const SCHEMA_VERSION = 1;

/* Límites de salud de assets (idea tomada de Calqo).
   No bloquean nada: avisan y reescalan. Importan en máquinas con poca RAM. */
export const LIMITS = {
  imageMB: 8,          // peso de la imagen decodificada
  longEdge: 4096,      // lado más largo en px
  projectMB: 50        // peso del proyecto entero
};

export const ELEMENT_TYPES = ["text", "image", "rect", "ellipse", "line"];

/* ---------------- Valores por defecto por tipo ---------------- */
const DEFAULT_DATA = {
  text: {
    text: "Texto", font: "Segoe UI", size: 34, weight: 700,
    italic: false, underline: false, color: "#0f172a",
    align: "left", valign: "top", lh: 1.2, ls: 0,
    bg: "", bgpad: 0, preset: ""
  },
  image:   { src: "", fit: "cover", radius: 0, border: "", bw: 0 },
  rect:    { fill: "#164e63", stroke: "", sw: 0, radius: 0 },
  ellipse: { fill: "#164e63", stroke: "", sw: 0 },
  line:    { stroke: "#22d3ee", sw: 5 }
};

/* Efectos comunes a todos los elementos */
const DEFAULT_FX = {
  shadow: false, shadowColor: "#000000", shadowBlur: 12,
  shadowX: 0, shadowY: 6, shadowOpacity: 0.35,
  blur: 0, blend: "normal"
};

export function defaultData(type){
  return { ...(DEFAULT_DATA[type] || {}) };
}

export function blankScene(){
  return {
    version: SCHEMA_VERSION,
    name: "Sin título",
    w: 1080, h: 1350,
    bg: { type: "gradient", c1: "#0f172a", c2: "#1e293b", angle: 160 },
    elements: []
  };
}

/* ---------------- Migración ---------------- */
/* v0 (sin campo `version`) → v1
   El editor viejo mostraba el texto pegado ARRIBA en pantalla (el export lo
   centraba, y esa discrepancia era el bug). Al migrar preservamos lo que el
   usuario VEÍA: valign "top". Las plantillas nuevas sí traen su valign real. */
function migrateV0toV1(scene){
  scene.version = 1;
  if (!scene.name) scene.name = "Proyecto importado";
  for (const el of scene.elements || []){
    if (el.type === "text" && el.data && el.data.valign === undefined){
      el.data.valign = "top";
    }
  }
  return scene;
}

const MIGRATIONS = [
  { from: 0, to: 1, run: migrateV0toV1 }
];

export function migrate(scene){
  let v = Number(scene.version) || 0;
  while (v < SCHEMA_VERSION){
    const step = MIGRATIONS.find(m => m.from === v);
    if (!step) break;             // no hay ruta: normalize() se hace cargo
    scene = step.run(scene);
    v = step.to;
  }
  scene.version = SCHEMA_VERSION;
  return scene;
}

/* ---------------- Validación / normalización ---------------- */
export class SchemaError extends Error {}

const num = (v, def) => (typeof v === "number" && isFinite(v)) ? v : def;
const str = (v, def) => (typeof v === "string") ? v : def;
const bool = (v, def) => (typeof v === "boolean") ? v : def;

/* Sanea un color/valor CSS que va a terminar dentro de un string de estilo.
   Evita que un .json ajeno inyecte CSS arbitrario (ej. url(...) en el fondo). */
export function safeColor(v, fallback){
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (!s) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(s)) return s;
  if (/^[a-z]{3,20}$/i.test(s)) return s;          // nombres CSS (red, transparent…)
  return fallback;
}

/* Solo se aceptan imágenes como data: URL o rutas relativas del propio proyecto. */
export function safeSrc(v){
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(s)) return s;
  if (/^(assets\/|\.\/assets\/)[\w.\-/ ]+$/i.test(s)) return s;
  if (/^blob:/i.test(s)) return s;
  return "";
}

export function normalizeElement(raw, i){
  if (!raw || typeof raw !== "object") throw new SchemaError("Elemento " + i + " inválido");
  const type = ELEMENT_TYPES.includes(raw.type) ? raw.type : "rect";
  const el = {
    id: str(raw.id, "el" + (i + 1)),
    type,
    name: str(raw.name, ""),
    group: str(raw.group, ""),      // agrupación liviana: mismo id = se mueven juntos
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(1, num(raw.w, 100)),
    h: Math.max(1, num(raw.h, 100)),
    rot: num(raw.rot, 0),
    opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
    visible: bool(raw.visible, true),
    locked: bool(raw.locked, false),
    data: { ...defaultData(type), ...(raw.data && typeof raw.data === "object" ? raw.data : {}) },
    fx: { ...DEFAULT_FX, ...(raw.fx && typeof raw.fx === "object" ? raw.fx : {}) }
  };

  const d = el.data;
  if (type === "text"){
    d.text = String(d.text ?? "");
    d.size = Math.max(1, num(d.size, 34));
    d.lh = Math.max(0.5, num(d.lh, 1.2));
    d.ls = num(d.ls, 0);
    d.weight = num(d.weight, 400);
    d.color = safeColor(d.color, "#0f172a");
    d.bg = d.bg ? safeColor(d.bg, "") : "";
    d.bgpad = Math.max(0, num(d.bgpad, 0));
    if (!["left","center","right"].includes(d.align)) d.align = "left";
    if (!["top","middle","bottom"].includes(d.valign)) d.valign = "top";
  } else if (type === "image"){
    d.src = safeSrc(d.src);
    if (!["cover","contain"].includes(d.fit)) d.fit = "cover";
    d.radius = Math.max(0, num(d.radius, 0));
    d.border = d.border ? safeColor(d.border, "") : "";
    d.bw = Math.max(0, num(d.bw, 0));
  } else {
    d.fill = d.fill ? safeColor(d.fill, "#164e63") : "";
    d.stroke = d.stroke ? safeColor(d.stroke, "") : "";
    d.sw = Math.max(0, num(d.sw, 0));
    if (type === "rect") d.radius = Math.max(0, num(d.radius, 0));
  }

  el.fx.shadowColor = safeColor(el.fx.shadowColor, "#000000");
  el.fx.blur = Math.max(0, num(el.fx.blur, 0));
  return el;
}

export function normalize(raw){
  if (!raw || typeof raw !== "object") throw new SchemaError("El archivo no es un proyecto.");
  const scene = migrate({ ...raw });
  const out = {
    version: SCHEMA_VERSION,
    name: str(scene.name, "Sin título"),
    w: Math.round(Math.min(8000, Math.max(50, num(scene.w, 1080)))),
    h: Math.round(Math.min(8000, Math.max(50, num(scene.h, 1350)))),
    bg: normalizeBg(scene.bg),
    elements: []
  };
  const list = Array.isArray(scene.elements) ? scene.elements : [];
  out.elements = list.map(normalizeElement);
  dedupeIds(out);
  return out;
}

function normalizeBg(bg){
  const b = (bg && typeof bg === "object") ? bg : {};
  const type = ["color","gradient","image"].includes(b.type) ? b.type : "color";
  return {
    type,
    c1: safeColor(b.c1, "#ffffff"),
    c2: safeColor(b.c2, "#1e293b"),
    angle: num(b.angle, 160),
    src: safeSrc(b.src)
  };
}

/* Los ids duplicados rompían el borrado (borraba dos elementos de una).
   Acá se garantiza unicidad al entrar. */
function dedupeIds(scene){
  const seen = new Set();
  let n = 1;
  for (const el of scene.elements){
    if (!el.id || seen.has(el.id)){
      while (seen.has("el" + n)) n++;
      el.id = "el" + n;
    }
    seen.add(el.id);
  }
}

/* Devuelve el número más alto usado como id "elN", para que el contador
   del editor arranque después y nunca reasigne un id existente. */
export function maxIdSeq(scene){
  let max = 0;
  for (const el of scene.elements || []){
    const m = /^el(\d+)$/.exec(el.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export function sceneBytes(scene){
  try { return new Blob([JSON.stringify(scene)]).size; } catch { return 0; }
}
