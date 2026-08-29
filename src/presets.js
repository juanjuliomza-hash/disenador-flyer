/* =====================================================================
   presets.js — formatos de lienzo, escala tipográfica y paleta de marca
   ===================================================================== */

export const CANVAS_PRESETS = [
  { id: "1080x1350", label: "1080×1350 · 4:5 (flyer / post)", w: 1080, h: 1350 },
  { id: "1080x1080", label: "1080×1080 · 1:1 (cuadrado)",     w: 1080, h: 1080 },
  { id: "1080x1920", label: "1080×1920 · 9:16 (story)",       w: 1080, h: 1920 },
  { id: "1920x1080", label: "1920×1080 · 16:9",               w: 1920, h: 1080 },
  { id: "1748x2480", label: "1748×2480 · A5 300 dpi",         w: 1748, h: 2480 },
  { id: "2480x3508", label: "2480×3508 · A4 300 dpi",         w: 2480, h: 3508 }
];

/* ---------------------------------------------------------------------
   TYPE PRESETS
   Una escala tipográfica coherente en botones. En vez de elegir tamaño,
   peso y color a mano, se elige el ROL del texto y el preset resuelve.
   Los tamaños están definidos sobre un lienzo de 1080 px de ancho y se
   reescalan solos para A4, story, etc. (ver applyTypePreset).
   --------------------------------------------------------------------- */
export const TYPE_PRESETS = [
  { id: "headline", label: "Headline", hint: "Titular principal",
    data: { font: "Arial Black", size: 82, weight: 900, lh: 1.02, ls: 0,  valign: "top" } },
  { id: "subhead",  label: "Subhead",  hint: "Bajada del titular",
    data: { font: "Segoe UI",    size: 36, weight: 800, lh: 1.15, ls: 0,  valign: "top" } },
  { id: "kicker",   label: "Kicker",   hint: "Volanta / rubro",
    data: { font: "Segoe UI",    size: 27, weight: 700, lh: 1.2,  ls: 5,  valign: "middle" } },
  { id: "body",     label: "Body",     hint: "Texto corrido",
    data: { font: "Segoe UI",    size: 26, weight: 400, lh: 1.4,  ls: 0,  valign: "top" } },
  { id: "caption",  label: "Caption",  hint: "Pie / letra chica",
    data: { font: "Segoe UI",    size: 21, weight: 400, lh: 1.35, ls: 0,  valign: "middle" } },
  { id: "badge",    label: "Badge",    hint: "Etiqueta / beneficio",
    data: { font: "Segoe UI",    size: 22, weight: 700, lh: 1.2,  ls: 0,  valign: "middle" } },
  { id: "cta",      label: "CTA",      hint: "Teléfono / llamada a la acción",
    data: { font: "Arial Black", size: 54, weight: 900, lh: 1.05, ls: 1,  valign: "middle" } }
];

const BASE_W = 1080;

/* Aplica un preset al elemento, escalando los tamaños al ancho del lienzo.
   No toca el color: el color es decisión de marca, no de rol tipográfico. */
export function applyTypePreset(el, presetId, sceneW){
  const p = TYPE_PRESETS.find(t => t.id === presetId);
  if (!p || el.type !== "text") return false;
  const k = (sceneW || BASE_W) / BASE_W;
  el.data.font   = p.data.font;
  el.data.size   = Math.round(p.data.size * k);
  el.data.weight = p.data.weight;
  el.data.lh     = p.data.lh;
  el.data.ls     = +(p.data.ls * k).toFixed(2);
  el.data.valign = p.data.valign;
  el.data.preset = p.id;
  return true;
}

/* ---------------------------------------------------------------------
   Paleta de marca (WOLF IT). Es el germen del "brand profile":
   se reusa en el panel de color y más adelante alimenta el prompt de IA.
   --------------------------------------------------------------------- */
/* Los colores OFICIALES salen de la guía de marca (assets/Flyer.png).
   Ojo: la plantilla actual usa cian/ámbar, que NO son de la guía. Están las dos
   familias acá para poder pasar la plantilla a los colores oficiales cuando se
   decida — ver PREFERENCIAS-DISENO.md. */
export const BRAND = {
  name: "WOLF IT",
  palette: [
    /* — Oficiales (guía de marca) — */
    { hex: "#0d1b3d", name: "Azul 1 · oficial" },
    { hex: "#102a54", name: "Azul 2 · oficial (recomendado)" },
    { hex: "#153e75", name: "Azul 3 · oficial (recomendado)" },
    { hex: "#1b5dbf", name: "Azul 4 · oficial" },
    { hex: "#1976d2", name: "Azul 5 · oficial" },
    { hex: "#ffd600", name: "Amarillo · oficial" },
    { hex: "#ff8c00", name: "Naranja · oficial" },
    { hex: "#ffffff", name: "Blanco · oficial" },
    { hex: "#e0e0e0", name: "Gris claro · oficial" },
    /* — En uso hoy en la plantilla — */
    { hex: "#0a0f1e", name: "Fondo profundo (plantilla)" },
    { hex: "#13233f", name: "Fondo medio (plantilla)" },
    { hex: "#22d3ee", name: "Cian (plantilla)" },
    { hex: "#fbbf24", name: "Ámbar (plantilla)" },
    { hex: "#94a3b8", name: "Gris medio" },
    { hex: "#64748b", name: "Gris apagado" },
    { hex: "#000000", name: "Negro" }
  ],
  fonts: { display: "Arial Black", body: "Segoe UI" }
};

export const FONTS = [
  "Segoe UI", "Arial", "Arial Black", "Verdana", "Tahoma",
  "Trebuchet MS", "Georgia", "Times New Roman", "Courier New", "Impact",
  "Segoe UI Emoji"
];

/* OJO: en canvas los nombres con espacios DEBEN ir entre comillas. Sin ellas
   la declaración `ctx.font` entera es inválida y se descarta → los emojis
   salen como tofu (?) y "Arial Black" cae a la fuente por defecto. */
export const EMOJI_FONT = `"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;

export const BLEND_MODES = [
  { id: "normal",   label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen",   label: "Screen" },
  { id: "overlay",  label: "Overlay" }
];
