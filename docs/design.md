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

## Sincronización (2026-10-01, segunda versión del sistema)
- **Modo oscuro del sistema:** página `#111`, texto blanco, secundario `#B3B3B3`,
  rellenos y divisores `#2A2A2A`, botones en morado de marca y texto de acento
  lavanda `#C6A7F7`. Reemplaza el oscuro con tinte morado que habíamos derivado.
- **Colores de feedback** (`--feedback-success/warning/error/info`) solo en
  insignias: los veredictos de Salud usan una tarjeta gris neutra con una sola
  insignia saturada, como el sistema.
- **StatusChip** (gris, 4 px, 13 medium) para las etiquetas de Motivos.
- **Secciones** con ~28 px de padding vertical (`--section-pad-y`).
- Sin mayúsculas sostenidas (sentence case en todo).
- Componentes base (Button, ListRow, TileButton, Card…) sin cambios en el sistema.

## Adaptaciones propias
- Colores para entradas/salidas y texto de estado, oscurecidos a partir de los
  colores de feedback para pasar contraste AA como texto.
- Fondo propio para el toast en oscuro (`--surface-toast`), para que no se
  pierda sobre `#111`.
- Números tabulares para montos.
- Botón flotante "+" (único elemento con sombra, junto con los sheets).

## Lo que NO se usa
- Logo, ilustraciones 3D e ilustraciones NuIS (spot, feature, editorial):
  son activos de marca de Nubank.
  El icono de la app es propio (`scripts/gen-icons.mjs`).
