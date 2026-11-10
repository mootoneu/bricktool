# Administration Page

The Administration page (`admin.html`) groups the maintenance operations of Brick Tools: updating reference data, fetching official prices, downloading set images, backing up the CSV data, and regenerating derived part files.

## Table of Contents

- [Administration Page](#administration-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Rebrickable Update](#rebrickable-update)
  - [BrickWatch Official Price](#brickwatch-official-price)
    - [Fetching from BrickWatch](#fetching-from-brickwatch)
    - [Fetching from Brickonomics](#fetching-from-brickonomics)
  - [Set Images](#set-images)
  - [Data Backup](#data-backup)
  - [Main Parts](#main-parts)
  - [Part Color URLs](#part-color-urls)
  - [API Documentation](#api-documentation)

## Page Contents

The page is a list of cards:

- **Rebrickable update**: downloads the LEGO reference data.
- **BrickWatch official price**: fetches the official price of a set.
- **Set images**: downloads the missing pictures of purchased sets.
- **Data backup**: creates and lists CSV backups.
- **Main parts**: generates `data/bt/main_parts.csv`.
- **Part color URLs**: generates `data/bt/part_color_url.csv`.
- **API Documentation**: links to Swagger UI and the OpenAPI specification.

## Rebrickable Update

Rebrickable is a website providing open data about LEGO. As LEGO releases new sets, the Rebrickable data is updated. Brick Tools relies on Rebrickable data for common LEGO data such as sets, parts, themes, and colors.

The card displays:

- The date of the last download (`Last download`).
- An "Update data" button.
- A warning when the data is older than a month.

Behaviour:

- The "Update data" button is disabled when data has already been downloaded for the day, because Rebrickable terms allow at most one download per day. The button title explains why it is disabled.
- Clicking the button starts the download and displays a progress message; the completion message shows the download date.
- When data is older than a month, a notification reminds the user to perform the update. The check runs at server startup and then once a day.

**Endpoints:**

- `GET /api/rebrickable/status` - Returns `lastDownload`, `canUpdate`, and `stale`.
- `POST /api/rebrickable/update` - Downloads and stores the Rebrickable data.

The downloaded files are described in [DataModel.md](./DataModel.md#rebrickable-data).

## BrickWatch Official Price

BrickWatch is a LEGO price tracking platform. Brick Tools maintains a list of official LEGO prices based on BrickWatch data stored in `data.bw.SetPrice`.

The card contains:

- A set number input.
- A "Fetch official price" button (BrickWatch).
- A "Fetch price with brickonomics" button.

The result message always shows the set number and the formatted price, together with where the price came from (`already stored`, `fetched from BrickWatch`, or `fetched from brickonomics and saved`).

### Fetching from BrickWatch

`GET /api/brickwatch/sets/{setNumber}/price`:

- If the price is already stored, it is returned directly.
- Otherwise the price is scraped from `https://www.brickwatch.net/fr-FR/set/$SETNUMBER` and stored in `data.bw.SetPrice`.
- The price is located in the table after the header "Information sur le prix", in the row starting with "Lego prix conseillé", in the last column.
- At most one request per second is made to BrickWatch to avoid being banned.

### Fetching from Brickonomics

`POST /api/brickonomics/sets/{setNumber}/price`:

- Fetches the retail price from `https://brickonomics.net/set/$SETNUMBER-1`.
- Reads the "Retail price:" entry of the set details.
- Sends the cookies `country=fr` and `currency=EUR`, so the price is in euros.
- Saves the price in `data.bw.SetPrice`, replacing any existing price for the set.
- At most one request per second is made.

## Set Images

The card downloads the missing picture of every purchased set from Rebrickable.

Behaviour:

- Clicking "Download missing images" starts a background job and disables the button while it runs.
- One download is made per second.
- The status line shows the progress (`processed` of `total` sets) and the counts of downloaded, already stored, sets without a picture, and failures, plus the last error when there is one.
- The status is polled every two seconds while the job runs.

**Endpoints:**

- `POST /api/setimg/backfill` - Starts the job. Returns the current status; a second start is rejected while a job is running.
- `GET /api/setimg/backfill` - Returns the current status.
- `GET /api/setimg/{setNumber}` - Returns the stored image of a set.

Images are stored under `data/bt/setsimg` (see [Set Images](./DataModel.md#set-images)).

## Data Backup

The card creates a zip archive containing the user data: purchases, wishlist, official prices, BrickOwl orders, theme settings, people, and vendors.

Behaviour:

- "Back up now" creates a backup in `data/backups`.
- The completion message shows the backup name and the number of files.
- The list shows the name and size in KB of each backup, or "No backup yet".
- The three most recent backups are kept; older ones are removed.

**Endpoints:**

- `GET /api/backups` - Lists the backups.
- `POST /api/backups` - Creates a backup.

## Main Parts

The card generates or updates `data/bt/main_parts.csv` from the Rebrickable parts and the Brick Tools part categories.

Behaviour:

- Parts of hidden categories and child parts are excluded.
- Existing star ratings are kept.
- The completion message reports the number of parts kept, the parts excluded because of hidden categories, the child parts excluded, and the number of parts with alternates.

The resulting file is used by the Part explorer tab of the Parts Collection page. See [Main Parts](./DataModel.md#main-parts).

**Endpoint:** `POST /api/parts/main-parts/generate`

## Part Color URLs

The card generates or updates `data/bt/part_color_url.csv` from the Rebrickable inventory parts.

Behaviour:

- Only the first inventory row of each part/color pair with an image URL is kept.
- Rows without an image URL are skipped.
- The completion message reports the kept part/color pairs, the duplicate rows, and the rows without an image URL.

The resulting file is used to show the available colors of a part in the part information modal. See [Part Image URLs](./DataModel.md#part-image-urls).

**Endpoint:** `POST /api/parts/part-color-urls/generate`

## API Documentation

The last card links to:

- **Swagger UI**: `/swagger-ui/index.html`
- **OpenAPI specification**: `/v3/api-docs`

Both open in a new tab.
