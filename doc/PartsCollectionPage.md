# Parts Collection Page

The Parts Collection page allows the user to track his collection of parts brought, explore all existing parts...

## Table of Contents

- [Parts Collection Page](#parts-collection-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
    - [BrickOwl Page](#brickowl-page)
      - [Part Information Modal](#part-information-modal)

## Page Contents

- Part explorer tab: Shows all existing parts organised by category
- Collection: TBD
- PaB Purchases: Displays the purchases of Pick-a-Brick part boxes and minifig
- PaB Parts Items tab: Displays the parts purchased in Pick-a-Brick Purchases
- BrickOwl tab: Displays all the parts purchased with BrickOwl

### BrickOwl Page

The Parts Collection page gathers BrickOwl items purchased across all orders. Its BrickOwl tab shows one row per part, grouped by BrickOwl item (BOID), type, and condition. Each row displays:

- Part information
- List of orders containing it (each order ID links to the BrickOwl order page)
- Summed quantity over all those orders

Columns are sortable; the Orders column sorts by the number of orders containing the part.

Data is exposed by: `GET /api/brickowl/parts`

#### Part Information Modal

Clicking a part image in the Part explorer, the BrickOwl parts and order items tables, the PaB parts table, or the Set Inventory table opens a modal with the part details:

- Part image, using the part's default color
- Part number, whether it has alternates, and material
- Part name
- Category chip with the category name; clicking it opens the Part explorer tab, expands the matching category group, selects the category, and highlights the part
- Star rating (editable for main parts, read-only otherwise)
- "Add to collection" button (placeholder, no action yet)
- Available colors: every `PartNumber/ColorId` pair of `data.bt.PartColorUrl` is shown as a colored chip. The color currently used for the part image is highlighted; clicking another chip makes it the default image color.

The default color is stored in `data/bt/part_default_color.csv` and is used by `GET /api/parts/{partNumber}/image` when no `colorId` is given. When the part has no stored default, or the stored color is no longer available, the lowest available color is used.

The modal is implemented once in `js/modules/part-info.js` (`BrickTools.PartInfo`) and reused by every page that renders part images.

**Endpoints:**

- `GET /api/parts/{partNumber}/info` - Returns the name, material, alternates, stars, main-part flag, category, default color, and available colors of a part.
- `PUT /api/parts/{partNumber}/default-color` - Stores the default image color. The body is `{ "colorId": 5 }`; the color must be available for the part.