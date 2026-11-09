# Brick Tools

Brick Tools is a personal web application designed to provide several tools to assist the user in managing their LEGO collection. This application is expected to be single-user and self-hosted.

## Application Stack

- **Backend**: Java + Spring Boot
- **Frontend**: jQuery + D3.js
- **Data Storage**: CSV files (no cloud, no database)

## Table of Contents

- [Brick Tools](#brick-tools)
  - [Application Stack](#application-stack)
  - [Table of Contents](#table-of-contents)
  - [Application Features](#application-features)
    - [Landing Page](#landing-page)
    - [Administration Page](#administration-page)
      - [Rebrickable Update](#rebrickable-update)
      - [BrickWatch Sets Official Price Update](#brickwatch-sets-official-price-update)
        - [Scraping Set Price Data](#scraping-set-price-data)
      - [Brickonomics Official Price](#brickonomics-official-price)
    - [BrickOwl Page](#brickowl-page)
      - [BrickOwl Statistics Tab](#brickowl-statistics-tab)
      - [Update Order Data from BrickOwl](#update-order-data-from-brickowl)
    - [Parts Collection Page](#parts-collection-page)
    - [Sets Purchase Page](#sets-purchase-page)
      - [Sets Purchase List](#sets-purchase-list)
    - [New Sets Page](#new-sets-page)
    - [Colors](#colors)
  - [API Documentation](#api-documentation)
  - [Data Model](#data-model)
  - [Project Structure](#project-structure)
  - [Setup and Configuration](#setup-and-configuration)
  - [Contributing](#contributing)
  - [License](#license)

## Application Features

All pages share a common header bar that provides:
- Links to all feature pages
- Notification system

### Landing Page

The landing page is the first page users see when starting the application. It provides links in cards to all available features.

### Administration Page

The administration page enables users to perform several operations.

#### Rebrickable Update

Rebrickable is a website providing open data about LEGO. As LEGO releases new sets, the Rebrickable data is updated. BrickTools relies on Rebrickable data for common LEGO data such as sets, parts, themes, and colors.

**Requirements:**
- Displayed in a card in the Administration page
- Provides an "Update data" button to start the download of Rebrickable data (see [./doc/DataModel.md](./doc/DataModel.md))
- Displays the date of the last download
- The "Update data" button is disabled if data has already been downloaded for the day (Rebrickable terms allow downloads at most once a day)
- When data is older than a month, a notification reminds the user to perform the update
- This check runs at server startup and then once a day

#### BrickWatch Sets Official Price Update

BrickWatch is a LEGO price tracking platform. BrickTools maintains a list of official LEGO prices based on BrickWatch data stored in `external.brickwatch.setprices`.

**Requirements:**
- Displayed in a card in the Administration page
- User can enter a SetNumber and click the "Fetch official price" button
  - If the price is already in setprice, it displays the stored price
  - Otherwise, the price is scraped and stored in `data.bw.setprices` CSV

##### Scraping Set Price Data

Set data can be scraped from: `https://www.brickwatch.net/fr-FR/set/$SETNUMBER`
- The corresponding price is located in the table after the header "Information sur le prix"
- In the row starting with "Lego prix conseillé", in the last column
- A one-second delay must be implemented between requests to prevent being banned by BrickWatch

#### Brickonomics Official Price

The Administration BrickWatch card also has a "Fetch price with brickonomics" button. It fetches the retail price from Brickonomics and saves it in `data.bw.setprices` CSV, replacing any existing price for the set.

**Requirements:**
- Price is read from: `https://brickonomics.net/set/$SETNUMBER-1`
- In the "Retail price:" entry of the set details
- Request sends cookies: `country=fr` and `currency=EUR` (so the price is in euros)
- At most one request per second is made

### BrickOwl Page

BrickOwl is a website that allows purchasing LEGO sets, minifigures, and parts individually. This feature provides tracking of past orders from BrickOwl.

**Page Contents:**
- Statistics tab: Shows statistics about the orders
- Update tab: Contains a button to update data from BrickOwl
- Orders tab: Displays a list of BrickOwl orders (`data.bo.Order`)
- Order Items tab: Displays the items purchased in the selected BrickOwl order (`data.bo.OrderItems`)

#### BrickOwl Statistics Tab

This tab presents information about the orders:
- Card with total amount, pieces, minifigures, and sets purchased
- Card with average/median amount, pieces, price per piece, price per kg, minifigures, and sets purchased
- Several cards with histograms grouped by Store, showing respectively: amount, pieces, price per piece, price per kg, minifigures, and sets purchased each year

#### Update Order Data from BrickOwl

BrickOwl provides a public API at [https://www.brickowl.com/api_docs](https://www.brickowl.com/api_docs)

The GET endpoint `https://api.brickowl.com/v1/order/list` returns the list of BrickOwl orders. If any orders have already been retrieved, it must be called with the `order_time` parameter to retrieve orders that are more recent than the already retrieved ones.

From that list, for each `order_id`, retrieve the data from:
1. `https://api.brickowl.com/v1/order/view` - Full order data (stored in `data.bo.Order`)
2. `https://api.brickowl.com/v1/order/items` - List of BrickOwl items in that order (stored in `data.bo.OrderItem`)

### Parts Collection Page

The Parts Collection page gathers BrickOwl items purchased across all orders. Its BrickOwl tab shows one row per part, grouped by BrickOwl item (BOID), type, and condition. Each row displays:
- Part information
- List of orders containing it (each order ID links to the BrickOwl order page)
- Summed quantity over all those orders

Columns are sortable; the Orders column sorts by the number of orders containing the part.

Data is exposed by: `GET /api/brickowl/parts`

#### Part Information Modal

Clicking a part image in the Part explorer, the BrickOwl parts and order items tables, the PaB parts table, or the Set Inventory table opens a modal with the part details:

- Part image, using the part's default color
- Part number, whether it has alternates, and material
- Part name
- Category chip with the category name; clicking it opens the Part explorer tab, expands the matching category group, selects the category, and highlights the part
- Star rating (editable for main parts, read-only otherwise)
- "Add to collection" button (placeholder, no action yet)
- Available colors: every `PartNumber/ColorId` pair of `data.bt.PartColorUrl` is shown as a colored chip. The color currently used for the part image is highlighted; clicking another chip makes it the default image color.

The default color is stored in `data/bt/part_default_color.csv` and is used by `GET /api/parts/{partNumber}/image` when no `colorId` is given. When the part has no stored default, or the stored color is no longer available, the lowest available color is used.

The modal is implemented once in `js/modules/part-info.js` (`BrickTools.PartInfo`) and reused by every page that renders part images.

**Endpoints:**
- `GET /api/parts/{partNumber}/info` - Returns the name, material, alternates, stars, main-part flag, category, default color, and available colors of a part.
- `PUT /api/parts/{partNumber}/default-color` - Stores the default image color. The body is `{ "colorId": 5 }`; the color must be available for the part.

### Sets Purchase Page

The Sets Purchase page provides various tabs to display purchase data, add/edit purchase data, and show statistics about purchases.

#### Sets Purchase List

This tab shows the list of all purchases made by the user. It displays a table where each row represents a purchased set.

**Columns:**

| Column | Source | Unit/Format |
|--------|--------|-------------|
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

### New Sets Page

The New Sets page presents recently released sets and a shared wishlist. The catalog is built from `data.re.sets` for a single release year. The current year is selected by default.

**Features:**
- Year selector with previous and next buttons at the top of the page
- Clicking the selected year opens a descending list of years from current year down to 1970
- Active filters are kept when the year changes
- Themes whose `hidden` column is true in `data/bt/themes.csv` are excluded from the catalog
- Hidden themes are still resolved for existing wishlist entries

**Page Tabs:**

1. **Themes Tab**: All themes having sets in the selected year, ordered alphabetically. Each theme is a card showing the theme image on its `data.bt.themes.color_primary` background. When a theme has no image, its name is displayed instead. Clicking a card opens the Sets tab filtered on that theme.

2. **Sets Tab**: All sets of the selected year as cards with:
   - Set image
   - Name
   - Number
   - Year
   - Total parts
   - Official price
   - Theme image
   - Button to add/remove the set from the wishlist

   Cards can be filtered by: name, theme, and official price, and by status (New, Purchased, Wishlisted). Wishlisted sets have a yellow card, purchased sets a green card; a set that is both is shown green.

3. **Wishlist Tab**: Wishlisted sets in a table with:
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

**Wishlist Data:**
- Official prices come from `data.bw.SetPrice`
- A set without a stored official price shows a dash until its price is fetched from the Administration page
- Wishlist data model is described in [./doc/DataModel.md](./doc/DataModel.md#wishlist-data)

### Colors

Colors are shared by all pages through `color.js`:

- `BrickColor.getLegoColorId(ext_system, ext_id)` - Resolves an identifier from an external system (`LE`, `BO`, `BL`, `LD`, etc.) to the LEGO color ID used by the application. Reads `data/re/color_mappings.csv` and caches the mapping.
- `BrickColor.getColor(color_id)` - Resolves a color object (`id`, `name`, `rgb`, `isTrans`, `numParts`, `numSets`, `y1`, `y2`) from `data/re/colors.csv`. The file is cached after the first read.
- Both methods return a promise, so they can be called before any color data has been loaded.
- `BrickColor.openColorInfo(color_id)` - Opens a modal showing a chip with the color and a table of the ID and Name used by LEGO (LE), BrickOwl (BO), BrickLink (BL), and LDraw (LD).
- `BrickColor.openColorPicker(current_color_id, onSelect)` - Opens a modal showing the currently selected color with its chip and information, followed by a searchable list of colors. Confirming a choice calls `onSelect` with the selected color object.

The colors are exposed by `GET /api/colors` and the external identifiers by `GET /api/color-mappings`. Both reference files are read once and kept in memory by the server.

## API Documentation

The REST API is documented with OpenAPI (springdoc). When the application is running:

- **Swagger UI**: `http://localhost:8780/swagger-ui/index.html`
- **OpenAPI specification**: `http://localhost:8780/v3/api-docs`

## Data Model

For detailed information about the data models used by BrickTools, see [DataModel.md](./doc/DataModel.md).

## Project Structure

```
bricktools/
├── src/                    # Application source code
│   ├── main/
│   │   ├── java/           # Java backend code
│   │   ├── resources/      # Configuration and static resources
│   │   │   ├── static/     # Frontend assets
│   │   │   │   ├── js/      # JavaScript files
│   │   │   │   ├── css/     # CSS stylesheets
│   │   │   │   └── images/  # Image assets
│   │   │   └── ...         # Other configuration files
│   │   └── ...
│   └── ...
├── data/                   # CSV data files
│   ├── bt/                 # BrickTools data
│   ├── bo/                 # BrickOwl data
│   ├── bw/                 # BrickWatch data
│   ├── re/                 # Rebrickable data
│   └── ...
├── doc/                    # Documentation
│   └── DataModel.md        # Data model documentation
└── README.md               # This file
```

## Setup and Configuration

To set up and run BrickTools:

1. Clone the repository
2. Ensure Java and Maven are installed
3. Run `mvn spring-boot:run` to start the application
4. Access the application at `http://localhost:8780`

## Contributing

Contributions are welcome! Please follow these guidelines:

- Follow the existing code style
- Add appropriate comments to explain complex logic
- Update documentation as needed
- Test your changes thoroughly

## License

This project is for personal use and is self-hosted.
