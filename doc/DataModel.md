# BrickTools Data Model Definition

This document describes the data models used by BrickTools and their relationships.

## Table of Contents

- [LEGO Data Providers](#lego-data-providers)
- [Data Storage Structure](#data-storage-structure)
- [Rebrickable Data](#rebrickable-data)
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

Data from each provider is stored in the data/ folder:
- Format: data/$ProviderId/$File.$Ext
- Example: Rebrickable sets data is stored at data/re/sets.csv and referenced as data.re.sets

## Rebrickable Data

Rebrickable provides comprehensive CSV files with LEGO data.

### Core Models

#### data.re.themes
| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique theme identifier |
| name | string | Theme name |
| parent_id | integer (FK) | Parent theme ID |

#### data.re.sets
| Column | Type | Description |
|--------|------|-------------|
| set_num | string (PK) | Unique set number |
| name | string | Set name |
| year | integer | Release year |
| theme_id | integer (FK) | Theme ID |
| num_parts | integer | Number of parts |
| img_url | string | Image URL |

#### data.re.colors
| Column | Type | Description |
|--------|------|-------------|
| id | integer (PK) | Unique color identifier |
| name | string | Color name |
| rgb | string | RGB hex value |
| is_trans | boolean | Is transparent |
| num_parts | integer | Number of parts in this color |
| num_sets | integer | Number of sets using this color |

#### data.re.parts
| Column | Type | Description |
|--------|------|-------------|
| part_num | string (PK) | Unique part number |
| name | string | Part name |
| part_cat_id | integer (FK) | Category ID |
| part_material | string | Material |

#### data.re.part_relationships
| Column | Type | Description |
|--------|------|-------------|
| rel_type | string | Relationship type (P=Print, R=Pair, B=Sub-Part, M=Mold, T=Pattern, A=Alternate) |
| child_part_num | string (FK) | Child part number |
| parent_part_num | string (FK) | Parent part number |

## BrickWatch Data

### data.bw.SetPrice
| Field | Type | Description |
|-------|------|-------------|
| SetNumber | string (FK) | LEGO set number |
| LegoPrice | number | Official LEGO price in euros |

## BrickTools Data

### data.bt.themes
Extended theme information with display properties.
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Theme identifier |
| name | string | Theme name |
| parent_id | integer | Parent theme identifier |
| parent_name | string | Parent theme name |
| theme_uid | string | Theme image identifier |
| color_primary | string | Primary display color |
| color_secondary | string | Secondary display color |
| image | string | Image file name |
| hidden | boolean | Hide from catalog |

### data.bt.PurchasedSet
Purchased LEGO sets.
| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Purchase identifier |
| SetNumber | string (FK) | LEGO set number |
| PurchasePrice | number | Price paid |
| PurchaseDate | date | Purchase date |
| Vendor | string | Vendor name |
| BroughtBy | string | Person who purchased |
| Owner | string | Person who owns |
| PartMissings | integer | Missing parts count |
| Owned | boolean | Still in collection |
| Reason | string | Purchase reason |

### data.bt.Wishlist
Wishlisted LEGO sets.
| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Wishlist entry identifier |
| SetNumber | string (FK) | LEGO set number |
| WishlistDate | date | Date added to wishlist |
| Member | string | Family member for |
| Priority | string | Priority (Favorite, High, Medium, Low) |
| Buyer | string | Family member who should buy |

### data.bt.PaBPurchases
Pick-a-Brick purchases.
| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Purchase identifier |
| PurchaseDate | date | Purchase date |
| BoxQuantity | integer | Number of boxes |
| MinifigQuantity | integer | Number of minifigures |
| Price | decimal | Price in euros |

### data.bt.PaBParts
Parts in Pick-a-Brick purchases.
| Field | Type | Description |
|-------|------|-------------|
| Id | integer (PK) | Part identifier |
| PaBPurchaseId | integer (FK) | PaB purchase ID |
| PartNumber | string (FK) | LEGO part number |
| PartColorId | integer (FK) | LEGO color ID |
| Quantity | integer | Quantity purchased |

## BrickOwl Data

### data.bo.Order
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| Id | string | order_id | Order identifier |
| OrderTime | DateTime | iso_order_time | Order timestamp |
| StoreName | string | store_name | Store name |
| StoreUrl | string | store_url | Store URL |
| Weight | integer | weight | Weight in kg |
| ShippingTotal | decimal | ship_total | Shipping cost |
| TotalParts | integer | total_quantity | Total parts |
| TotalLots | integer | total_lots | Total lots |
| PaidTotal | decimal | payment_total | Amount paid |
| RefundTotal | decimal | refund_total | Amount refunded |
| Total | decimal | Calculated | Net amount |

### data.bo.OrderItem
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| OrderId | string | order_item_id | Order ID |
| BOID | string | boid | BrickOwl item ID |
| DesignIds | string | ids | Design IDs |
| ItemNumbers | string | ids | Item numbers |
| Condition | string | condition | Condition |
| Name | string | name | Item name |
| Type | string | type | Item type |
| Weight | integer | weight | Weight in grams |
| ColorId | string | color_id | Color ID |
| ColorName | string | color_name | Color name |
| OrderedQuantity | decimal | ordered_quantity | Quantity ordered |
| RefundQuantity | decimal | refunded_quantity | Quantity refunded |
| Quantity | decimal | Calculated | Net quantity |
| ItemPrice | decimal | base_price | Price per item |
| TotalPrice | decimal | Calculated | Total price |

## API Endpoints

- Swagger UI: http://localhost:8780/swagger-ui/index.html
- OpenAPI specification: http://localhost:8780/v3/api-docs
