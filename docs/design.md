# Diseño

Basado en el proyecto **"Nu Design System"** de Claude Design
(`claude.ai/design/p/4dce6a1b-fa1c-425b-89d1-2f2f4e34b9ab`), adaptado a una app
personal de finanzas. Los tokens viven en `src/theme/tokens.css`.

## Lo que se toma del sistema
- Un solo color de marca: morado `#820AD1` (hero, botones primarios, selección).
  `#9436E2` solo sobre el hero (tarjetas del hero).
- Hanken Grotesk (sustituto OFL de la tipografía original), vía `next/font`.
- Escala tipográfica: título 28 semibold, sección 20 medium, saldo 36 bold.
- Margen de pantalla 24 px; botones en píldora; tarjetas 16 px; tiles 20 px.
- Plano: sin sombras ni gradientes; jerarquía por contraste de relleno
  (`#EFEFEF`) y separadores de 2 px.
- Iconos de contorno (Lucide, trazo 1.75).
- Estados: presionado = opacidad .72 + escala .98; seleccionado = punto morado.
- Voz en "tú", sentence case, sin emoji.

## Adaptaciones propias
- Colores semánticos para entradas/salidas y semáforo de salud (contraste AA).
- Tema oscuro derivado de la escala morada (el sistema original solo es claro).
- Números tabulares para montos.
- Botón flotante "+" (único elemento con sombra, junto con los sheets).

## Lo que NO se usa
- Logo e ilustraciones 3D de Nu: son activos de marca de un tercero.
  El icono de la app es propio (`scripts/gen-icons.mjs`).
