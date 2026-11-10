# Sets Purchase Page

The Sets Purchase page provides various tabs to display purchase data, add/edit purchase data, and show statistics about purchases.

## Table of Contents

- [Sets Purchase Page](#sets-purchase-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Sets Purchase List](#sets-purchase-list)

## Page Contents

- Statistics tab: Shows statistics about the sets purchased
- Purchases tab: Displays the list of sets purchased
- Sets tab: Displays the list of sets purchased in a card view grouped per purchase year
- Set Inventory tab: Displays the part of a set and allows to mark which parts are missing

## Sets Purchase List

This tab shows the list of all purchases made by the user. It displays a table where each row represents a purchased set.

**Columns:**

| Column | Source | Unit/Format |
| -------- | -------- | ------------- |
| Purchase Id | data.bt.PurchasedSet.Id | |
| Set Number | data.bt.PurchasedSet.SetNumber | |
| Name | data.re.sets.name | |
| Total parts | data.re.sets.num_parts | |
| Year | data.re.sets.year | |
| Theme | data.re.themes.name | |
| Official Price | data.bw.SetPrice.LegoPrice | € |
| Price | data.bt.PurchasedSet.PurchasePrice | € |
| Promo | data.bt.PurchasedSet.PurchasePrice/data.bw.SetPrice.LegoPrice | % |
| Date | data.bt.PurchasedSet.PurchaseDate | yyyy/MM/dd |
| Vendor | data.bt.PurchasedSet.Vendor | Colored label (enumeration) |
| Buyer | data.bt.PurchasedSet.BroughtBy | Colored label (enumeration) |
| Owner | data.bt.PurchasedSet.Owner | Colored label (enumeration) |
| Parts missing | data.bt.PurchasedSet.PartMissings | |
| Complete | 1 - (data.bt.PurchasedSet.PartMissings / data.re.sets.num_parts) | % |
| Owned? | data.bt.PurchasedSet.Owned | Checkbox |
| Reason | data.bt.PurchasedSet.Reason | |
| Sites | | Open button showing external websites for the set |
| Image | data/bt/setsimg/$SetNumber.$Ext (downloaded once from data.re.sets.img_url) | Image |

**Vendor, Buyer, and Owner:**

- These are enumerations (see [./doc/DataModel.md](./doc/DataModel.md#enumerations))
- The add/edit form proposes existing values and accepts new ones

**Sites Column:**

- Opens a modal showing: set name, image, theme, number, parts, official price, and year
- Followed by a "Save to wishlist" or "Buy" button
- External websites: LEGO, LEGO instructions, Rebrickable, BrickLink, BrickOwl, BrickWatch, Brickonomics, Amazon, Fnac, and CDiscount
- Each website is a clickable image that opens the set page in a new tab
- The action button saves the set to the wishlist, or buys and removes it from the wishlist when already wishlisted

**Data Relationships:**

- `data.bt.PurchasedSet.SetNumber = data.bw.SetPrice.SetNumber`
- `data.bt.PurchasedSet.SetNumber + '-1' = data.re.sets.set_num`
- `data.re.sets.theme_id = data.re.themes.id`