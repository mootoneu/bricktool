# Brick Tools

Brick Tools is a personal web application designed to provide several tools to assist the user in managing their LEGO collection. This application is expected to be single-user and self-hosted.

## Application Stack

- **Backend**: Java + Spring Boot
- **Frontend**: jQuery + D3.js
- **Data Storage**: CSV files (no cloud, no database)

## Table of Contents

- [Application Features](#application-features)
  - [Landing Page](#landing-page)
  - [Administration Page](#administration-page)
  - [BrickOwl Page](#brickowl-page)
  - [Parts Collection Page](#parts-collection-page)
  - [Sets Purchase Page](#sets-purchase-page)
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

Rebrickable is a website providing open data about LEGO. BrickTools relies on Rebrickable data for common LEGO data such as sets, parts, themes, and colors.

**Requirements:**
- Displayed in a card in the Administration page
- Provides an "Update data" button to start the download
- Displays the date of the last download
- Button is disabled if data has already been downloaded for the day
- Shows notification when data is older than a month

#### BrickWatch Sets Official Price Update

BrickWatch is a LEGO price tracking platform. BrickTools maintains a list of official LEGO prices based on BrickWatch data.

**Requirements:**
- User can enter a SetNumber and click "Fetch official price"
- If the price is already stored, it displays the stored price
- Otherwise, the price is scraped and stored
- One-second delay between requests to prevent being banned

#### Brickonomics Official Price

Alternative price source that fetches the retail price from Brickonomics.

**Requirements:**
- Price is read from: https://brickonomics.net/set/$SETNUMBER-1
- Request sends cookies: country=fr and currency=EUR
- At most one request per second is made

### BrickOwl Page

BrickOwl allows purchasing LEGO sets, minifigures, and parts individually. This feature provides tracking of past orders.

**Tabs:**
- Statistics: Shows statistics about the orders
- Update: Button to update data from BrickOwl
- Orders: List of BrickOwl orders
- Order Items: Items purchased in the selected order

### Parts Collection Page

Gathers BrickOwl items purchased across all orders. Shows one row per part with order information.

**Data**: Exposed by GET /api/brickowl/parts

### Sets Purchase Page

Provides tabs to display purchase data, add/edit purchases, and show statistics.

### New Sets Page

Presents recently released sets and a shared wishlist. The catalog is built from data.re.sets for a single release year.

**Features:**
- Year selector with previous and next buttons
- Themes tab with theme cards
- Sets tab with set cards
- Wishlist tab with wishlist table

### Colors

Colors are shared by all pages through color.js with functions for resolving and displaying color information.

**API Endpoints:**
- GET /api/colors
- GET /api/color-mappings

## API Documentation

The REST API is documented with OpenAPI (springdoc).

- **Swagger UI**: http://localhost:8780/swagger-ui/index.html
- **OpenAPI specification**: http://localhost:8780/v3/api-docs

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
4. Access the application at http://localhost:8780

## Contributing

Contributions are welcome! Please follow these guidelines:

- Follow the existing code style
- Add appropriate comments to explain complex logic
- Update documentation as needed
- Test your changes thoroughly

## License

This project is for personal use and is self-hosted.
