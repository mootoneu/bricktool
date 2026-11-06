# Data Model definition

This document describe the data models functionnaly

## Lego data

### Lego data providers

There are several data provider for Lego data .
Here a table of provider name and its corresponding 2 letter code

| ProviderName | ProviderId |
| Bricktools | bt |
| LEGO | le |
| Rebrickable | re |
| Brickset | bs |
| BrickLink | bl |
| BrickOwl | bo |
| BrickWatch | bw |
| LDraw | ld |

Data originating from a data provider will be stored in the data folder at the path data/$ProviderId/$File.$Ext where $ProviderId correspond to the 2 letter code in the table above and $File is the file name and $Ext is its extension (generaly csv).
To reference a data model, data.$ProviderId.$DataModel where $DataModel is the data model name
For example the Rebrickable data model for describing Lego Sets will be stored at data/re/sets.csv and be referenced by data.re.sets

#### Rebrickable data

Rebrickable provide a zip of csv containing the most comprehensive data model.
The ZIP can be downloaded from the url <https://rebrickable.com/downloads/> once a day at most.
Once downloaded it the csv files must be unzipped into the Data folder at data/re

##### data.re.themes

| Column | Type |
| ---------- | ---------- |
| id | integer |
| name | string |
| parent_id | integer (FK → themes.id) |

##### data.re.sets

| Column | Type |
| ---------- | ---------- |
| set_num | string (PK) |
| name | string |
| year | integer |
| theme_id | integer (FK → themes.id) |
| num_parts | integer |

Relationships:
- themes.id → sets.theme_id

##### data.re.colors

| Column | Type |
| ---------- | ---------- |
| id | integer (PK) |
| name | string |
| rgb | string |
| is_trans | boolean |
| num_parts | integer |
| num_sets | integer |
| y1 | integer |
| y2 | integer |

##### data.re.part_categories

| Column | Type |
| ---------- | ---------- |
| id | integer (PK) |
| name | string |

##### data.re.parts

| Column | Type |
| ---------- | ---------- |
| part_num | string (PK) |
| name | string |
| part_cat_id | integer (FK → part_categories.id) |
| part_material | string |

Relationships:
- part_categories.id → parts.part_cat_id

##### data.re.part_relationships

| Column | Type |
| ---------- | ---------- |
| rel_type | string |
| child_part_num | string (FK → parts.part_num) |
| parent_part_num | string (FK → parts.part_num) |

Relationship types:

| Code | Meaning |
| -------- | -------- |
| P | Print |
| R | Pair |
| B | Sub-Part |
| M | Mold |
| T | Pattern |
| A | Alternate |

##### data.re.elements

| Column | Type |
| ---------- | ---------- |
| element_id | string (PK) |
| part_num | string (FK → parts.part_num) |
| color_id | integer (FK → colors.id) |

##### data.re.minifigs

| Column | Type |
| ---------- | ---------- |
| fig_num | string (PK) |
| name | string |
| num_parts | integer |

##### data.re.inventories

| Column | Type |
| ---------- | ---------- |
| id | integer (PK) |
| version | integer |
| set_num | string |
| created_at | datetime |

Notes:
- `inventories.set_num` may refer to either:
  - `sets.set_num`
  - `minifigs.fig_num`

##### data.re.inventory_parts

| Column | Type |
| ---------- | ---------- |
| inventory_id | integer (FK → inventories.id) |
| part_num | string (FK → parts.part_num) |
| color_id | integer (FK → colors.id) |
| quantity | integer |
| is_spare | boolean |

Relationships:
- inventories.id → inventory_parts.inventory_id
- parts.part_num → inventory_parts.part_num
- colors.id → inventory_parts.color_id

##### data.re.inventory_sets

| Column | Type |
| ---------- | ---------- |
| inventory_id | integer (FK → inventories.id) |
| set_num | string (FK → sets.set_num) |
| quantity | integer |

Relationships:
- inventories.id → inventory_sets.inventory_id
- sets.set_num → inventory_sets.set_num

##### data.re.inventory_minifigs

| Column | Type |
| ---------- | ---------- |
| inventory_id | integer (FK → inventories.id) |
| fig_num | string (FK → minifigs.fig_num) |
| quantity | integer |

Relationships:
- inventories.id → inventory_minifigs.inventory_id
- minifigs.fig_num → inventory_minifigs.fig_num

##### data.re.color_mappings

| Column | Type | Description |
| ---------- | ---------- | ---------- |
| id | integer (FK → colors.id) | Lego color id used by the application |
| ext_system | string | External system code |
| ext_id | string | Identifier in the external system |
| ext_descr | string | JSON array of the color names in the external system |
| is_export_id | boolean | Whether the identifier can be exported |
| is_import_id | boolean | Whether the identifier can be imported |

External systems:
- BL = BrickLink
- BS = Brickset
- BO = BrickOwl
- LE = LEGO
- LD = LDraw

##### data.re.part_mappings

| Column | Type |
| ---------- | ---------- |
| part_num | string |
| ext_part_num | string |
| ext_id | string |

##### data.re.set_mappings

| Column | Type |
| ---------- | ---------- |
| set_num | string |
| ext_set_num | string |
| ext_id | string |

##### Entity Relationship Summary

themes
└── sets
    └── inventories
        ├── inventory_parts
        │   ├── parts
        │   └── colors
        ├── inventory_sets
        │   └── sets
        └── inventory_minifigs
            └── minifigs

parts
├── elements
│   └── colors
├── inventory_parts
└── part_relationships

part_categories
└── parts

#### BrickWatch data

Lego doesn't provide open api to retrieve set prices. Brickwatch provide an easy to scrape page to download the prices.
The data.bw.SetPrice represent the price of each set. It has the following fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| SetNumber | String | Lego set number (FK) |
| LegoPrice | Number | Lego official price |

## BrickTool data

### Themes data

The data.bt.themes model describes Lego themes enriched with their parent theme name and a display color. It is derived from data.re.themes and stored in data/bt/themes.csv. It has the following fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| id | Integer | (PK) Theme identifier (from data.re.themes.id) |
| name | String | Theme name (from data.re.themes.name) |
| parent_id | Integer | Parent theme identifier (from data.re.themes.parent_id) |
| parent_name | String | Name of the parent theme, obtained by joining data.re.themes on data.re.themes.id = data.re.themes.parent_id |
| theme_uid | String | Theme identifier matching an image in data/le/themes/ |
| color_primary | String | Primary display color in hexadecimal format |
| color_secondary | String | Secondary display color in hexadecimal format |
| image | String | Image file name in data/le/themes/ |
| hidden | Boolean | When true, the theme and its sets are excluded from the New Sets catalogue. Defaults to false. |

Relationships:
- data.re.themes.id → data.bt.themes.parent_id

### Vendor and people metadata

Vendor logos are stored in data/other/vendor/ and mapped in data/other/vendor/vendors.csv.
People pictures are stored in data/other/people/ and mapped in data/other/people/people.csv.

Both mapping files have the following fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| name | String | Vendor or person name, as used in data.bt.purchased_sets.csv. Matching is case-insensitive. |
| image | String | Image file name in the corresponding folder |
| color | String | (People only) Display color in hexadecimal format, used as the border of the Buyer and Owner avatars. Optional. |

### Purchased Set data

The data.bt.PurchasedSet represent a Lego set that was purchased. It is stored in data/bt/purchased_sets.csv and has the following fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| Id | Integer | (PK) |
| SetNumber | String | Lego set number (FK) |
| Purchase Price | Number | Price paid |
| Purchase Date | Date | Date (yyyy/MM/dd) the set was purchased |
| Vendor | Enumeration | Company that sold the set (see Enumerations) |
| BroughtBy | Enumeration | Name of the person having brought the set (see Enumerations) |
| Owner | Enumeration | Name of the person owning the set (see Enumerations) |
| PartMissings | Integer | Amount of part that are missing from the set. This number is 0 (default) for a complete set. |
| Owned | Boolean | true (default) if the set is still in the collection |
| Reason | String | Why the set was bought, free text (e.g. Noel, Anniversaire, Soldes). Optional. |

### Enumerations

Vendor, BroughtBy and Owner are enumerations: their values are not fixed in advance.

- The values proposed when adding or editing a purchase are the distinct values already used in data.bt.PurchasedSet.
- A new value can be typed freely; it becomes a proposed value as soon as the purchase is saved.
- Values are compared as written, after removing leading and trailing spaces. Empty values are not proposed.
- In the Sets Purchase view each value is displayed as a colored label. When an image is mapped in data/other/vendor/vendors.csv or data/other/people/people.csv, the image is displayed instead and the value is used as its tooltip. Otherwise the colored label is shown. The color is derived from the value text, so the same value always gets the same color. For Buyer and Owner, the person's color from people.csv is used as the avatar border when available.

### Set images

Pictures of purchased sets are stored in data/bt/setsimg/ with the SetNumber as file name, and the extension of the source image (e.g. data/bt/setsimg/75192.jpg).

- When a purchase is added or edited, if no image is stored yet for its SetNumber, the image is downloaded once from data.re.sets.img_url (the row whose set_num is SetNumber + "-1").
- An existing image is never downloaded again.
- If the download fails, the purchase is still saved and the download is retried on the next add or edit of that set.
- The Sets Purchase view displays the stored image, not the picture hosted by Rebrickable.
- One-off backfill: the Administration page has a "Download missing images" button. It goes through every distinct SetNumber of data.bt.PurchasedSet, skips sets that already have an image, and downloads the others. One download is made per second to avoid being banned by Rebrickable. The run happens in the background and its progress is shown on the page.

### Wishlist data

The data.bt.Wishlist represent a set the user would like to buy. It is stored in data/bt/wishlist.csv and has the following fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| Id | Integer | (PK) |
| SetNumber | String | Lego set number (FK). A set can only appear once in the wishlist. |
| WishlistDate | Date | Date (yyyy/MM/dd) the set was added to the wishlist |
| Member | Enumeration | Family member the set is intended for. The proposed values are the names listed in data/other/people/people.csv. |
| Priority | Enumeration | Favorite, High, Medium or Low |
| Buyer | Enumeration | Family member who should buy the set in the future. Optional (empty when not set). The proposed values are the names listed in data/other/people/people.csv. |

Relationships:
- data.bt.Wishlist.SetNumber + '-1' = data.re.sets.set_num

### Part Color

The data.bt.Color

| Field Name | Type | Description |
| :--- | :--- | :--- |
| LegoId | String | Lego color Id |
| ReId | String | Rebrickable color Id |
| BLId | String | BrickLink color Id |
| BOId | String | BrickOwl color Id |
| LDId | String | LDraw color Id |
| LegoName | String | Lego name |
| ReName | String | Rebrickable name |
| BLName | String | BrickLink name |
| BOName | String | BrickLink name |
| Family | String | LegoName of the Color describing this familly |
| FamilyId | String | LegoId of the Color describing this familly |
| ColorHex | String | The hexadecimal representation of the color |
| ContrastColorHex | String | Represents a contrasting color of ColorHex to be used as foreground color when ColorHex is used as a background color |
| Tags | String | Comma separated list of tag in [Chrome, Speckle, Milky, Metallic, Glitter, Transparent, Pearl, Opal] |

### PaB purchases data

The data.bt.PaBPurchases represent a purchase made in a Lego store at the Pick a Brick wall. It has the following fields:

| Field Name | Type | Description |
| ---------- | ---------- | ---------- |
| Id | interger (PK) | |
| PurchaseDate | date | Date the PaB purchase was made |
| BoxQuantity | integer | Number of box of parts bought |
| MinifigQuantity | integer | Number of minifig bought |
| Price | decimal | Price in € |

### PaB parts data

The data.bt.PaBParts represent the parts bought of a PaBPurchase. It has the following fields:

| Field Name | Type | Description |
| ---------- | ---------- | ---------- |
| Id | interger (PK) | |
| PaBPurchaseId | integer | Identifier of the PaBPurchase (FK)  |
| PartNumber | integer | Lego part number (FK) |
| PartColorId | integer | Lego color number (FK) |
| Quantity | integer | Amount of part purchased |

Relationships:
- data.bt.PaBParts.PaBPurchaseId = data.bt.PaBPurchase.Id
- data.bt.PaBParts.PartNumber = data.re.parts.part_num
- data.bt.PaBParts.PartColor = data.re.colors.id

### Color tags data

The data.bt.ColorTags represent the tags associated with a Lego color. It has the following fields:

| Field Name | Type | Description |
| ---------- | ---------- | ---------- |
| ColorId | interger (FK) | |
| Name | string | Color name (duplicated data from colors.csv) |
| Family | string | Indicates the family name of the color |
| primary | boolean | Indicates that the color is one of the primary colors and is a root category. All other color should have a primary color in their tag |
| hidden | boolean | Indicates that the color is obsolete and should not be shown to the user in list, tables... |
| metallic | boolean | Indicates that the color is metallic |
| special | boolean | Indicates that the color is special |
| translucent | boolean | Indicates that the color is translucent |
| tag_list | string | A semicolon (;) separated list of tags |

The primary colors values can be `Black, Blue, Brown, Gray, Green, Orange, Pink, Purple, Red, White, Yellow, Clear`.
The family values can be a primary color or `Primary` or `Other`.

Relationships:
- data.bt.ColorTags.ColorId = data.re.colors.id

## BrickOwl data

BrickOwl provide a public API at <https://www.brickowl.com/api_docs>

### BrickOwl Order data

The data.bo.Order represent an order from a store in BrickOwl. It is sourced from the api endoint <https://api.brickowl.com/v1/order/view>. It has the following fields:

| Field Name | Type | Source | Description |
| :--- | :--- | :--- | :--- |
| Id | String | order_id | (PK) |
| OrderTime | DateTime | iso_order_time | |
| StoreName | String | store_name | |
| StoreUrl | String | store_url | |
| Weight | Integer | weight | in kg |
| ShippingTotal | Decimal | ship_total | in € |
| TotalParts | String | total_quantity | |
| TotalLots | String | total_lots | |
| PaidTotal | Decimal | payment_total | in € |
| RefundTotal | Decimal | refund_total | in € |
| Total | Decimal | payment_total - refund_total | in € |

### BrickOwl OrderItem data

The data.bo.OrderItem represent an order from a store in BrickOwl. It is sourced from the api endoint <https://api.brickowl.com/v1/order/items>. It has the following fields:

| Field Name | Type | Source | Description |
| :--- | :--- | :--- | :--- |
| OrderId | String | order_item_id | (FK ) |
| BOID | String | boid | |
| DesignIds | String | ids.*[type=design_id] | Comma separated list of strings, each representing a single DesignId |
| ItemNumbers | String | ids.*[type=item_no] | Comma separated list of strings, each representing a single ItemNumber |
| Condition | String | condition | |
| Name | String | name | |
| Type | String | type | |
| Weight | Integer | weight | in g |
| ColorId | String | color_id | |
| ColorName | String | color_name | |
| OrderedQuantity | Decimal | ordered_quantity | |
| RefundQuantity | Decimal | refunded_quantity | |
| Quantity | Decimal | ordered_quantity - refunded_quantity | |
| ItemPrice | String | base_price | |
| TotalPrice | String | base_price * (ordered_quantity - refunded_quantity) | |
