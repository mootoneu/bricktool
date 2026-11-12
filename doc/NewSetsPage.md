# New Sets Page

The New Sets page (`newsets.html`) presents recently released sets and a shared wishlist. The catalogue is built from `data.re.sets` for a single release year. The current year is selected by default.

## Table of Contents

- [New Sets Page](#new-sets-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Common Features](#common-features)
  - [Themes Tab](#themes-tab)
  - [Sets Tab](#sets-tab)
  - [Wishlist Tab](#wishlist-tab)
    - [Wishlist Actions](#wishlist-actions)
    - [Wishlist Data](#wishlist-data)
  - [Endpoints](#endpoints)

## Page Contents

- **Themes** tab (default): the themes that have sets in the selected year, grouped by root theme by default.
- **Sets** tab: all LEGO sets of the selected year, highlighting purchased and wishlisted sets.
- **Wishlist** tab: all wishlisted sets and their expected buyer.

## Common Features

- A year selector with previous and next icon buttons at the top of the page.
- Clicking the selected year opens a descending list of years from the current (or selected) year down to 1970.
- Active filters are kept when the year changes.
- Themes whose `hidden` column is true in `data/bt/themes.csv` are excluded from the catalogue.
- Hidden themes are still resolved for existing wishlist entries, so an old wishlist entry keeps its theme name.
- Sets matching the default exclusions are hidden from the Sets tab:
  - Sets without parts (`num_parts` empty or 0).
  - Set numbers with 7 characters or more.
  - Set numbers starting with `L` or `2D` (mini sets).
- The selected tab is restored from the URL hash or `localStorage`; see [Tabs](./CommonFeatures.md#tabs).

## Themes Tab

All themes having sets in the selected year, ordered alphabetically. Each theme is a card showing the theme image on its `data.bt.themes.color_primary` background, with the theme name below the image (or alone when the theme has no image).

A "Group by root theme" checkbox (checked by default) groups subthemes under their root theme. Clicking a card opens the Sets tab filtered on that theme.

## Sets Tab

All sets of the selected year as cards with:

- Set image.
- Name.
- Number and year.
- Total parts.
- Official price (with a button to fetch it when missing).
- Theme chip.
- Button to add or remove the set from the wishlist (add or delete icon).

**Filters:**

- Name (contains, case-insensitive).
- Theme.
- Official price min and max.
- Status: **New**, **Purchased**, and **Wishlisted** (all checked by default).

A set is:

- **Purchased** when it appears in the purchases.
- **Wishlisted** when it appears in the wishlist.
- **New** when it is neither purchased nor wishlisted.

Wishlisted sets have a yellow card and purchased sets a green card; a set that is both is shown green.

The cards are loaded progressively: 48 at a time, and more are loaded when the loader at the bottom becomes visible (infinite scroll). The summary shows how many cards are rendered out of the matching sets.

Clicking a card opens the set sites modal described in [Sites Column](./SetPurchasePage.md#sites-column).

## Wishlist Tab

Wishlisted sets in a table with:

- Image.
- Set number.
- Name.
- Year.
- Total parts.
- Theme.
- Official price.
- Member (the family member who wants the set).
- Buyer (the family member who should buy the set, optional).
- Priority.
- Wishlist date.
- Actions.

The table is sortable and can be filtered by name (also matches the set number), theme, member, priority, and official price. The summary shows "X of Y set(s) in wishlist".

### Wishlist Actions

Each row has four actions:

- **Open**: opens the set sites modal.
- **Buy**: records a purchase and removes the set from the wishlist.
- **Edit**: opens the wishlist form.
- **Delete**: removes the entry after confirmation.

**Buy** asks for confirmation, showing the set name and price. It creates a purchase with:

- the set number,
- the official price of the set when it is known (the confirmation shows "no official price" otherwise),
- today's date as purchase date,
- the wishlist member as owner,
- no vendor or buyer,
- no missing parts,
- owned = true.

The set is then removed from the wishlist and the browser navigates to `purchases.html#list`.

**Add to wishlist** creates an entry dated today. From the Sets tab it has no member, priority `Medium`, and no buyer; the wishlist form can then be used to complete it. From the set sites modal, the member, priority, and buyer default to the values remembered in cookies, falling back to the first available member and to `Medium` priority.

The wishlist form contains the member, buyer, priority, and wishlist date. The member, priority, and buyer are remembered in cookies and proposed for the next entry.

### Wishlist Data

- Official prices come from `data.bw.SetPrice`.
- A set without a stored official price shows an empty price cell until its price is fetched from the Administration page or with the button on its card.
- Wishlist data model is described in [Wishlist](./DataModel.md#wishlist).

## Endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/newsets?year={year}` | Sets and themes of a release year, with purchase and wishlist flags |
| `GET /api/wishlist` | List wishlist entries |
| `GET /api/wishlist/options` | Existing members and priorities |
| `POST /api/wishlist` | Add a set to the wishlist |
| `PUT /api/wishlist/{id}` | Update a wishlist entry |
| `DELETE /api/wishlist/{id}` | Remove a wishlist entry |
| `POST /api/purchases` | Record a purchase when buying a wishlist entry |
