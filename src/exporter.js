/* =====================================================================
   exporter.js — PNG / JPG / WebP, copiar al portapapeles, imprimir
   Todo sale del mismo stage de Konva que ves en pantalla.
   ===================================================================== */

import { slug } from "./store.js";
import { CANVAS_PRESETS } from "./presets.js";

export const FORMATS = [
  { id: "png",  label: "PNG",  mime: "image/png",  ext: "png" },
  { id: "jpg",  label: "JPG",  mime: "image/jpeg", ext: "jpg" },
  { id: "webp", label: "WebP", mime: "image/webp", ext: "webp" }
];

/* Nombre descriptivo: proyecto-formato@2x.png (antes era fijo "flyer-wolfit.png") */
export function exportName(scene, fmt, scale){
  const preset = CANVAS_PRESETS.find(p => p.w === scene.w && p.h === scene.h);
  const size = preset ? slug(preset.label.split("·")[1] || preset.id) : `${scene.w}x${scene.h}`;
  const suffix = scale === 1 ? "" : `@${scale}x`;
  return `${slug(scene.name)}-${size}${suffix}.${fmt.ext}`;
}

function download(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
}

export async function exportImage(view, store, { format = "png", scale = 2, transparent = false } = {}){
  const fmt = FORMATS.find(f => f.id === format) || FORMATS[0];
  if (fmt.id === "jpg" && transparent) transparent = false;   // JPG no tiene alfa
  const blob = await view.snapshot({
    pixelRatio: scale,
    mimeType: fmt.mime,
    transparent
  });
  if (!blob) throw new Error("El navegador no pudo generar la imagen.");
  download(blob, exportName(store.scene, fmt, scale));
  return blob;
}

/* Copiar al portapapeles: diseño → WhatsApp/Instagram sin pasar por Descargas.
   El portapapeles solo acepta PNG. */
export async function copyToClipboard(view, { scale = 2, transparent = false } = {}){
  if (!navigator.clipboard || typeof ClipboardItem === "undefined"){
    throw new Error("Tu navegador no permite copiar imágenes al portapapeles.");
  }
  const blob = await view.snapshot({ pixelRatio: scale, mimeType: "image/png", transparent });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  return blob;
}

/* Imprimir / PDF: se manda el PNG a una ventana de impresión con el lienzo
   a tamaño real, para que la escala en papel sea la correcta. */
export async function printSheet(view, store){
  const scene = store.scene;
  const blob = await view.snapshot({ pixelRatio: 2, mimeType: "image/png" });
  const url = URL.createObjectURL(blob);
  const mmW = (scene.w / 300) * 25.4;        // asumimos 300 dpi para imprenta
  const mmH = (scene.h / 300) * 25.4;
  const win = window.open("", "_blank");
  if (!win){ URL.revokeObjectURL(url); throw new Error("El navegador bloqueó la ventana de impresión."); }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>${escapeHtml(scene.name)}</title>
    <style>
      @page { size: ${mmW.toFixed(1)}mm ${mmH.toFixed(1)}mm; margin: 0; }
      html,body { margin:0; padding:0; }
      img { width:${mmW.toFixed(1)}mm; height:${mmH.toFixed(1)}mm; display:block; }
    </style></head><body><img src="${url}"></body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

export function saveProjectFile(store){
  const blob = new Blob([JSON.stringify(store.scene, null, 2)], { type: "application/json" });
  download(blob, slug(store.scene.name) + ".flyer.json");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
