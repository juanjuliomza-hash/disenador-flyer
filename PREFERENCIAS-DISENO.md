# Preferencias de diseño

Este archivo es **el modelo de diseño**: acá se escribe, en castellano común, cómo
tienen que ser los flyers. Claude Code lo lee antes de tocar un proyecto, así que
cada regla que agregues acá se aplica sola de la próxima vez en adelante.

> **Cómo usarlo**
> - Escribí directo en las secciones de abajo. No hace falta formato especial.
> - Por audio: grabá una nota de voz, pasala por Whisper y pegá el texto acá
>   (o pedile a Claude Code que lo haga).
> - Si una regla deja de servir, borrala. Este archivo se corrige, no se acumula.
> - Lo que está en **REGLAS DURAS** no se negocia; el resto es preferencia.

---

## Marca

- Nombre: **WOLF IT**
- Rubro: servicio técnico informático
- Logo: `assets/Mr.-Wolf.webp`
- Tono: directo, cercano, sin vueltas. Hablar de vos (argentino), no de tú.
- El cliente típico no es técnico: nada de jerga.

## Colores

> ⚠️ **Decisión pendiente.** La guía de marca (`assets/Flyer.png`) define unos colores
> y la plantilla actual usa otros. Hay que elegir una sola familia.

**Oficiales, según la guía de marca:**

- Azules: `#0D1B3D` · `#102A54` · `#153E75` · `#1B5DBF` · `#1976D2`
  (la guía recomienda **`#102A54` o `#153E75`** como base).
- Amarillo `#FFD600` — para destacar palabras importantes.
- Naranja `#FF8C00` — acentos y llamados visuales.
- Textos: blanco `#FFFFFF`, gris claro `#E0E0E0`.

**Lo que usa hoy la plantilla** (no está en la guía): fondo `#0a0f1e`→`#13233f`,
cian `#22d3ee`, ámbar `#fbbf24`.

Las dos familias están cargadas en el panel *Paleta de marca*. Cuando decidas,
borrá de acá la que no va y pedile a Claude Code que pase la plantilla a esa.

- Regla que sí vale ya: **un solo color de acento por pieza**.

## Tipografía

- Titulares: Arial Black (preset **Headline**).
- Texto: Segoe UI (presets **Body**, **Caption**).
- Teléfono y llamados a la acción: preset **CTA**.
- Usar SIEMPRE los presets tipográficos del panel, no tamaños a mano: mantienen
  la escala coherente y se reescalan solos si cambia el formato del lienzo.

## Composición

- Margen de seguridad: **70 px** en un lienzo de 1080 de ancho (proporcional en otros).
  Nada importante fuera de ese margen.
- Un solo mensaje principal por flyer.
- Jerarquía: titular → beneficio → servicios → CTA → datos de contacto.
- El teléfono tiene que ser el segundo elemento más grande, después del titular.

## REGLAS DURAS

- El teléfono y el email nunca van en una imagen generada por IA: se escriben
  como texto real, editable.
- Nunca inventar datos de contacto, precios, promociones ni plazos.
- No usar logos ni marcas de terceros (Windows, Intel, etc.) sin permiso.
- Máximo 8 servicios listados. Si hay más, se elige.

## Qué evitar

<!-- Anotá acá lo que no te gusta cuando lo veas. Ejemplos para arrancar: -->

- Flyers cargados de texto.
- Más de dos colores de acento en la misma pieza.
- Emojis en piezas serias (presupuestos, comunicados). Sí en flyers de servicios.

## Notas sueltas

<!-- Espacio libre: dictá acá lo que se te ocurra y después lo ordenamos. -->

---

# Chequeo de calidad

Antes de dar un flyer por terminado, tiene que cumplir **las 8**.
(Adaptado de la rúbrica de [poster-generator-skill](https://github.com/howardz27/poster-generator-skill), MIT.)

1. Se entiende de una cuál es el mensaje principal.
2. El orden de lectura es obvio.
3. El titular y los datos clave se leen sin esfuerzo.
4. Hay balance y el espacio vacío es intencional, no sobra.
5. La tipografía parece elegida, no puesta al azar.
6. Hay un punto focal claro, sin elementos peleándose.
7. El estilo es coherente de arriba a abajo.
8. Funciona en el formato y el canal donde se va a publicar.

**Modos de falla más comunes** (si el flyer falla, suele ser por uno de estos):
demasiado texto · dos ideas visuales compitiendo · contraste insuficiente ·
cara de plantilla genérica · datos falsos o texto ilegible.
