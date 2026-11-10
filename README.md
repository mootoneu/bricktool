# Brick Tools

Brick Tools is a personal web application designed to provide several tools to assist the user in managing their LEGO collection. This application is expected to be single-user and self-hosted.

## AI transparency

I'm making this project to explore creating an application with several AI agents. For this the project regroup the collection of tools and sheets I've developped in the past years into a single application.
The building process is to define the data model (as most csv files already exists), to write the requirements and to ask an AI agent to write the code. Then manually verifying the code written and testing the results.

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
  - [Common Features](#common-features)
    - [Landing Page](#landing-page)
    - [Administration Page](#administration-page)
    - [BrickOwl Page](#brickowl-page)
    - [Parts Collection Page](#parts-collection-page)
    - [Sets Purchase Page](#sets-purchase-page)
    - [New Sets Page](#new-sets-page)
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

## Common Features

Some features are common amongs all pages.

See [./doc/CommonFeatures.md](./doc/CommonFeatures.md)

### Landing Page

The landing page is the first page users see when starting the application. It provides links in cards to all available features.

### Administration Page

The administration page enables users to perform several operations. 

See [./doc/AdministrationPage.md](./doc/AdministrationPage.md)

### BrickOwl Page

[BrickOwl](https://www.brickowl.com/) is a website that allows purchasing LEGO sets, minifigures, and parts individually.
This feature provides tracking of past orders from BrickOwl.

See [./doc/BrickOwlPage.md](./doc/BrickOwlPage.md)

### Parts Collection Page

The Parts Collection page allows the user to track his collection of parts brought, explore all existing parts...

See [./doc/PartsCollectionPage.md](./doc/PartsCollectionPage.md)

### Sets Purchase Page

The Sets Purchase page provides various tabs to display purchase data, add/edit purchase data, and show statistics about purchases.

See [./doc/SetPurchasePage.md](./doc/SetPurchasePage.md)

### New Sets Page

The New Sets page presents recently released sets and a shared wishlist. The catalog is built from `data.re.sets` for a single release year. The current year is selected by default.

See [./doc/NewSetsPage.md](./doc/NewSetsPage.md)


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

The project and code is under the terms of the GPL-3.0 license: [./LICENSE](./LICENSE)