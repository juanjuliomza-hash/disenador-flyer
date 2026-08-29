/* =====================================================================
   templates.js — plantillas de arranque
   Las coordenadas son píxeles sobre el lienzo declarado en cada escena.
   ===================================================================== */

import { SCHEMA_VERSION, defaultData } from "./schema.js";

export const LOGO_SRC = "assets/Mr.-Wolf.webp";

/* Constructor corto de elementos, para que la plantilla se lea como un
   diseño y no como un volcado de JSON. */
function makeBuilder(){
  let n = 0;
  const E = [];
  const add = o => {
    const el = Object.assign(
      { id: "el" + (++n), name: "", visible: true, locked: false, opacity: 1, rot: 0 },
      o
    );
    el.data = { ...defaultData(el.type), ...(o.data || {}) };
    el.fx = o.fx || {};
    E.push(el);
    return el;
  };
  return {
    els: E,
    /* texto */
    T: (x, y, w, h, text, data) => add({ type: "text", x, y, w, h, data: { text, valign: "middle", ...data } }),
    /* emoji (usa la fuente de emojis del sistema).
       La caja va holgada a propósito: un emoji mide más que su tamaño de fuente. */
    EM: (x, y, s, ch, data) => add({
      type: "text", x, y, w: s * 1.6, h: s * 1.5,
      data: { text: ch, font: "Segoe UI Emoji", size: s, valign: "middle", align: "center", ...data }
    }),
    R: (x, y, w, h, data) => add({ type: "rect", x, y, w, h, data }),
    O: (x, y, w, h, data) => add({ type: "ellipse", x, y, w, h, data }),
    IMG: (x, y, w, h, src, data) => add({ type: "image", x, y, w, h, data: { src, ...data } })
  };
}

export function blankTemplate(){
  return {
    version: SCHEMA_VERSION,
    name: "Lienzo en blanco",
    w: 1080, h: 1350,
    bg: { type: "gradient", c1: "#0f172a", c2: "#1e293b", angle: 160, src: "" },
    elements: []
  };
}

/* ---------------------------------------------------------------------
   WOLF IT — Servicio Técnico Informático (1080×1350)
   --------------------------------------------------------------------- */
export function wolfITTemplate(){
  const b = makeBuilder();
  const { T, EM, R, O, IMG } = b;

  const CIAN = "#22d3ee", AMBAR = "#fbbf24", BLANCO = "#f8fafc";
  const CARD_FILL = "rgba(255,255,255,0.055)";
  const CARD_STROKE = "rgba(148,163,184,0.20)";

  /* ---- Decoración ---- */
  O(720, -70, 440, 440, { fill: "", stroke: "rgba(34,211,238,0.10)", sw: 2 });
  O(-300, 920, 520, 520, { fill: "", stroke: "rgba(34,211,238,0.08)", sw: 2 });
  R(1006, 60, 14, 130, { fill: AMBAR, radius: 7 });
  R(62, 1314, 12, 12, { fill: "rgba(34,211,238,0.45)", radius: 6 });
  R(1000, 238, 10, 10, { fill: "rgba(251,191,36,0.5)", radius: 5 });

  /* ---- Header ---- */
  IMG(70, 56, 130, 130, LOGO_SRC, { fit: "contain", radius: 26, border: "#1e293b", bw: 2 });
  T(216, 62, 760, 90, "WOLF IT",
    { font: "Arial Black", size: 74, weight: 900, color: BLANCO, ls: 3, preset: "headline" });
  T(216, 140, 760, 40, "SERVICIO TÉCNICO INFORMÁTICO",
    { size: 27, weight: 700, color: CIAN, ls: 5, preset: "kicker" });
  R(70, 206, 940, 4, { fill: "rgba(34,211,238,0.55)", radius: 2 });

  /* ---- Titular ---- */
  T(70, 248, 940, 110, "¿Tu PC no funciona?",
    { font: "Arial Black", size: 82, weight: 900, color: BLANCO, lh: 1.02, preset: "headline" });
  T(70, 370, 940, 50, "Diagnóstico y presupuesto SIN CARGO",
    { size: 36, weight: 800, color: AMBAR, preset: "subhead" });
  T(70, 432, 940, 40, "Reparación rápida, con garantía, en tu casa o en el taller.",
    { size: 26, weight: 400, color: "#94a3b8", preset: "body" });

  /* ---- Servicios: 4 filas × 2 columnas ---- */
  const servicios = [
    ["🖥️", "Reparación de PC y Notebooks"],
    ["⚙️", "Formateo e instalación de Windows"],
    ["🧹", "Limpieza y mantenimiento"],
    ["💾", "Recuperación de datos"],
    ["📦", "Instalación de programas"],
    ["🔧", "Armado y upgrade de equipos"],
    ["🌐", "Redes y WiFi"],
    ["🚀", "Soporte remoto"]
  ];
  servicios.forEach(([icono, texto], i) => {
    const col = i % 2, fila = Math.floor(i / 2);
    const x = 70 + col * 495;
    const y = 520 + fila * 110;
    R(x, y, 445, 86, { fill: CARD_FILL, stroke: CARD_STROKE, sw: 1.5, radius: 18 });
    EM(x + 20, y + 23, 34, icono);
    T(x + 84, y + 14, 340, 56, texto,
      { size: 23, weight: 600, color: "#e2e8f0", preset: "badge" });
  });

  /* ---- Beneficios ---- */
  const beneficios = [["✅", "Diagnóstico sin cargo"], ["🛡️", "Trabajo garantizado"], ["⚡", "Servicio rápido"]];
  beneficios.forEach(([icono, texto], i) => {
    const x = 70 + i * 320;
    R(x, 970, 300, 56, { fill: "rgba(34,211,238,0.10)", stroke: "rgba(34,211,238,0.35)", sw: 1.5, radius: 28 });
    EM(x + 16, 983, 28, icono);
    /* 21 px y no 22: "Diagnóstico sin cargo" mide 222,7 px a 22 y la píldora deja
       224 útiles — un margen de 1 px se corta al mínimo cambio de texto. */
    T(x + 68, 988, 216, 32, texto, { size: 21, weight: 700, color: BLANCO, preset: "badge" });
  });

  /* ---- CTA ---- */
  R(70, 1056, 940, 168, { fill: "#0f2b3d", stroke: CIAN, sw: 2, radius: 26 });
  EM(112, 1086, 36, "💬");
  T(180, 1084, 828, 42, "¡Escribinos por WhatsApp!",
    { size: 30, weight: 800, color: BLANCO, preset: "subhead" });
  T(110, 1132, 900, 64, "+54 9 11 1234-5678",
    { font: "Arial Black", size: 54, weight: 900, color: CIAN, ls: 1, align: "center", preset: "cta" });
  T(110, 1198, 900, 32, "A domicilio  •  Zona: Tu ciudad",
    { size: 24, weight: 400, color: "#cbd5e1", align: "center", preset: "body" });

  /* ---- Footer ---- */
  T(70, 1286, 940, 32, "contacto@wolfit.com   |   www.wolfit.com   |   Lun a Sáb 9–20 h",
    { size: 22, weight: 400, color: "#64748b", align: "center", preset: "caption" });

  return {
    version: SCHEMA_VERSION,
    name: "Servicio Técnico — WOLF IT",
    w: 1080, h: 1350,
    bg: { type: "gradient", c1: "#0a0f1e", c2: "#13233f", angle: 160, src: "" },
    elements: b.els
  };
}

export const TEMPLATES = [
  { id: "wolfit", name: "Servicio Técnico — WOLF IT", build: wolfITTemplate },
  { id: "blank",  name: "Lienzo en blanco",           build: blankTemplate }
];
