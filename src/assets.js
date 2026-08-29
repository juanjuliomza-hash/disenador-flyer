/* =====================================================================
   assets.js — importación de imágenes con límites de salud
   ---------------------------------------------------------------------
   Antes una sola imagen metía ~2 MB de base64 en el proyecto y el
   autoguardado moría en silencio. Acá se reescala lo que se pasa de
   tamaño ANTES de entrar a la escena. Importa en máquinas con poca RAM.
   ===================================================================== */

import { LIMITS } from "./schema.js";

export async function readImageFile(file){
  if (!file || !/^image\//.test(file.type)){
    throw new Error("Ese archivo no es una imagen.");
  }
  const dataUrl = await fileToDataURL(file);
  const img = await decode(dataUrl);
  const info = { width: img.width, height: img.height, resized: false, originalBytes: file.size };

  const longEdge = Math.max(img.width, img.height);
  const approxBytes = img.width * img.height * 4;          // RGBA decodificado
  const needsResize = longEdge > LIMITS.longEdge || approxBytes > LIMITS.imageMB * 1048576;

  if (!needsResize){
    return { src: dataUrl, ...info };
  }

  const scale = Math.min(
    LIMITS.longEdge / longEdge,
    Math.sqrt((LIMITS.imageMB * 1048576) / approxBytes)
  );
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  /* PNG conserva transparencia; para fotos opacas JPG pesa mucho menos */
  const hasAlpha = /^data:image\/(png|webp|gif)/i.test(dataUrl);
  const out = hasAlpha ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.9);
  return { src: out, width: w, height: h, resized: true, originalBytes: file.size, from: info };
}

function fileToDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}

function decode(src){
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("No se pudo decodificar la imagen."));
    im.src = src;
  });
}

/* Caja inicial para una imagen recién insertada: entra en el lienzo sin deformarse */
export function fitBox(imgW, imgH, sceneW, sceneH){
  const maxW = sceneW * 0.6, maxH = sceneH * 0.6;
  const s = Math.min(maxW / imgW, maxH / imgH, 1);
  return { w: Math.round(imgW * s), h: Math.round(imgH * s) };
}
