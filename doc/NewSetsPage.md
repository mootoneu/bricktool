# New Sets Page

The New Sets page presents recently released sets and a shared wishlist. The catalog is built from `data.re.sets` for a single release year. The current year is selected by default.

## Table of Contents

- [New Sets Page](#new-sets-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Common Features](#common-features)
  - [Themes Tab](#themes-tab)
  - [Sets Tab](#sets-tab)
  - [Wishlist Tab](#wishlist-tab)
    - [Wishlist Data](#wishlist-data)

## Page Contents

- Themes tab: Shows all Lego main themes or all subthemes
- Sets tab: Shows all Lego sets and highlight purchased and wishlisted sets
- Wishlist tab: Shows all wishlisted sets and their expected buyer

## Common Features

- Year selector with previous and next buttons at the top of the page
- Clicking the selected year opens a descending list of years from current year down to 1970
- Active filters are kept when the year changes
- Themes whose `hidden` column is true in `data/bt/themes.csv` are excluded from the catalog
- Hidden themes are still resolved for existing wishlist entries

**Page Tabs:**

## Themes Tab

All themes having sets in the selected year, ordered alphabetically. Each theme is a card showing the theme image on its `data.bt.themes.color_primary` background. When a theme has no image, its name is displayed instead. Clicking a card opens the Sets tab filtered on that theme.

## Sets Tab

All sets of the selected year as cards with:

- Set image
- Name
- Number
- Year
- Total parts
- Official price
- Theme image
- Button to add/remove the set from the wishlist

   Cards can be filtered by: name, theme, and official price, and by status (New, Purchased, Wishlisted). Wishlisted sets have a yellow card, purchased sets a green card; a set that is both is shown green.

## Wishlist Tab

Wishlisted sets in a table with:

- Name
- Year
- Total parts
- Theme image
- Official price
- Member
- Buyer
- Priority
- Wishlist date

The buyer is the family member who should buy the set in the future and is optional. The table can be filtered by: name, theme, member, priority, and official price. Each row can be edited, deleted, or bought. Buy records the set as a purchase using its official price, today's date, and the wishlist member as owner, then removes it from the wishlist and opens the Sets Purchase list.

### Wishlist Data

- Official prices come from `data.bw.SetPrice`
- A set without a stored official price shows a dash until its price is fetched from the Administration page
- Wishlist data model is described in [./doc/DataModel.md](./doc/DataModel.md#wishlist-data)
