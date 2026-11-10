# Common Features

This document describes the behaviour shared by every page of Brick Tools.

## Table of Contents

- [Common Features](#common-features)
  - [Table of Contents](#table-of-contents)
  - [Application Header](#application-header)
  - [Landing Page and Last Page](#landing-page-and-last-page)
  - [Tabs](#tabs)
  - [Formatting](#formatting)
  - [API Access](#api-access)
  - [Tables](#tables)
  - [People, Vendors, and Tags](#people-vendors-and-tags)
  - [Part Images](#part-images)
  - [Colors](#colors)
  - [Remembered Form Values](#remembered-form-values)

## Application Header

`js/common.js` builds the header of every page through `BrickTools.initHeader(activeId)`:

- **Brand** link: returns to `index.html?home=1`.
- **Navigation**: Sets Purchase, BrickOwl, Parts Collection, New Sets, and Administration. The current page is highlighted.
- **Notifications**: a bell button with a badge. Clicking it opens a dropdown listing the notifications returned by `GET /api/notifications`. Each notification is a link; when there are none, "No notifications" is shown.
- Notifications are reloaded every five minutes.

## Landing Page and Last Page

The landing page (`index.html`) shows one card per feature page.

The last visited feature page is stored in `localStorage` under `bricktools.lastPage`. When the landing page is opened without `?home=1`, it redirects to that page. Use `index.html?home=1` to force the landing page.

## Tabs

`BrickTools.initTabs('main', onChange)` manages the tab bars:

- Clicking a tab shows the matching `[data-panel]` and hides the others.
- The selected tab is stored per page path in `localStorage` under `bricktools.tab.<path>` and written to the URL hash (for example `purchases.html#sets`).
- On load, the URL hash has priority; otherwise the stored tab is restored. If neither exists, the page's default tab is used.
- `onChange(name)` is called after a tab is activated. Pages use it to lazy-load the data of the newly visible tab.
- Deep links such as `purchases.html#list` and `partscollection.html#explorer` work directly.

## Formatting

`BrickTools.fmt` formats values with the French locale:

| Helper | Example |
| ------ | ------- |
| `fmt.money(value)` | `12,34 €` |
| `fmt.number(value)` | `1 234` |
| `fmt.percent(value)` | `75 %` |

`null`, `undefined`, and empty strings are rendered as an empty string.

## API Access

All pages call the REST API through `BrickTools.api(method, url, body)`:

- The `/api` prefix is added automatically.
- `GET` requests use `cache: false` so the browser does not reuse a cached response.
- A JSON body is sent as `application/json` when `body` is provided.
- `BrickTools.errorOf(xhr)` returns the server error (`responseJSON.error`) or the HTTP status text for display.

The OpenAPI description is available from the Administration page and at `/swagger-ui/index.html` and `/v3/api-docs`.

## Tables

Data tables follow the same conventions:

- A `th.sortable[data-key]` header sorts the table. The sort direction is shown with the `sort-asc` or `sort-desc` class.
- Sorting compares numbers numerically and text with `localeCompare(..., { numeric: true })`, so `2` comes before `10`.
- Empty results show a single muted row explaining why (no data or no match).
- Row actions are placed in the last column (`actions-col` / `row-actions`).

## People, Vendors, and Tags

Vendors, buyers, owners, and wishlist members are plain names in the CSV data. They are displayed as:

- An image with a colored border when a matching image exists (`vendorimg`, `peopleimg` endpoints).
- Otherwise a colored tag generated from the name by `BrickTools.tag(value)`. The color is deterministic, so the same name always gets the same color.

The purchase form proposes existing values through `datalist` elements and accepts new ones. The wishlist form proposes the people listed in `data/other/people/people.csv` and the allowed priorities through `select` elements.

## Part Images

`BrickTools.partImageCell(sources, label, partNumber)` renders a lazy-loaded part image:

- Several image sources can be given; the next one is tried when an image fails to load.
- When a part number is provided, the image becomes a button that opens the part information modal.
- BrickOwl items first try the exact part/color image of their item numbers, then the generic image of their first design ID.

See [Part Information Modal](./PartsCollectionPage.md#part-information-modal) for the modal contents.

## Colors

Colors are shared by all pages through `color.js`:

- `BrickColor.getLegoColorId(ext_system, ext_id)` - Resolves an identifier from an external system (`LE`, `BO`, `BL`, `LD`, etc.) to the LEGO color ID used by the application. Reads `data/re/color_mappings.csv` and caches the mapping.
- `BrickColor.getColor(color_id)` - Resolves a color object (`id`, `name`, `rgb`, `isTrans`, `numParts`, `numSets`, `y1`, `y2`) from `data/re/colors.csv`. The file is cached after the first read.
- Both methods return a promise, so they can be called before any color data has been loaded.
- `BrickColor.openColorInfo(color_id)` - Opens a modal showing a chip with the color and a table of the ID and Name used by LEGO (LE), BrickOwl (BO), BrickLink (BL), and LDraw (LD).
- `BrickColor.openColorPicker(current_color_id, onSelect)` - Opens a modal showing the currently selected color with its chip and information, followed by a searchable list of colors. Confirming a choice calls `onSelect` with the selected color object.

The colors are exposed by `GET /api/colors` and the external identifiers by `GET /api/color-mappings`. Both reference files are read once and kept in memory by the server.

Color chips in the PaB parts and BrickOwl item tables are clickable and open the color information modal. The Set Inventory color chip is informational only.

## Remembered Form Values

Some forms remember their last values in cookies so that repeated entries are faster:

- Purchase form: vendor, buyer, and owner (`purchaseVendor`, `purchaseBroughtBy`, `purchaseOwner`).
- Wishlist form: member, priority, and buyer (`wishlistMember`, `wishlistPriority`, `wishlistBuyer`).

Cookies are written with a one-year lifetime and `SameSite=Lax`.
