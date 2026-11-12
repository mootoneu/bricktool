# Brick Tools

Brick Tools is a personal web application that provides several tools to help manage a LEGO collection. It is designed to be single-user and self-hosted.

## AI transparency

I'm making this project to explore creating an application with several AI agents. For this, the project regroups the collection of tools and sheets I've developed in the past years into a single application.
The building process is to define the data model (as most CSV files already exist), write the requirements, and ask an AI agent to write the code. The code is then manually verified and the results are tested.

## Application Stack

- **Backend**: Java + Spring Boot
- **Frontend**: jQuery + D3.js
- **Data Storage**: CSV files (no cloud, no database)

## Table of Contents

- [Brick Tools](#brick-tools)
  - [AI transparency](#ai-transparency)
  - [Application Stack](#application-stack)
  - [Table of Contents](#table-of-contents)
  - [Application Features](#application-features)
    - [Highlights](#highlights)
  - [Documentation](#documentation)
  - [API Documentation](#api-documentation)
  - [Data Model](#data-model)
  - [Project Structure](#project-structure)
  - [Setup and Configuration](#setup-and-configuration)
  - [Development](#development)
  - [Contributing](#contributing)
  - [License](#license)

## Application Features

All pages share a common header with links to every feature page, the active page highlighted, and a notification bell. The interface uses a LEGO-inspired palette, and actions use accessible icon buttons with tooltips. The last visited feature page is restored when the application is opened. See [Common Features](./doc/CommonFeatures.md) for the shared behaviour.

| Page | What it does |
| ---- | ------------ |
| [Landing page](src/main/resources/static/index.html) | Cards linking to every feature page. |
| [Sets Purchase](./doc/SetPurchasePage.md) | Statistics, purchase list, purchased-set cards, and the parts inventory of a set. |
| [BrickOwl](./doc/BrickOwlPage.md) | Statistics and history of BrickOwl orders and their items. |
| [Parts Collection](./doc/PartsCollectionPage.md) | Part explorer with a cross-category search and multi-selection, part storages and drawers, a collection search, Pick-a-Brick purchases and parts, and BrickOwl parts aggregated across orders. |
| [New Sets](./doc/NewSetsPage.md) | Recently released sets by theme, with prices and a shared wishlist. |
| [Administration](./doc/AdministrationPage.md) | Reference data updates, official price fetching, set image download, backups, and derived part files. |

### Highlights

- **Sets Purchase**: tracks official price, paid price, promo, completeness, ownership, vendor, buyer, and owner. The **Sets** tab shows the purchased sets as cards filtered by purchase year. The **Set Inventory** tab records the parts actually owned for a set.
- **BrickOwl**: fetches orders and items from the BrickOwl API, then shows totals, averages, per-store/per-year histograms, and the full order history.
- **Parts Collection**: explores the part catalogue by category with star ratings and alternates, searches part numbers or names across all categories, and selects several parts to set their stars or add them to the active container at once; manages physical part storages and drawers, searches the collection by part, color, category, or tag, manages Pick-a-Brick purchases; lists BrickOwl items with their orders and total quantities. Part images open a shared information modal with the part category, stars, and available colors.
- **New Sets**: browses sets of a release year by theme or as cards, highlights purchased and wishlisted sets, and manages a wishlist with members, buyers, and priorities.
- **Administration**: updates Rebrickable data (once a day), fetches official prices from BrickWatch or Brickonomics, downloads missing set images, creates CSV backups, and regenerates main parts and part color URLs.

## Documentation

Detailed documentation lives in `doc/`:

- [Common Features](./doc/CommonFeatures.md) - header, navigation, tabs, visual style and icons, active container, formatting, API access, tables, part images, colors, and remembered form values.
- [Sets Purchase Page](./doc/SetPurchasePage.md) - statistics, purchases, sets, and set inventory tabs.
- [BrickOwl Page](./doc/BrickOwlPage.md) - statistics, update, orders, and order items tabs.
- [Parts Collection Page](./doc/PartsCollectionPage.md) - part explorer, part storages and drawers, collection search, Pick-a-Brick, BrickOwl parts, and the part information modal.
- [New Sets Page](./doc/NewSetsPage.md) - themes, sets, and wishlist tabs.
- [Administration Page](./doc/AdministrationPage.md) - maintenance operations and their endpoints.
- [Data Model](./doc/DataModel.md) - every CSV model, its fields, relationships, and storage location.

## API Documentation

The REST API is documented with OpenAPI (springdoc). When the application is running:

- **Swagger UI**: `http://localhost:8780/swagger-ui/index.html`
- **OpenAPI specification**: `http://localhost:8780/v3/api-docs`

Every page documentation lists the endpoints it uses.

## Data Model

For detailed information about the data models used by Brick Tools, see [DataModel.md](./doc/DataModel.md).

The CSV data lives in `data/` and is not committed to the repository:

| Folder | Content |
| ------ | ------- |
| `data/re/` | Rebrickable reference data (sets, parts, themes, colors, mappings) |
| `data/le/` | LEGO data (Pick-a-Brick part prices) |
| `data/bw/` | BrickWatch official set prices |
| `data/bo/` | BrickOwl orders and order items |
| `data/bt/` | Brick Tools data (purchases, wishlist, themes, part files, inventory) |
| `data/other/` | People, vendors, downloaded part images, and helper scripts |
| `data/backups/` | Generated backup archives |

## Project Structure

```
bricktools/
├── src/
│   ├── main/
│   │   ├── java/com/bricktools/   # Spring Boot backend
│   │   └── resources/
│   │       ├── application.yml    # Port, data directory, provider settings
│   │       └── static/            # Frontend assets
│   │           ├── js/            # Page controllers and shared helpers
│   │           │   └── modules/   # Feature modules
│   │           ├── css/           # Stylesheets
│   │           └── img/           # Images
│   └── test/                      # Unit and API tests
├── data/                          # CSV data (gitignored)
├── doc/                           # Page, feature, and data model documentation
├── pom.xml
└── README.md
```

## Setup and Configuration

To set up and run Brick Tools:

1. Clone the repository.
2. Ensure Java and Maven are installed.
3. Provide the CSV data under `data/` (the folder is gitignored).
4. Run `mvn spring-boot:run`.
5. Open `http://localhost:8780`.

Configuration is in `src/main/resources/application.yml`:

- `server.port` - HTTP port (default `8780`).
- `bricktools.data-dir` - CSV data directory (default `./data`).
- `bricktools.rebrickable.download-url` - Rebrickable download archive.
- `bricktools.brickwatch.base-url` and `min-delay-ms` - BrickWatch scraping settings.
- `bricktools.brickowl.base-url` and `api-key` - BrickOwl API settings.

## Development

- Build: `mvn -B package`
- Run the tests: `mvn -B test`
- Run the application: `mvn spring-boot:run`
- Check a JavaScript file: `node --check path/to/file.js`

The frontend is plain JavaScript served from `src/main/resources/static`. There is no build step for the static assets; restart or repackage the application after changing them.

## Contributing

Contributions are welcome! Please follow these guidelines:

- Follow the existing code style.
- Add appropriate comments to explain complex logic.
- Update the documentation when behaviour changes.
- Test your changes thoroughly.

## License

The project and code are under the terms of the GPL-3.0 license.
