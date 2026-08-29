# Diseñador de Flyers — WOLF IT

Editor de flyers y piezas de marketing **local y sin dependencias de red**, en HTML +
JavaScript vanilla sobre [Konva](https://konvajs.org/). Pensado para armar rápido
material de un servicio técnico informático, pero sirve para cualquier marca.

Su particularidad: el proyecto vive como un **`.flyer.json` abierto en tu disco**, así
que se puede editar **hablándole a un agente** (Claude Code) en vez de arrastrando cajas.

---

## Arranque

```bash
abrir.bat
```

Eso levanta un servidor local en `http://localhost:8900` y abre el editor.

> **Necesita servidor, no doble clic.** El editor usa módulos ES y exporta imágenes
> desde canvas; abriéndolo como `file://` el navegador bloquea las dos cosas.
> Si no tenés Python: `npx serve` o cualquier servidor estático sirve igual.

También funciona publicado en **GitHub Pages** sin cambiar nada.

---

## Qué hace

**Lienzo y formatos** — 4:5, 1:1, 9:16, 16:9, A5 y A4 a 300 dpi, o medida libre.

**Elementos** — texto, rectángulo, elipse, línea e imagen, con relleno, borde, radio,
opacidad, rotación, sombra, desenfoque y modos de mezcla.

**Estilos tipográficos** — botones `Headline · Subhead · Kicker · Body · Caption ·
Badge · CTA`. En vez de elegir tamaño y peso a mano, elegís el *rol* del texto y la
escala sale coherente. Se reescalan solos si cambiás el formato del lienzo.

**Guías inteligentes** — al mover un elemento aparecen guías y se imanta a los bordes,
el centro y el margen del lienzo, o a los elementos alineados con él.

**Selección múltiple** — con Shift, con marco de arrastre o `Ctrl+A`. Agrupar con
`Ctrl+G`. Alineación de a varios o contra el lienzo.

**Exportar** — PNG, JPG o WebP a 1x/2x/3x, con fondo normal o transparente, y
**copiar al portapapeles** para pegar directo en WhatsApp o Instagram. También
imprimir/PDF a tamaño real.

**Historial** — deshacer/rehacer por transacciones: un cambio hecho por un agente,
por más piezas que toque, se revierte con un solo `Ctrl+Z`.

**Autoguardado** — en IndexedDB, y avisa si algo falla en vez de perder el trabajo
en silencio. Las imágenes que se suben se reescalan si superan los límites de salud
(8 MB decodificados, 4096 px de lado), para que el proyecto no se infle.

---

## Atajos

| | |
|---|---|
| `V` `H` `T` `R` `E` `L` `I` | seleccionar · mover vista · texto · rectángulo · elipse · línea · imagen |
| `Ctrl+Z` / `Ctrl+Shift+Z` | deshacer / rehacer |
| `Ctrl+D` · `Ctrl+A` · `Ctrl+G` | duplicar · seleccionar todo · agrupar |
| `Ctrl+0` / `Ctrl+1` | ajustar a pantalla / zoom 100 % |
| `[` `]` | bajar / subir una capa |
| flechas (`Shift` = 10 px) | mover |
| `Supr` | eliminar |
| espacio + arrastrar, o rueda | mover la vista (`Ctrl`+rueda = zoom) |

---

## Editar el flyer hablándole a Claude Code

Esta es la parte que reemplaza al servidor MCP de otras herramientas: como el editor
corre local y el proyecto es un archivo común, **Claude Code ya puede editarlo**.

1. En el editor, botón **🔗 Vincular** → elegí dónde guardar el `.flyer.json`.
2. Pedile el cambio a Claude Code, por texto o dictado:
   > *"En `proyecto.flyer.json`, poné el teléfono real +54 9 261 555-1234, cambiá la
   > zona a Mendoza y hacé el titular un poco más chico para que entre en una línea."*
3. El editor detecta que el archivo cambió y **se actualiza solo**.

Lo que edites a mano en el editor se escribe de vuelta al archivo, así que la
sincronización va para los dos lados.

**Por audio:** grabá una nota de voz, pasala por Whisper y mandale el texto a Claude
Code. Cualquier transcriptor sirve.

**Reglas permanentes:** todo lo que escribas en [`PREFERENCIAS-DISENO.md`](PREFERENCIAS-DISENO.md)
se aplica a los diseños siguientes sin repetirlo. Ese archivo es el modelo de diseño.

> Requiere un navegador con File System Access API (Edge o Chrome). En Firefox el
> editor funciona igual, pero hay que guardar y abrir el `.json` a mano.

---

## Estructura

```
index.html              interfaz y estilos
src/
  schema.js             formato del proyecto: versión, migración y validación
  presets.js            formatos de lienzo, escala tipográfica, paleta de marca
  templates.js          plantillas (WOLF IT y lienzo en blanco)
  store.js              estado, historial por transacciones, autoguardado, sync con disco
  stage.js              render con Konva, transformador, guías, zoom y paneo
  exporter.js           PNG/JPG/WebP, portapapeles, impresión
  assets.js             importar imágenes con límites de salud
  main.js               arranque y cableado de la interfaz
vendor/konva.min.js     Konva 9.3.16 (MIT), incluido para que funcione sin red
assets/                 logo y material de la marca
```

### El formato `.flyer.json`

JSON abierto y versionado (`version: 1`). Todo proyecto que entra pasa por migración
y validación, así que los archivos viejos siguen abriendo. Cada elemento tiene
`id`, `type`, posición y tamaño, `data` con lo propio de su tipo, y `fx` con efectos.

---

## Estado

Funciona y está en uso. Pendientes conocidos:

- Fuentes web embebidas (hoy usa las del sistema, así que el diseño puede verse
  distinto en otra máquina).
- Más plantillas: story 9:16, post 1:1, promoción.
- Múltiples mesas de trabajo en un mismo proyecto.
- Generar una plantilla desde un prompt (devolviendo JSON editable, nunca una
  imagen plana: el texto tiene que seguir siendo texto).

## Créditos

- [Konva](https://konvajs.org/) — MIT
- Ideas de interfaz y arquitectura tomadas de [Calqo](https://github.com/kilianvivien/calqo) (MIT):
  un solo renderer para pantalla y exportación, esquema versionado, estilos
  tipográficos por rol, perfil de marca y límites de salud de assets.
- La rúbrica de calidad de `PREFERENCIAS-DISENO.md` viene de
  [poster-generator-skill](https://github.com/howardz27/poster-generator-skill) (MIT).

## Licencia

MIT — ver [LICENSE](LICENSE).
