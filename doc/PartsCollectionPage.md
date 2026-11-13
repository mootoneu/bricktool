# Parts Collection Page

The Parts Collection page (`partscollection.html`) gathers the parts the user owns or has purchased and lets them explore the LEGO part catalogue.

## Table of Contents

- [Parts Collection Page](#parts-collection-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Part Explorer Tab](#part-explorer-tab)
  - [Collection Tab](#collection-tab)
  - [Part Storage Tab](#part-storage-tab)
  - [Storage Drawers Tab](#storage-drawers-tab)
  - [PaB Purchases Tab](#pab-purchases-tab)
  - [PaB Parts Tab](#pab-parts-tab)
  - [BrickOwl Tab](#brickowl-tab)
  - [Part Information Modal](#part-information-modal)
  - [Endpoints](#endpoints)

## Page Contents

- **Part explorer** tab: all existing parts organised by category.
- **Collection** tab: searches the part collection by part number, name, color, category, or tag and shows the matching drawers.
- **Part storage** tab: the physical part storages (furniture, boxes, cabinets, etc.).
- **Storage drawers** tab: one card per drawer with its contents.
- **PaB Purchases** tab: Pick-a-Brick purchases (boxes and minifigures).
- **PaB Parts** tab: the parts bought in a Pick-a-Brick purchase.
- **BrickOwl** tab (default): all parts purchased on BrickOwl, aggregated across orders.

The active container is described in [Common Features](./CommonFeatures.md#active-container).

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
| Has alternates | View icon button opens the alternates modal |
| Stars | 0 to 5, editable; 0 means hidden |
| | Search and Add to container icon buttons |

Filters:

- **Hide parts with 0 stars** (checked by default).
- **Filter this category** narrows the parts already loaded in the selected category (or the search results).
- The count shows "X of Y parts", or "X of Y parts matching ..." in the Search category.

The table is sortable; the default sort is by stars, descending.

**Row actions:**

- **Search** opens the **Collection** tab, fills its search field with the part number, and runs the collection search.
- **Add to container** sends the part to the active container.

**Star rating:** clicking a star saves it with `PUT /api/parts/main-parts/{partNumber}/stars` and the body `{ "stars": 3 }`. The change is reflected immediately.

**Selection:** the checkbox column selects individual parts. A selection toolbar above the table shows how many parts are selected and provides:

- **Select all visible**: adds every part currently shown (after the filters) to the selection.
- **Clear selection**: removes every selected part.
- **Set stars**: the 0-to-5 star buttons apply the rating to every selected part at once with `PUT /api/parts/main-parts/stars` and the body `{ "partNumbers": ["3001", "3002"], "stars": 3 }`.
- **Add to container**: sends every selected part to the active container at once. The same action is used by the row button. When no container is active, a message asks the user to set one from the Collection, Part storage, or Storage drawers tab.

Selecting or clearing a part updates the header checkbox, which is indeterminate when only some visible parts are selected. The selection is kept when sorting or filtering, but it is cleared when the selected category changes (including when a new cross-category search runs).

**Alternates modal:** opens from the View icon button and calls `GET /api/parts/main-parts/{partNumber}/alternates`. It shows the relation type, the child part (number, name, category id, material), and the parent part (number and name). The modal closes with the close icon button, a click outside, or Escape.

**Navigation from the part information modal:** a part can be opened directly with `partscollection.html?explorerCategory=<id>&explorerPart=<number>#explorer`. The page selects the category, expands its group, loads the parts, scrolls to the part, and highlights it. If the part is hidden by the current filters, the filters are cleared so the part becomes visible. The query parameters are removed from the URL after the navigation.

## Collection Tab

The tab searches the part collection and shows the storage drawers that contain matching parts, as well as matching BrickOwl items and PaB parts.

- The search field matches the part number, part name, color name or id, category name or id, and free-text tags. It is case-insensitive and searches after a short delay; pressing Enter searches immediately.
- Results are one card per matching drawer. Each card shows the storage id and drawer label, the storage model and location, and the parts that match the search.
- When a drawer contains several matching parts, up to 200 are shown.
- Each result card has **Set active** (sets the drawer as the active container) and **Add content** (opens the drawer content form) icon buttons. The content rules shown on the card can be edited or deleted in place with icon buttons.
- Setting a drawer active loads the drawer list, so the header navigation can move through the drawers of the storage.
- Below the drawers, two tables list the matching items from the BrickOwl parts and from the PaB parts. They use the same columns as the corresponding tabs and are hidden when they have no match. PaB quantities are summed per part and color across all purchases.
- When nothing matches in any source, a message explains that no drawer, BrickOwl part, or PaB part matches the search.
- The drawer search is exposed by `GET /api/part-collection/drawers?query=`; the other sources are `GET /api/brickowl/parts` and `GET /api/pab/parts`.

## Part Storage Tab

Lists the physical part storages stored in `data/bt/part_storage.csv`.

| Column | Source |
| ------ | ------ |
| Order | `Order` |
| Id | `Id` |
| Model | `Model` (for example "IKEA Alex") |
| Drawers | `DrawersCount` |
| Location | `Location` |
| Description | `Description` |
| Rules | Number of part collection rows attached to the storage |

The table is sorted by **Order** ascending by default; storages with the same order are sorted by id. Click a column header to sort by another column.

Actions:

- **View** (eye icon) opens the **Storage drawers** tab filtered to the storage.
- **Edit** (pencil icon) opens the storage form.
- **Set active** (check icon) makes the storage the active container.

The **Add storage** button opens the same form for a new storage. The form asks for the id, order, model, drawer count, location, and description. The id cannot be changed after creation. The drawer count is between `0` and `52`; drawers are named `a`–`z` for the first 26 and `A`–`Z` for the next 26. A storage with a drawer count of `0` has no drawers and can only be used as a whole container.

**Endpoints:**

- `GET /api/part-storage`
- `POST /api/part-storage`
- `PUT /api/part-storage/{id}`

## Storage Drawers Tab

Shows one card per drawer of the selected storage, including empty drawers. The **Storage** selector lists the part storages; choosing one shows only its drawers.

- Each card shows the storage id, the drawer label, and the storage model and location.
- The drawer label is generated from `DrawersCount`: `a`–`z` for the first 26 drawers, then `A`–`Z` for the next 26, up to 52. Extra labels found in the collection rows are also shown.
- Each content rule of the drawer is displayed with its amount, part images, category chips (`§Category`), tag chips (`#tag`), and color chips. Part images open the part information modal.
- **Add content** opens the content form prefilled with the storage and drawer.
- **Edit** and **Delete** icon buttons change or remove a content rule.
- **Set active** makes the drawer the active container. The header then shows Previous and Next icon buttons to move through the drawers of the storage.

The content form asks for the storage, drawer, parts, colors, and amount:

- **Drawer** is empty for a storage without drawers, or for parts not assigned to a specific drawer. Otherwise it must be one of the storage's labels (`a`–`z`, then `A`–`Z`).
- **Parts** is a semicolon-separated list of `<PartNumber>`, `§<Category>` (numeric id or case-insensitive name), and `#<Tag>` (matched against the part name and number).
- **Colors** is a semicolon-separated list of color ids, `Any`, `Other` (parts not explicitly listed elsewhere), or `Decorated` (printed or patterned parts).
- **Amount** is free text (for example `250`, `100s`, or `many`).

The form also helps to build the **Parts** and **Colors** lists. The helper controls only add or remove tokens; the semicolon-separated inputs remain the values that are saved.

- **Part search** searches the main parts by number or name (`GET /api/parts/main-parts/search`). Choosing a result appends its part number. When the text is not a known main part, **Use part number …** checks `GET /api/parts/{partNumber}/info` and appends the number only if the part exists.
- **Category** is a grouped list of the visible part categories (`GET /api/parts/categories`). **Add category** appends `§<CategoryId>`.
- **Colors** offers `Any`, `Other`, and `Decorated` buttons and **Add color…**, which opens the color picker. A chosen color appends its numeric id.
- The chips below each input show the current tokens and a close icon button that removes one token. Category chips show the category name even though the id is saved. Unknown categories, part numbers, and color ids, and `Any` combined with specific color ids, are reported as non-blocking warnings.

A rule is unique per storage, drawer, parts, and colors. When the same part is added several times to the same drawer with `Any` colors, its amount is incremented.

**Endpoints:**

- `GET /api/part-collection`
- `POST /api/part-collection`
- `PUT /api/part-collection/{index}`
- `DELETE /api/part-collection/{index}`
- `GET /api/part-collection/drawers`
- `POST /api/part-collection/add`

The data models are described in [Part Collection](./DataModel.md#part-collection).

## PaB Purchases Tab

Lists the Pick-a-Brick purchases stored in `data.bt.PaBPurchases`.

| Column | Source |
| ------ | ------ |
| Purchase date | `PurchaseDate` (yyyy/MM/dd) |
| Box quantity | `BoxQuantity` |
| Minifig quantity | `MinifigQuantity` |
| Price | `Price` (€) |
| Total parts | Sum of the quantities of the purchase's parts |

Actions:

- **Parts** opens the PaB Parts tab for that purchase.
- **Edit** (pencil icon) opens the purchase form.
- **Set active** (check icon) makes the purchase the active container; parts added with the Add to container action use the part's default color.

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
- The table shows: category, image, quantity, part name, color chip, part number, and an Edit action.
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
| Total quantity | Summed quantity over all those orders |
| Name | Cleaned to remove "LEGO", the color name, and trailing part numbers |
| Color | Clickable color chip |
| Condition | |
| Orders | List of orders containing the part; each order id links to the BrickOwl order page |
| Design Ids | Comma-separated |
| Item Numbers | Comma-separated |

Columns are sortable. The Orders column sorts by the number of orders containing the part.

Data is exposed by `GET /api/brickowl/parts`.

## Part Information Modal

Clicking a part image in the Part explorer, the BrickOwl parts and order items tables, the PaB parts table, or the Set Inventory table opens a modal with the part details:

- Part image, using the part's default color.
- Part number, whether it has alternates, and material.
- Part name.
- Category chip with the category name; clicking it opens the Part explorer tab, expands the matching category group, selects the category, and highlights the part.
- Star rating (editable for main parts, read-only otherwise).
- Add to container icon button: adds the part to the active container. When no container is active, the modal asks the user to set one from the Parts Collection page.
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
| `GET /api/pab/parts` | List the parts of every PaB purchase |
| `POST /api/pab/purchases/{purchaseId}/parts` | Add a part to a PaB purchase |
| `PUT /api/pab/parts/{id}` | Update a PaB part |
| `GET /api/brickowl/parts` | Aggregated BrickOwl parts |
| `GET /api/part-storage` | List part storages |
| `POST /api/part-storage` | Create a part storage |
| `PUT /api/part-storage/{id}` | Update a part storage |
| `GET /api/part-collection` | List the part collection rules with their file index |
| `POST /api/part-collection` | Create a part collection rule |
| `PUT /api/part-collection/{index}` | Update a part collection rule |
| `DELETE /api/part-collection/{index}` | Delete a part collection rule |
| `GET /api/part-collection/drawers?query=` | One card per drawer, optionally filtered by a part search |
| `POST /api/part-collection/add` | Add parts to the active container |
| `GET /api/le/pab-part-prices` | All LEGO Pick-a-Brick part prices |
| `GET /api/le/pab-part-prices/{designId}` | PaB prices of a design, keyed by color id, in euros |
