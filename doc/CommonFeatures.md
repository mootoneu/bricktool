# Common Features

This document describes the common features across all pages.

## Table of Contents

- [Common Features](#common-features)
  - [Table of Contents](#table-of-contents)
  - [Colors](#colors)

## Colors

Colors are shared by all pages through `color.js`:

- `BrickColor.getLegoColorId(ext_system, ext_id)` - Resolves an identifier from an external system (`LE`, `BO`, `BL`, `LD`, etc.) to the LEGO color ID used by the application. Reads `data/re/color_mappings.csv` and caches the mapping.
- `BrickColor.getColor(color_id)` - Resolves a color object (`id`, `name`, `rgb`, `isTrans`, `numParts`, `numSets`, `y1`, `y2`) from `data/re/colors.csv`. The file is cached after the first read.
- Both methods return a promise, so they can be called before any color data has been loaded.
- `BrickColor.openColorInfo(color_id)` - Opens a modal showing a chip with the color and a table of the ID and Name used by LEGO (LE), BrickOwl (BO), BrickLink (BL), and LDraw (LD).
- `BrickColor.openColorPicker(current_color_id, onSelect)` - Opens a modal showing the currently selected color with its chip and information, followed by a searchable list of colors. Confirming a choice calls `onSelect` with the selected color object.

The colors are exposed by `GET /api/colors` and the external identifiers by `GET /api/color-mappings`. Both reference files are read once and kept in memory by the server.