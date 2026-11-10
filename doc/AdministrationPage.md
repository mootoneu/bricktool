# Administration Page

This document describes the administration page enables users to perform several operations.

## Table of Contents

- [Administration Page](#administration-page)
  - [Table of Contents](#table-of-contents)
  - [Rebrickable Update](#rebrickable-update)
  - [BrickWatch Sets Official Price Update](#brickwatch-sets-official-price-update)
    - [Scraping Set Price Data](#scraping-set-price-data)
  - [Brickonomics Official Price](#brickonomics-official-price)

## Rebrickable Update

Rebrickable is a website providing open data about LEGO. As LEGO releases new sets, the Rebrickable data is updated. BrickTools relies on Rebrickable data for common LEGO data such as sets, parts, themes, and colors.

**Requirements:**

- Displayed in a card in the Administration page
- Provides an "Update data" button to start the download of Rebrickable data (see [./doc/DataModel.md](./doc/DataModel.md))
- Displays the date of the last download
- The "Update data" button is disabled if data has already been downloaded for the day (Rebrickable terms allow downloads at most once a day)
- When data is older than a month, a notification reminds the user to perform the update
- This check runs at server startup and then once a day

## BrickWatch Sets Official Price Update

BrickWatch is a LEGO price tracking platform. BrickTools maintains a list of official LEGO prices based on BrickWatch data stored in `external.brickwatch.setprices`.

**Requirements:**

- Displayed in a card in the Administration page
- User can enter a SetNumber and click the "Fetch official price" button
  - If the price is already in setprice, it displays the stored price
  - Otherwise, the price is scraped and stored in `data.bw.setprices` CSV

### Scraping Set Price Data

Set data can be scraped from: `https://www.brickwatch.net/fr-FR/set/$SETNUMBER`

- The corresponding price is located in the table after the header "Information sur le prix"
- In the row starting with "Lego prix conseillé", in the last column
- A one-second delay must be implemented between requests to prevent being banned by BrickWatch

## Brickonomics Official Price

The Administration BrickWatch card also has a "Fetch price with brickonomics" button. It fetches the retail price from Brickonomics and saves it in `data.bw.setprices` CSV, replacing any existing price for the set.

**Requirements:**

- Price is read from: `https://brickonomics.net/set/$SETNUMBER-1`
- In the "Retail price:" entry of the set details
- Request sends cookies: `country=fr` and `currency=EUR` (so the price is in euros)
- At most one request per second is made
