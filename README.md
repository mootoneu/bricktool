# Brick Tools

Brick tools is a personal web application designed to provide several tools to assist the user to manage his Lego collection.
This application is expected to be single user and self-hosted.

The application stack is:

- Backend in Java + Spring Boot
- Frontend in JQuery + D3.js
- Data is stored in csv files, no cloud, no database

## Application features

The application features are split into individual web pages.

All pages have the same header bar, that provides common functionnalities:

- Link to the feature pages
- Notifications

### Landing page

The landing page is the first page the user land on when starting the app.
It provides link in a card to all features.

### Administration page

The administration page enable the user to perform several operation

#### Rebrickable update

Rebrickable is a website providing open data about Lego. As Lego release new sets, the rebrickable data is updated.
BrickTools relies on rebrickable data for common Lego data such as sets, parts, themes, colors...
This feature aims to enable the user to perform a data update, ensuring rebrickable data is kept up to date.

Requirements:

- This feature will be displayed in a card in the Administration page.
- It provide an "update data" button to start the download of the rebrickable data (see [./doc/DataModel.md]).
- It shall display the date of last download of the rebrickable data.
- As the Rebrickable terms allows to download the data at most once a day, the "update data" button must be disabled if the data has already been downloaded for the day.
- When the data is older than a month, a notification will be sent to remind the user to perform the update. Clicking that notification will redirect to this card. This event should be checked at server startup and then once a day.

#### BrickWatch sets official price update

BrickWatch is a Lego price tracking platform. Brick tools will maintain a list of official Lego prices based on BrickWatch data stored in external.brickwatch.setprices
This feature aims to enable the user to perform that data update.

Requirements:

- This feature will be displayed in a card in the Administration page.
- The user can enter a SetNumber and click the "Fetch official price" button
  - If the price is already in setprice it displays the price stored
  - Else the price is scrapped (see below) and stored in data.bw.setprices csv

##### Scrapping set price data

Set data can be scrapped with the url <https://www.brickwatch.net/fr-FR/set/$SETNUMBER> where $SETNUMBER correspond to the SetNumber.
The corresponding price is located in the table after the header "Information sur le prix", in the row starting with "Lego prix conseillé", in the last column.
A one second delay must be implement to ensure two requests are not performed too fast from one another. This is essential to prevent a ban from BrickWatch.

#### Brickonomics official price

The Administration BrickWatch card also has a "Fetch price with brickonomics" button. It fetches the retail price from Brickonomics and saves it in data.bw.setprices csv, replacing any price already stored for the set. It is used instead of BrickWatch because BrickWatch bans scrapers.

- The price is read from <https://brickonomics.net/set/$SETNUMBER-1>, in the "Retail price:" entry of the set details.
- The request sends the cookies `country=fr` and `currency=EUR` so the price is in euros.
- At most one request per second is made.

#### BrickOwl page

BrickOwl is a website that allows to purchase Lego sets, minifigs and parts individualy. This feature aims to prodive a tracking of past orders from BrickOwl.

The page should contain several tabs:

- a tab that shows statistics about the orders
- a tab with a button to update the data from BrickOwl.
- a tab that displays a list of BrickOwl orders (data.bo.Order)
- a tab that displays the items purchased in the selected BrickOwl order (data.bo.OrderItems)

##### BrickOwl Statistics tabs

This tab presents information about the orders such as:

- a card with the total amount, pieces, minifigs and sets purchased.
- a card with the average/median amount, pieces, price per pieces, price per kg, minifigs and sets purchased.
- several cards with histograms grouped by Store, showing the respectively the amout, pieces, price per pieces, price per kg, minifigs and sets purchased each year.

##### Update order data from BrickOwl

BrickOwl provide a public API at <https://www.brickowl.com/api_docs>

The GET endpoint <https://api.brickowl.com/v1/order/list> returns the list of BrickOwl orders. If any order have already been retrieved, it must be called with the parameter order_time to retrieve orders that are more recent than the one already retrieved.
From that list, for each order_id, retrieve the data at:

 1. <https://api.brickowl.com/v1/order/view> to get the full data of an order. The result must be stored in the data model data.bo.Order
 2. <https://api.brickowl.com/v1/order/items> to get the list of BrickOwl items in that order. The results must be stored in the data model data.bo.OrderItem

### Sets Purchase page

The Sets Purchase page provides various tabs to display the purchase data, add and edit purchase data and show statistics about purchases.

#### Sets Purchase list

This tab shows the list of all purchases made by the user.
It displays a table whose rows represent a set bought.
Columns are sortable

The columns are:

| Column Name | Source | Unit/Format |
| :--- | :--- |
| Purchase Id | data.bt.PurchasedSet.Id | |
| Set Number | data.bt.PurchasedSet.SetNumber| |
| Name | data.re.sets.name| |
| Total parts | data.re.sets.num_parts| |
| Year | data.re.sets.year| |
| Theme | data.re.themes.name | |
| Official Price | data.bw.SetPrice.LegoPrice | € |
| Price | data.bt.PurchasedSet.PurchasePrice | € |
| Promo | data.bt.PurchasedSet.PurchasePrice/data.bw.SetPrice.LegoPrice| % |
| Date | data.bt.PurchasedSet.PurchaseDate  | yyyy/MM/dd |
| Vendor | data.bt.PurchasedSet.Vendor | colored label (enumeration) |
| Buyer | data.bt.PurchasedSet.BroughtBy | colored label (enumeration) |
| Owner | data.bt.PurchasedSet.Owner | colored label (enumeration) |
| Parts missing | data.bt.PurchasedSet.PartMissings | |
| Complete | 1 - (data.bt.PurchasedSet.PartMissings / data.re.sets.num_parts) | % |
| Owned ? | data.bt.PurchasedSet.Owned | checkbox |
| Reason | data.bt.PurchasedSet.Reason | |
| Sites | | Open button showing the external websites for the set |
| Image | data/bt/setsimg/$SetNumber.$Ext, downloaded once from data.re.sets.img_url | image |

Vendor, Buyer and Owner are enumerations (see [./doc/DataModel.md](./doc/DataModel.md#enumerations)). The add/edit form proposes the existing values and accepts new ones.

The Open button in the Sites column opens a modal listing the websites that document the set: Lego, Lego instructions, Rebrickable, BrickLink, BrickOwl, BrickWatch, Brickonomics, Amazon, Fnac and CDiscount. Each website is a clickable image that opens the set page in a new tab.

To join data:

- data.bt.PurchasedSet.SetNumber = data.bw.SetPrice.SetNumber
- data.bt.PurchasedSet.SetNumber + '-1' = data.re.sets.set_num
- data.re.sets.theme_id = data.re.themes.id

### New Sets page

The New Sets page presents recently released sets and a shared wishlist. The catalogue is built from data.re.sets and limited to the current year when the current date is after 31 July; otherwise it contains both the current and the previous year.

Themes whose `hidden` column is true in data/bt/themes.csv are excluded from the catalogue: neither their theme card nor their sets are shown. This keeps utility and promotional themes (gear, books, storage, …) out of the page. Hidden themes are still resolved for existing wishlist entries, so an entry added before a theme was hidden keeps its name, theme image and price.

The page has three tabs:

- **Themes**: all themes having sets in the period, ordered alphabetically. Each theme is a card showing the theme image on its data.bt.themes.color_primary background. When the theme has no image, its name is displayed instead. Clicking a card opens the Sets tab filtered on that theme.
- **Sets**: all sets of the period as cards with the set image, name, number, year, total parts, official price, theme image and a button to add or remove the set from the wishlist. The cards can be filtered by name, theme and official price, and restricted to wishlisted sets. Clicking a card (outside its wishlist button) opens the same external websites modal as the Sets Purchase list. Wishlisted sets have a yellow card and purchased sets a green card; a set that is both is shown green.
- **Wishlist**: the wishlisted sets in a table with name, year, total parts, theme image, official price, member, buyer, priority and wishlist date. The buyer is the family member who should buy the set in the future and is optional. The table can be filtered by name, theme, member, priority and official price. Each row can be edited, deleted, or bought: Buy records the set as a purchase using its official price, today's date and the wishlist member as owner, then removes it from the wishlist and opens the Sets Purchase list.

The wishlist data model is described in [./doc/DataModel.md](./doc/DataModel.md#wishlist-data). Official prices come from data.bw.SetPrice; a set without a stored official price shows a dash until its price is fetched from the Administration page.

