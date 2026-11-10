# Parts Collection Page

The Parts Collection page (`partscollection.html`) gathers the parts the user owns or has purchased and lets them explore the LEGO part catalogue.

## Table of Contents

- [Parts Collection Page](#parts-collection-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Part Explorer Tab](#part-explorer-tab)
  - [Collection Tab](#collection-tab)
  - [PaB Purchases Tab](#pab-purchases-tab)
  - [PaB Parts Tab](#pab-parts-tab)
  - [BrickOwl Tab](#brickowl-tab)
  - [Part Information Modal](#part-information-modal)
  - [Endpoints](#endpoints)

## Page Contents

- **Part explorer** tab: all existing parts organised by category.
- **Collection** tab: placeholder for the future parts collection.
- **PaB Purchases** tab: Pick-a-Brick purchases (boxes and minifigures).
- **PaB Parts** tab: the parts bought in a Pick-a-Brick purchase.
- **BrickOwl** tab (default): all parts purchased on BrickOwl, aggregated across orders.

## Part Explorer Tab

The explorer is split into a category tree on the left and a main-parts table on the right.

**Category tree:**

- Loaded from `GET /api/parts/categories`.
- A **Search** entry is always shown at the top of the tree. It is a fake category that holds the results of a search across all categories.
- Categories are grouped by part-category group. A group with a single category is shown directly; larger groups are collapsible `<details>` elements.
- Clicking a category selects it (highlighted) and loads its main parts.

**Search field:**

- The field above the category tree searches the part number and name in all categories, including categories that are collapsed.
- Typing selects the fake **Search** category automatically and lists the matching parts after a short delay; pressing Enter searches immediately.
- The search is case-insensitive and matches fragments of the part number or name.
- The API returns at most 500 parts and reports the total number of matches. The count line shows how many parts are displayed out of the total, and mentions when only the first results are loaded.
- When the field is empty, the Search category asks for a part number or name.
- The results table adds a **Category** column so the category of each part is visible.

**Main parts table:**

| Column | Notes |
| ------ | ----- |
| Select | Selection checkbox; the header checkbox selects or clears all visible parts |
| Image | Clicking opens the part information modal |
| Part number | |
| Name | |
| Category | Shown only in the Search category |
| Material | |
| Has alternates | "View" button opens the alternates modal |
| Stars | 0 to 5, editable; 0 means hidden |
| | "Add to collection" button (placeholder) |

Filters:

- **Hide parts with 0 stars** (checked by default).
- **Filter this category** narrows the parts already loaded in the selected category (or the search results).
- The count shows "X of Y parts", or "X of Y parts matching ..." in the Search category.

The table is sortable; the default sort is by stars, descending.

**Star rating:** clicking a star saves it with `PUT /api/parts/main-parts/{partNumber}/stars` and the body `{ "stars": 3 }`. The change is reflected immediately.

**Selection:** the checkbox column selects individual parts. A selection toolbar above the table shows how many parts are selected and provides:

- **Select all visible**: adds every part currently shown (after the filters) to the selection.
- **Clear selection**: removes every selected part.
- **Set stars**: the 0-to-5 star buttons apply the rating to every selected part at once with `PUT /api/parts/main-parts/stars` and the body `{ "partNumbers": ["3001", "3002"], "stars": 3 }`.
- **Add to collection**: applies the (currently placeholder) add-to-collection action to every selected part at once. The same action is used by the row button.

Selecting or clearing a part updates the header checkbox, which is indeterminate when only some visible parts are selected. The selection is kept when sorting or filtering, but it is cleared when the selected category changes (including when a new cross-category search runs).

**Alternates modal:** opens from the "View" button and calls `GET /api/parts/main-parts/{partNumber}/alternates`. It shows the relation type, the child part (number, name, category id, material), and the parent part (number and name). The modal closes with the close button, a click outside, or Escape.

**Navigation from the part information modal:** a part can be opened directly with `partscollection.html?explorerCategory=<id>&explorerPart=<number>#explorer`. The page selects the category, expands its group, loads the parts, scrolls to the part, and highlights it. If the part is hidden by the current filters, the filters are cleared so the part becomes visible. The query parameters are removed from the URL after the navigation.

## Collection Tab

The tab is a placeholder and currently displays "Collection — empty.".

## PaB Purchases Tab

Lists the Pick-a-Brick purchases stored in `data.bt.PaBPurchases`.

| Column | Source |
| ------ | ------ |
| Id | `Id` |
| Purchase date | `PurchaseDate` (yyyy/MM/dd) |
| Box quantity | `BoxQuantity` |
| Minifig quantity | `MinifigQuantity` |
| Price | `Price` (€) |
| Total parts | Sum of the quantities of the purchase's parts |

Actions:

- **Parts** opens the PaB Parts tab for that purchase.
- **Edit** opens the purchase form.

The **Add new purchase** button opens a form with the purchase date (defaults to today), box quantity, minifigure quantity, and price. The same form is used to edit an existing purchase.

**Endpoints:**

- `GET /api/pab/purchases`
- `POST /api/pab/purchases`
- `PUT /api/pab/purchases/{id}`

## PaB Parts Tab

Shows the parts of the selected PaB purchase.

- The **Purchase** selector lists every PaB purchase as `date (#id)`. It is disabled when no purchase exists.
- The **Previous** and **Next** buttons move the selection by one purchase in the selector order and load its parts. They are disabled at the first and last purchase, and both are disabled when no purchase exists.
- **Add part** opens the part form for the selected purchase.
- The table shows: image, Id, purchase Id, part number, part name, category, color chip, quantity, and an Edit action.
- The color chip is clickable and opens the color information modal.
- The part image uses the purchased color and opens the part information modal when clicked.

The part form asks for the part number, color id, and quantity.

**Endpoints:**

- `GET /api/pab/purchases/{purchaseId}/parts`
- `POST /api/pab/purchases/{purchaseId}/parts`
- `PUT /api/pab/parts/{id}`

The data models are described in [Pick-a-Brick Purchases](./DataModel.md#pick-a-brick-purchases).

## BrickOwl Tab

The tab gathers the BrickOwl items purchased across all orders. It shows one row per part, grouped by BrickOwl item (BOID), type, and condition.

| Column | Notes |
| ------ | ----- |
| Image | Part/color image with fallbacks; clicking opens the part information modal |
| Type | Part, minifig, set, etc. |
| Name | Cleaned to remove "LEGO", the color name, and trailing part numbers |
| Color | Clickable color chip |
| Design ids | Comma-separated |
| Item numbers | Comma-separated |
| Condition | |
| Orders | List of orders containing the part; each order id links to the BrickOwl order page |
| Total quantity | Summed quantity over all those orders |

Columns are sortable. The Orders column sorts by the number of orders containing the part.

Data is exposed by `GET /api/brickowl/parts`.

## Part Information Modal

Clicking a part image in the Part explorer, the BrickOwl parts and order items tables, the PaB parts table, or the Set Inventory table opens a modal with the part details:

- Part image, using the part's default color.
- Part number, whether it has alternates, and material.
- Part name.
- Category chip with the category name; clicking it opens the Part explorer tab, expands the matching category group, selects the category, and highlights the part.
- Star rating (editable for main parts, read-only otherwise).
- "Add to collection" button (placeholder, no action yet).
- Available colors: every `PartNumber/ColorId` pair of `data.bt.PartColorUrl` is shown as a colored chip. The color currently used for the part image is highlighted; clicking another chip makes it the default image color.

The default color is stored in `data/bt/part_default_color.csv` and is used by `GET /api/parts/{partNumber}/image` when no `colorId` is given. When the part has no stored default, or the stored color is no longer available, the lowest available color is used.

The modal is implemented once in `js/modules/part-info.js` (`BrickTools.PartInfo`) and reused by every page that renders part images.

## Endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/parts/categories` | Part category tree used by the explorer |
| `GET /api/parts/categories/{categoryId}/main-parts` | Main parts of a category |
| `GET /api/parts/main-parts/search?query=` | Search main parts by number or name across all categories (at most 500 results) |
| `PUT /api/parts/main-parts/{partNumber}/stars` | Save a star rating |
| `PUT /api/parts/main-parts/stars` | Save the same star rating for several parts; body `{ "partNumbers": [...], "stars": 3 }` |
| `GET /api/parts/main-parts/{partNumber}/alternates` | Alternates of a main part |
| `GET /api/parts/{partNumber}/info` | Name, material, alternates, stars, main-part flag, category, default color, and available colors |
| `PUT /api/parts/{partNumber}/default-color` | Store the default image color; body `{ "colorId": 5 }` |
| `GET /api/parts/{partNumber}/image` | Part image, optionally with `?colorId=` |
| `GET /api/parts/items/{itemNumber}/image` | Part image by BrickOwl item number |
| `GET /api/pab/purchases` | List PaB purchases |
| `POST /api/pab/purchases` | Create a PaB purchase |
| `PUT /api/pab/purchases/{id}` | Update a PaB purchase |
| `GET /api/pab/purchases/{purchaseId}/parts` | List the parts of a PaB purchase |
| `POST /api/pab/purchases/{purchaseId}/parts` | Add a part to a PaB purchase |
| `PUT /api/pab/parts/{id}` | Update a PaB part |
| `GET /api/brickowl/parts` | Aggregated BrickOwl parts |
| `GET /api/le/pab-part-prices` | All LEGO Pick-a-Brick part prices |
| `GET /api/le/pab-part-prices/{designId}` | PaB prices of a design, keyed by color id, in euros |
