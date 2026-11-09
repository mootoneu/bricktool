# BrickTools Data Model Definition

This document describes the data models used by BrickTools and their relationships.

## Table of Contents

- [LEGO Data Providers](#lego-data-providers)
- [Data Storage Structure](#data-storage-structure)
- [Rebrickable Data](#rebrickable-data)
- [LEGO Data](#lego-data)
- [BrickWatch Data](#brickwatch-data)
- [BrickTools Data](#bricktools-data)
- [BrickOwl Data](#brickowl-data)

## LEGO Data Providers

BrickTools integrates data from multiple LEGO data providers. Each provider has a unique 2-letter code:

| Provider Name | Provider ID | Description |
|---------------|-------------|-------------|
| BrickTools | bt | Internal data |
| LEGO | le | Official LEGO data |
| Rebrickable | re | Comprehensive LEGO database |
| Brickset | bs | LEGO set database |
| BrickLink | bl | LEGO marketplace and database |
| BrickOwl | bo | LEGO parts marketplace |
| BrickWatch | bw | LEGO price tracking |
| LDraw | ld | LEGO CAD software parts library |

## Data Storage Structure

Data from each provider is stored in the `data/` folder following this structure:
```
data/
├── $ProviderId/           # Provider-specific data directory
│   ├── *.csv              # CSV files for this provider
│   └── subdirectories/    # Additional subdirectories as needed
└── ...
```

**File Naming Convention:**
- Format: `data/$ProviderId/$File.$Ext`
- Where:
  - `$ProviderId` = 2-letter provider code from the table above
  - `$File` = Descriptive file name
  - `$Ext` = File extension (typically `csv`)

**Reference Notation:**
- When referencing a data model: `data.$ProviderId.$DataModel`
- Example: Rebrickable sets data → stored at `data/re/sets.csv` → referenced as `data.re.sets`

---

## Rebrickable Data

Rebrickable provides a comprehensive ZIP file of CSV files containing the most complete LEGO data model available.

**Download Information:**
- Source: [https://rebrickable.com/downloads/](https://rebrickable.com/downloads/)
- Frequency: Once per day maximum (as per Rebrickable terms)
- After download: Unzip the CSV files into the `data/re/` directory

### Core Data Models

#### `data.re.themes`

Stores LEGO theme information.

| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique theme identifier |
| name | string | Theme name |
| parent_id | integer (FK) | Parent theme ID (references `themes.id`) |

**Relationships:**
- Parent-Child: `themes.id` → `themes.parent_id`

---

#### `data.re.sets`

Stores LEGO set information.

| Column | Type | Description |
|--------|------|-------------|
| set_num | string (PK) | Unique set number |
| name | string | Set name |
| year | integer | Release year |
| theme_id | integer (FK) | Theme ID (references `themes.id`) |
| num_parts | integer | Number of parts in the set |
| img_url | string | URL to the set image on Rebrickable CDN |

**Relationships:**
- `themes.id` → `sets.theme_id`

---

#### `data.re.colors`

Stores LEGO color information.

| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique color identifier |
| name | string | Color name |
| rgb | string | RGB hex value (e.g., `"#FF0000"`) |
| is_trans | boolean | Whether the color is transparent |
| num_parts | integer | Number of parts available in this color |
| num_sets | integer | Number of sets using this color |
| y1 | integer | First year the color was used |
| y2 | integer | Last year the color was used |

---

#### `data.re.part_categories`

Stores part category information.

| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique category identifier |
| name | string | Category name |

---

#### `data.re.parts`

Stores LEGO part information.

| Column | Type | Description |
|--------|------|-------------|
| part_num | string (PK) | Unique part number |
| name | string | Part name |
| part_cat_id | integer (FK) | Category ID (references `part_categories.id`) |
| part_material | string | Material the part is made of |

**Relationships:**
- `part_categories.id` → `parts.part_cat_id`

---

#### `data.re.part_relationships`

Stores relationships between parts (e.g., alternates, prints).

| Column | Type | Description |
|--------|------|-------------|
| rel_type | string | Relationship type code |
| child_part_num | string (FK) | Child part number (references `parts.part_num`) |
| parent_part_num | string (FK) | Parent part number (references `parts.part_num`) |

**Relationship Types:**

| Code | Meaning | Description |
|------|---------|-------------|
| P | Print | Part with printing |
| R | Pair | Paired part |
| B | Sub-Part | Sub-part relationship |
| M | Mold | Mold variant |
| T | Pattern | Patterned part |
| A | Alternate | Alternate part |

---

#### `data.re.elements`

Stores element information (part + color combination).

| Column | Type | Description |
|--------|------|-------------|
| element_id | string (PK) | Unique element identifier |
| part_num | string (FK) | Part number (references `parts.part_num`) |
| color_id | integer (FK) | Color ID (references `colors.id`) |

**Relationships:**
- `parts.part_num` → `elements.part_num`
- `colors.id` → `elements.color_id`

---

#### `data.re.minifigs`

Stores minifigure information.

| Column | Type | Description |
|--------|------|-------------|
| fig_num | string (PK) | Unique minifigure identifier |
| name | string | Minifigure name |
| num_parts | integer | Number of parts in the minifigure |

---

#### `data.re.inventories`

Stores inventory information for sets and minifigures.

| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique inventory identifier |
| version | integer | Inventory version |
| set_num | string | Set or minifigure number (references `sets.set_num` or `minifigs.fig_num`) |
| created_at | datetime | Creation timestamp |

**Notes:**
- `inventories.set_num` may refer to either:
  - `sets.set_num` (for regular sets)
  - `minifigs.fig_num` (for minifigures)

---

#### `data.re.inventory_parts`

Stores parts in inventories.

| Column | Type | Description |
|--------|------|-------------|
| inventory_id | integer (FK) | Inventory ID (references `inventories.id`) |
| part_num | string (FK) | Part number (references `parts.part_num`) |
| color_id | integer (FK) | Color ID (references `colors.id`) |
| quantity | integer | Quantity of this part in the inventory |
| is_spare | boolean | Whether this part is a spare |

**Relationships:**
- `inventories.id` → `inventory_parts.inventory_id`
- `parts.part_num` → `inventory_parts.part_num`
- `colors.id` → `inventory_parts.color_id`

---

#### `data.re.inventory_sets`

Stores sub-sets in inventories.

| Column | Type | Description |
|--------|------|-------------|
| inventory_id | integer (FK) | Inventory ID (references `inventories.id`) |
| set_num | string (FK) | Set number (references `sets.set_num`) |
| quantity | integer | Quantity of this set in the inventory |

**Relationships:**
- `inventories.id` → `inventory_sets.inventory_id`
- `sets.set_num` → `inventory_sets.set_num`

---

#### `data.re.inventory_minifigs`

Stores minifigures in inventories.

| Column | Type | Description |
|--------|------|-------------|
| inventory_id | integer (FK) | Inventory ID (references `inventories.id`) |
| fig_num | string (FK) | Minifigure number (references `minifigs.fig_num`) |
| quantity | integer | Quantity of this minifigure in the inventory |

**Relationships:**
- `inventories.id` → `inventory_minifigs.inventory_id`
- `minifigs.fig_num` → `inventory_minifigs.fig_num`

---

### Color and Part Mappings

#### `data.re.color_mappings`

Maps color identifiers across different external systems.

| Column | Type | Description |
|--------|------|-------------|
| id | integer (FK) | LEGO color ID (references `colors.id`) |
| ext_system | string | External system code |
| ext_id | string | Identifier in the external system |
| ext_descr | string | JSON array of color names in the external system |
| is_export_id | boolean | Whether the identifier can be exported |
| is_import_id | boolean | Whether the identifier can be imported |

**External Systems:**
- `BL` = BrickLink
- `BS` = Brickset
- `BO` = BrickOwl
- `LE` = LEGO
- `LD` = LDraw

---

#### `data.re.part_mappings`

Maps part identifiers across different external systems.

| Column | Type | Description |
|--------|------|-------------|
| part_num | string | LEGO part number |
| ext_part_num | string | External part number |
| ext_id | string | External system identifier |

---

#### `data.re.set_mappings`

Maps set identifiers across different external systems.

| Column | Type | Description |
|--------|------|-------------|
| set_num | string | LEGO set number |
| ext_set_num | string | External set number |
| ext_id | string | External system identifier |

---

### Entity Relationship Diagram

```
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
```

---

## LEGO Data

Official data published by LEGO.

### Pick-a-Brick Part Prices

#### `data.le.PabPartPrice`

Stores the Pick a Brick price of a LEGO part design in a given color.

**Storage**: `data/le/pab_part_prices.csv`

| Field | Type | Description |
|-------|------|-------------|
| DesignId | string | LEGO design ID (part ID) |
| ColorId | integer | LEGO color ID. Can be empty. |
| Price | decimal | Pick a Brick price in euros |

**Notes:**
- The file has no unique key: the same `(DesignId, ColorId)` pair can appear several times, possibly with different prices
- Every row is kept as published by LEGO

**Relationships:**
- `data.le.PabPartPrice.DesignId` = `data.re.parts.part_num` when the part exists in Rebrickable
- `data.le.PabPartPrice.ColorId` = `data.bt.Color.LegoId` (which maps to `data.re.colors.id` through `data.bt.Color.ReId`)

---

## BrickWatch Data

LEGO does not provide an open API to retrieve set prices. BrickWatch provides an easy-to-scrape page to download prices.

### `data.bw.SetPrice`

Stores the official LEGO price for sets.

| Field | Type | Description |
|-------|------|-------------|
| SetNumber | string (FK) | LEGO set number (references `re.sets.set_num`) |
| LegoPrice | number | Official LEGO price in euros |

---

## BrickTools Data

Custom data models used by BrickTools for managing the user's collection.

### Themes

#### `data.bt.themes`

Extended theme information with display properties, derived from `data.re.themes`.

| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Theme identifier (from `data.re.themes.id`) |
| name | string | Theme name (from `data.re.themes.name`) |
| parent_id | integer | Parent theme identifier (from `data.re.themes.parent_id`) |
| parent_name | string | Name of the parent theme (joined from `data.re.themes`) |
| theme_uid | string | Theme identifier matching an image in `data/le/themes/` |
| color_primary | string | Primary display color in hexadecimal format |
| color_secondary | string | Secondary display color in hexadecimal format |
| image | string | Image file name in `data/le/themes/` |
| hidden | boolean | When true, the theme and its sets are excluded from the New Sets catalog. Defaults to false. |

**Relationships:**
- `data.re.themes.id` → `data.bt.themes.id`
- `data.re.themes.id` → `data.bt.themes.parent_id`

---

### Metadata

#### Vendor Logos

- **Storage**: Images in `data/other/vendor/`
- **Mapping**: `data/other/vendor/vendors.csv`

**`vendors.csv` Fields:**

| Field | Type | Description |
|-------|------|-------------|
| name | string | Vendor name (as used in `data.bt.purchased_sets.csv`). Matching is case-insensitive. |
| image | string | Image file name in `data/other/vendor/` |

#### Person Pictures

- **Storage**: Images in `data/other/people/`
- **Mapping**: `data/other/people/people.csv`

**`people.csv` Fields:**

| Field | Type | Description |
|-------|------|-------------|
| name | string | Person name (as used in `data.bt.purchased_sets.csv`). Matching is case-insensitive. |
| image | string | Image file name in `data/other/people/` |
| color | string | Display color in hexadecimal format, used as the border of the Buyer and Owner avatars. Optional. |

---

### Purchased Sets

#### `data.bt.PurchasedSet`

Represents a LEGO set that was purchased.

**Storage**: `data/bt/purchased_sets.csv`

| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Unique purchase identifier |
| SetNumber | string (FK) | LEGO set number (references `data.re.sets.set_num`) |
| PurchasePrice | number | Price paid for the set (in euros) |
| PurchaseDate | date | Date the set was purchased (format: `yyyy/MM/dd`) |
| Vendor | string | Company that sold the set (enumeration) |
| BroughtBy | string | Name of the person who purchased the set (enumeration) |
| Owner | string | Name of the person who owns the set (enumeration) |
| PartMissings | integer | Number of parts missing from the set. Defaults to 0 for complete sets. |
| Owned | boolean | True (default) if the set is still in the collection |
| Reason | string | Why the set was bought (free text, e.g., "Christmas", "Birthday", "Sale"). Optional. |

---

### Enumerations

Vendor, BroughtBy, and Owner are enumerations: their values are not fixed in advance.

**Behavior:**
- The values proposed when adding or editing a purchase are the distinct values already used in `data.bt.PurchasedSet`
- A new value can be typed freely; it becomes a proposed value as soon as the purchase is saved
- Values are compared as written, after removing leading and trailing spaces
- Empty values are not proposed
- In the Sets Purchase view, each value is displayed as a colored label
- When an image is mapped in `data/other/vendor/vendors.csv` or `data/other/people/people.csv`, the image is displayed instead and the value is used as its tooltip
- Otherwise, the colored label is shown
- The color is derived from the value text, so the same value always gets the same color
- For Buyer and Owner, the person's color from `people.csv` is used as the avatar border when available

---

### Set Images

Pictures of purchased sets are stored in `data/bt/setsimg/` with the SetNumber as the file name and the extension of the source image.

**Example**: `data/bt/setsimg/75192.jpg`

**Behavior:**
- When a purchase is added or edited, if no image is stored yet for its SetNumber, the image is downloaded once from `data.re.sets.img_url` (the row whose `set_num` is `SetNumber + "-1"`)
- An existing image is never downloaded again
- If the download fails, the purchase is still saved and the download is retried on the next add or edit of that set
- The Sets Purchase view displays the stored image, not the picture hosted by Rebrickable

**One-off Backfill:**
- The Administration page has a "Download missing images" button
- It goes through every distinct SetNumber of `data.bt.PurchasedSet`
- Skips sets that already have an image
- Downloads the missing ones
- One download is made per second to avoid being banned by Rebrickable
- The run happens in the background and its progress is shown on the page

---

### Wishlist

#### `data.bt.Wishlist`

Represents a set the user would like to buy.

**Storage**: `data/bt/wishlist.csv`

| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Unique wishlist entry identifier |
| SetNumber | string (FK) | LEGO set number (references `data.re.sets.set_num`). A set can only appear once in the wishlist. |
| WishlistDate | date | Date the set was added to the wishlist (format: `yyyy/MM/dd`) |
| Member | string | Family member the set is intended for. The proposed values are the names listed in `data/other/people/people.csv`. |
| Priority | string | Priority level. Must be one of: `Favorite`, `High`, `Medium`, `Low` |
| Buyer | string | Family member who should buy the set in the future. Optional (empty when not set). The proposed values are the names listed in `data/other/people/people.csv`. |

**Relationships:**
- `data.bt.Wishlist.SetNumber + '-1'` = `data.re.sets.set_num`

---

### Part Colors

#### `data.bt.Color`

Consolidates color data from all vendors into a single object.

| Field | Type | Description |
|-------|------|-------------|
| LegoId | string | LEGO color ID |
| ReId | string | Rebrickable color ID |
| BLId | string | BrickLink color ID |
| BOId | string | BrickOwl color ID |
| LDId | string | LDraw color ID |
| LegoName | string | LEGO color name |
| ReName | string | Rebrickable color name |
| BLName | string | BrickLink color name |
| BOName | string | BrickOwl color name |
| Family | string | LEGO name of the color family this color belongs to |
| FamilyId | string | LEGO ID of the color family this color belongs to |
| ColorHex | string | Hexadecimal representation of the color |
| ContrastColorHex | string | Contrasting color for text when used as background |
| Tags | string | Comma-separated list of tags. Possible values: `Chrome`, `Speckle`, `Milky`, `Metallic`, `Glitter`, `Transparent`, `Pearl`, `Opal` |

---

### Part Categories

#### `data.bt.PartCategories`

Extended part category information based on `data.re.part_categories`.

**Storage**: Derived from `data.re.part_categories`

| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Part category ID (from `data.re.part_categories.id`) |
| Name | string | Category name (from `data.re.part_categories.name`) |
| Group | string | Group name of part categories |
| Hidden | boolean | Indicates whether the category should be hidden from users |

**Relationships:**
- `data.re.parts.part_cat_id` = `data.bt.PartCategories.Id`
- `data.re.part_categories.id` = `data.bt.PartCategories.Id`

---

### Main Parts

#### `data.bt.MainParts`

Filtered view of LEGO parts with additional metadata.

| Field | Type | Description |
|-------|------|-------------|
| PartNumber | string (PK) | Part number (from `data.re.parts.part_num`) |
| Name | string | Part name (from `data.re.parts.name`) |
| CategoryId | integer (FK) | Category ID (references `data.bt.PartCategories.Id`) |
| Material | string | Material the part is made of (from `data.re.parts.part_material`) |
| HasAlternates | boolean | Indicates if the part is linked to other parts via `data.re.part_relationships`. Defaults to false. |
| Stars | integer | Popularity rating (0-5). Defaults to 2. Indicates how popular the part is. |

**Relationships:**
- `data.re.parts.id` = `data.bt.MainParts.Id`
- `data.re.part_relationships.parent_part_num` = `data.bt.MainParts.Id`
- `data.re.part_categories.id` = `data.bt.MainParts.CategoryId`
- `data.bt.PartCategories.Id` = `data.bt.MainParts.CategoryId`

---

### Pick-a-Brick Purchases

#### `data.bt.PaBPurchases`

Represents a purchase made in a LEGO store at the Pick a Brick wall.

| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Unique PaB purchase identifier |
| PurchaseDate | date | Date the PaB purchase was made (format: `yyyy/MM/dd`) |
| BoxQuantity | integer | Number of boxes of parts bought |
| MinifigQuantity | integer | Number of minifigures bought |
| Price | decimal | Price in euros |

---

#### `data.bt.PaBParts`

Represents the parts bought in a PaB purchase.

| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Unique PaB parts identifier |
| PaBPurchaseId | integer (FK) | PaB purchase ID (references `data.bt.PaBPurchases.Id`) |
| PartNumber | string (FK) | LEGO part number (references `data.re.parts.part_num`) |
| PartColorId | integer (FK) | LEGO color ID (references `data.re.colors.id`) |
| Quantity | integer | Amount of parts purchased |

**Relationships:**
- `data.bt.PaBParts.PaBPurchaseId` = `data.bt.PaBPurchases.Id`
- `data.bt.PaBParts.PartNumber` = `data.re.parts.part_num`
- `data.bt.PaBParts.PartColorId` = `data.re.colors.id`

---

### Color Tags

#### `data.bt.ColorTags`

Represents tags associated with LEGO colors.

| Field | Type | Description |
|-------|------|-------------|
| ColorId | integer (FK) | LEGO color ID (references `data.re.colors.id`) |
| Name | string | Color name (duplicated from `colors.csv`) |
| Family | string | Indicates the family name of the color |
| Primary | boolean | Indicates that the color is one of the primary colors and is a root category. All other colors should have a primary color in their tags. |
| Hidden | boolean | Indicates that the color is obsolete and should not be shown to users in lists, tables, etc. |
| Metallic | boolean | Indicates that the color is metallic |
| Special | boolean | Indicates that the color is special |
| Translucent | boolean | Indicates that the color is translucent |
| TagList | string | Semicolon-separated (`;`) list of tags |

**Primary Colors:**
- Values can be: `Black`, `Blue`, `Brown`, `Gray`, `Green`, `Orange`, `Pink`, `Purple`, `Red`, `White`, `Yellow`, `Clear`

**Family Values:**
- Can be a primary color or `Primary` or `Other`

**Relationships:**
- `data.bt.ColorTags.ColorId` = `data.re.colors.id`

---

### Part Image URLs

#### `data.bt.PartColorUrl`

Maps part number and color to image URLs.

| Field | Type | Description |
|-------|------|-------------|
| PartNumber | string (FK) | LEGO part number (references `data.re.parts.part_num`) |
| ColorId | integer (FK) | LEGO color ID (references `data.re.colors.id`) |
| ItemNumber | string | LEGO number identifying a part of a certain color |
| ImgUrl | string | Rebrickable CDN URL to download the image |

**Primary Key:** The combination of `(PartNumber, ColorId)`

**Relationships:**
- `data.bt.PartColorUrl.PartNumber` = `data.re.parts.part_num`
- `data.bt.PartColorUrl.ColorId` = `data.re.colors.id`

---

#### `data.bt.PartDefaultColor`

Stores the color used by default for the image of a part. The part information modal writes this file when a color is selected.

| Field | Type | Description |
|-------|------|-------------|
| PartNumber | string (FK) | LEGO part number (references `data.re.parts.part_num`) |
| ColorId | integer (FK) | LEGO color ID (references `data.re.colors.id`) |

**Primary Key:** `PartNumber`

**Storage**: `data/bt/part_default_color.csv`

**Relationships:**
- `data.bt.PartDefaultColor.PartNumber` = `data.re.parts.part_num`
- `data.bt.PartDefaultColor.ColorId` = `data.re.colors.id`
- The `(PartNumber, ColorId)` pair must exist in `data.bt.PartColorUrl`

When a part has no entry, or its stored color is no longer available, the lowest available color is used.

---

### Set Inventory

#### `data.bt.SetInventory`

Tracks inventory of parts in owned sets.

| Field | Type | Description |
|-------|------|-------------|
| SetNumber | string (FK) | LEGO set number (references `data.re.sets.set_num`) |
| PartNumber | string (FK) | LEGO part number (references `data.re.parts.part_num`) |
| ColorId | integer (FK) | LEGO color ID (references `data.re.colors.id`) |
| ExpectedQut | integer | Expected quantity in the set |
| ActualQut | integer | Actual quantity in stock (should be <= ExpectedQut) |

**Relationships:**
- `data.bt.SetInventory.SetNumber` = `data.re.sets.set_num`
- `data.bt.SetInventory.PartNumber` = `data.re.parts.part_num`
- `data.bt.SetInventory.ColorId` = `data.re.colors.id`

---

## BrickOwl Data

BrickOwl provides a public API at [https://www.brickowl.com/api_docs](https://www.brickowl.com/api_docs)

### `data.bo.Order`

Represents an order from a store in BrickOwl.

**Source**: API endpoint `https://api.brickowl.com/v1/order/view`

| Field | Type | Source Field | Description |
|-------|------|--------------|-------------|
| Id | string | order_id | Unique order identifier (PK) |
| OrderTime | DateTime | iso_order_time | Order timestamp |
| StoreName | string | store_name | Name of the store |
| StoreUrl | string | store_url | URL to the store |
| Weight | integer | weight | Weight in kilograms |
| ShippingTotal | decimal | ship_total | Shipping cost in euros |
| TotalParts | integer | total_quantity | Total number of parts |
| TotalLots | integer | total_lots | Total number of lots |
| PaidTotal | decimal | payment_total | Total amount paid in euros |
| RefundTotal | decimal | refund_total | Total amount refunded in euros |
| Total | decimal | Calculated | Net amount (payment_total - refund_total) in euros |

---

### `data.bo.OrderItem`

Represents an item in a BrickOwl order.

**Source**: API endpoint `https://api.brickowl.com/v1/order/items`

| Field | Type | Source Field | Description |
|-------|------|--------------|-------------|
| OrderId | string | order_item_id | Order ID (FK, references `data.bo.Order.Id`) |
| BOID | string | boid | BrickOwl item identifier |
| DesignIds | string | ids.*[type=design_id] | Comma-separated list of DesignIds |
| ItemNumbers | string | ids.*[type=item_no] | Comma-separated list of ItemNumbers |
| Condition | string | condition | Condition of the item |
| Name | string | name | Item name |
| Type | string | type | Item type |
| Weight | integer | weight | Weight in grams |
| ColorId | string | color_id | BrickOwl color identifier |
| ColorName | string | color_name | Color name |
| OrderedQuantity | decimal | ordered_quantity | Original quantity ordered |
| RefundQuantity | decimal | refunded_quantity | Quantity refunded |
| Quantity | decimal | Calculated | Net quantity (ordered_quantity - refunded_quantity) |
| ItemPrice | decimal | base_price | Price per item in euros |
| TotalPrice | decimal | Calculated | Total price (base_price * net quantity) in euros |

---

## API Endpoints

For REST API documentation, see:
- Swagger UI: `http://localhost:8780/swagger-ui/index.html`
- OpenAPI specification: `http://localhost:8780/v3/api-docs`
