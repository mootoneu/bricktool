# Sets Purchase Page

The Sets Purchase page (`purchases.html`) tracks the sets bought by the user. It provides statistics, a detailed purchase list, a card view of purchased sets, and the inventory of the parts of a set.

## Table of Contents

- [Sets Purchase Page](#sets-purchase-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Statistics Tab](#statistics-tab)
  - [Purchases Tab](#purchases-tab)
    - [Filters](#filters)
    - [Columns](#columns)
    - [Add and Edit a Purchase](#add-and-edit-a-purchase)
    - [Sites Column](#sites-column)
  - [Sets Tab](#sets-tab)
  - [Set Inventory Tab](#set-inventory-tab)
  - [Data Relationships](#data-relationships)
  - [Endpoints](#endpoints)

## Page Contents

- **Statistics** tab (default): statistics and charts about the purchases.
- **Purchases** tab: the list of all purchases in a table.
- **Sets** tab: the purchased sets as cards, filtered by purchase year.
- **Set Inventory** tab: the parts of a set and the quantities actually owned.

## Statistics Tab

The tab is computed from the purchase data and only counts **owned** purchases unless stated otherwise.

**Summary cards:**

- Owned sets count.
- Total price of owned sets.
- Total parts of owned sets.
- Not owned sets count, with their total price.

**Donut charts by theme** (owned sets only):

- Sets per theme.
- Price per theme.
- Parts per theme.

The seven largest themes are shown individually and the rest are grouped as "Other themes".

**Per purchase year chart:**

- One bar chart for sets, one for price, and one for total parts.
- The year is the year of the purchase date.
- The chart can be filtered by theme, buyer, and owner.
- Only owned purchases are included.

## Purchases Tab

This tab shows the list of all purchases made by the user. Each row represents a purchased set.

### Filters

| Filter | Matches |
| ------ | ------- |
| Name | Purchase set name (contains, case-insensitive) |
| Number | Set number (contains) |
| Reason | Purchase reason (contains) |
| Year from / Year to | **Release year** of the set |
| Date from / Date to | Purchase date (yyyy/MM/dd) |
| Total parts min / max | Number of parts of the set |
| Theme | Exact theme |
| Vendor | Exact vendor |
| Buyer | Exact buyer |
| Owner | Exact owner |
| Hide not owned | Shows only owned purchases |

"Reset filters" clears every filter. The summary shows "X of Y purchases".

### Columns

| Column | Source | Unit/Format |
| -------- | -------- | ------------- |
| Image | `data/bt/setsimg/$SetNumber.$Ext` (downloaded once from `data.re.sets.img_url`) | Image |
| Purchase Id | `data.bt.PurchasedSet.Id` | |
| Set Number | `data.bt.PurchasedSet.SetNumber` | |
| Name | `data.re.sets.name` | |
| Total parts | `data.re.sets.num_parts` | |
| Year | `data.re.sets.year` | Release year |
| Theme | `data.re.themes.name` | Theme image when available |
| Official Price | `data.bw.SetPrice.LegoPrice` | € |
| Price | `data.bt.PurchasedSet.PurchasePrice` | € |
| Promo | `data.bt.PurchasedSet.PurchasePrice / data.bw.SetPrice.LegoPrice` | % |
| Date | `data.bt.PurchasedSet.PurchaseDate` | yyyy/MM/dd |
| Vendor | `data.bt.PurchasedSet.Vendor` | Image or colored label |
| Buyer | `data.bt.PurchasedSet.BroughtBy` | Image or colored label |
| Owner | `data.bt.PurchasedSet.Owner` | Image or colored label |
| Parts missing | `data.bt.PurchasedSet.PartMissings` | |
| Complete | `1 - (PartMissings / num_parts)` | % |
| Owned? | `data.bt.PurchasedSet.Owned` | Checkbox |
| Reason | `data.bt.PurchasedSet.Reason` | |
| Sites | | "Open" button showing the external websites |
| | | "Inventory" and "Edit" actions |

All columns except Image, Sites, and the actions are sortable. When an official price is missing, the cell shows a sync button that opens the official price dialog, which currently offers Brickonomics as the source.

**Vendor, Buyer, and Owner** are enumerations (see [Enumerations](./DataModel.md#enumerations)). The add/edit form proposes existing values and accepts new ones.

### Add and Edit a Purchase

The "Add purchase" button, or the "Edit" row action, opens the purchase form:

| Field | Notes |
| ----- | ----- |
| Set number | Required |
| Price (€) | Required, two decimals |
| Purchase date | Required, `yyyy/MM/dd` |
| Vendor | Free text with suggestions |
| Buyer | Free text with suggestions |
| Owner | Free text with suggestions |
| Parts missing | Integer, defaults to 0 |
| Owned | Checkbox, checked by default |
| Reason | Free text |

The vendor, buyer, and owner are remembered in cookies and proposed the next time the form is opened.

### Sites Column

The "Open" button opens a modal showing the set name, image, theme, number, parts, official price, and year, followed by:

- A "Save to wishlist" or "Buy" button. Saving adds the set to the wishlist; buying records a purchase and removes the set from the wishlist when it was wishlisted.
- External website links: LEGO, LEGO instructions, Rebrickable, BrickLink, BrickOwl, BrickWatch, Brickonomics, Amazon, Fnac, and CDiscount. Each website is a clickable image that opens the set page in a new tab.
- A link to open the set in the Set Inventory tab.

## Sets Tab

The tab shows the purchased sets as cards, in the same style as the Sets tab of the New Sets page.

**Differences from the New Sets Sets tab:**

- The year filter is the **year the set was purchased**, not its release year.
- The view contains **only purchased sets**.

**Purchase year selector:**

- The dropdown lists every year between the oldest and newest purchase year, including the current year, from newest to oldest.
- The current year is selected by default.
- The previous and next buttons move the selection by one year and can go outside the range of the dropdown; a year without purchases then shows no card.
- Changing the year updates the cards, the theme filter, and the summary.

**Filters:**

- Name (contains, case-insensitive).
- Theme (themes of the purchases of the selected year).
- Official price min and max.
- "Reset filters" clears the filters.

**Cards** show:

- Set image.
- Name.
- Set number, release year, and purchase date.
- Total parts, official price, and price actually paid.
- Theme chip.
- Buyer image or tag.

Cards are sorted by purchase date, most recent first, then by set number. The summary shows "Showing X of Y sets purchased in YEAR". Clicking a card opens the set sites modal.

Each purchase is shown as its own card, so buying the same set twice shows two cards. Purchases marked as not owned are still displayed because they are still purchases.

## Set Inventory Tab

This tab shows the parts of a purchased set and lets the user record which parts are actually owned.

**Toolbar:**

- **Set** selector: the distinct sets among the purchases.
- **Search**: part number, name, category, or color.
- **Hide complete parts**: hides parts whose actual quantity is at least the expected quantity.
- **Clear actual**: sets the actual quantity of every part to 0.
- **Set actual = expected**: copies the expected quantity into the actual quantity.
- **Delete inventory**: removes the stored inventory of the set.

The destructive actions ask for confirmation. The summary shows how many parts are complete and how many pieces are missing.

**Table columns:**

| Column | Notes |
| ------ | ----- |
| Image | Part image in the set color; clicking opens the part information modal |
| Part number | |
| Part name | |
| Category | |
| Color | Color chip |
| Expected qty | From the set inventory |
| Actual qty | Editable number input; saved when changed |
| Status | "Complete" or "N missing" |

Editing the actual quantity saves it immediately with `PUT /api/sets/{setNumber}/inventory/{partNumber}/{colorId}`. The row status and the summary are updated without reloading the page. Invalid values are rejected and the previous value is restored.

The inventory is described in [Set Inventory](./DataModel.md#set-inventory).

## Data Relationships

- `data.bt.PurchasedSet.SetNumber = data.bw.SetPrice.SetNumber`
- `data.bt.PurchasedSet.SetNumber + '-1' = data.re.sets.set_num`
- `data.re.sets.theme_id = data.re.themes.id`

The purchase model is described in [Purchased Sets](./DataModel.md#purchased-sets).

## Endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/purchases` | List purchases with set, theme, price, and image data |
| `GET /api/purchases/options` | Existing vendors, buyers, and owners |
| `POST /api/purchases` | Create a purchase |
| `PUT /api/purchases/{id}` | Update a purchase |
| `GET /api/sets/{setNumber}/inventory` | List the inventory of a set |
| `PUT /api/sets/{setNumber}/inventory/{partNumber}/{colorId}` | Update the actual quantity |
| `POST /api/sets/{setNumber}/inventory/clear` | Clear the actual quantities |
| `POST /api/sets/{setNumber}/inventory/fill` | Set actual quantities to the expected ones |
| `DELETE /api/sets/{setNumber}/inventory` | Delete the stored inventory |
| `GET /api/wishlist` | Used by the set sites modal to detect wishlisted sets |
| `POST /api/wishlist` | Add a set to the wishlist from the set sites modal |
| `DELETE /api/wishlist/{id}` | Remove a set from the wishlist when bought |
