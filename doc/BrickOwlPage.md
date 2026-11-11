# BrickOwl Page

[BrickOwl](https://www.brickowl.com/) is a website that allows purchasing LEGO sets, minifigures, and parts individually. This feature provides tracking of past orders from BrickOwl.

## Table of Contents

- [BrickOwl Page](#brickowl-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
  - [Statistics Tab](#statistics-tab)
  - [Update Tab](#update-tab)
  - [Orders Tab](#orders-tab)
  - [Order Items Tab](#order-items-tab)
  - [Data and Endpoints](#data-and-endpoints)

## Page Contents

- **Statistics** tab (default): totals, averages, and histograms about the orders.
- **Update** tab: fetches new orders and their items from BrickOwl.
- **Orders** tab: lists the stored BrickOwl orders.
- **Order items** tab: lists the items of the selected order.

## Statistics Tab

The tab presents information computed from `data.bo.Order` and `data.bo.OrderItem`:

- **Totals card**: total amount, pieces, minifigures, sets, and orders.
- **Averages per order**: a table with the mean and median of each metric:
  - Amount
  - Pieces
  - Price per piece
  - Price per kg
  - Minifigures
  - Sets
- **Histograms by year**: one chart per metric (amount, pieces, price per piece, price per kg, minifigures, sets), with one bar per store and year. A legend lists the stores and their colors.

**Endpoint:** `GET /api/brickowl/stats`

## Update Tab

The "Update from BrickOwl" button fetches the orders that are more recent than the last stored one, together with their items. The operation may take a while.

- While it runs, the button is disabled and the message "Updating from BrickOwl, this may take a while..." is shown.
- On completion, the message reports the number of new orders and the total number of stored orders.
- Statistics and the orders list are refreshed automatically.

BrickOwl provides a public API at [https://www.brickowl.com/api_docs](https://www.brickowl.com/api_docs).

The update process is:

1. Call `https://api.brickowl.com/v1/order/list`. When orders have already been retrieved, pass the `order_time` parameter to retrieve only orders more recent than the stored ones.
2. For each `order_id`, retrieve:
   - `https://api.brickowl.com/v1/order/view` - full order data, stored in `data.bo.Order`.
   - `https://api.brickowl.com/v1/order/items` - list of items, stored in `data.bo.OrderItem`.

**Endpoint:** `POST /api/brickowl/update`

## Orders Tab

The table lists the stored orders. All columns are sortable:

| Column | Source | Notes |
| ------ | ------ | ----- |
| Order Id | `data.bo.Order.Id` | Links to the order on BrickOwl |
| Order time | `data.bo.Order.OrderTime` | |
| Store | `data.bo.Order.StoreName` | |
| Weight (kg) | `data.bo.Order.Weight` | |
| Parts | `data.bo.Order.TotalParts` | |
| Lots | `data.bo.Order.TotalLots` | |
| Paid | `data.bo.Order.PaidTotal` | € |
| Refund | `data.bo.Order.RefundTotal` | € |
| Total | `data.bo.Order.Total` | € (paid minus refund) |
| Actions | | "Items" and "Set active" buttons |

Clicking the "Items" button, or anywhere on a row outside a link or button, opens the Order items tab for that order. **Set active** makes the order the active container; parts added with "Add to container" are written to `data/bo/order_items.csv` as local lines with the `Added` condition and the part's default color. Adding the same part and color again increments its quantity.

**Endpoint:** `GET /api/brickowl/orders`

## Order Items Tab

The order selector lists every stored order. Selecting an order loads its items.

The table is sortable and shows:

| Column | Source | Notes |
| ------ | ------ | ----- |
| Image | `ItemNumbers`, `DesignIds` | Part/color image, with fallbacks; clicking opens the part information modal |
| Type | `data.bo.OrderItem.Type` | Part, minifig, set, etc. |
| Name | `data.bo.OrderItem.Name` | Cleaned to remove "LEGO", the color name, and trailing part numbers |
| Color | `ColorId` / `ColorName` | Clickable color chip |
| Design ids | `data.bo.OrderItem.DesignIds` | Comma-separated |
| Item numbers | `data.bo.OrderItem.ItemNumbers` | Comma-separated |
| Condition | `data.bo.OrderItem.Condition` | |
| Quantity | `data.bo.OrderItem.Quantity` | |
| Unit price | `data.bo.OrderItem.ItemPrice` | € |
| Total price | `data.bo.OrderItem.TotalPrice` | € |

**Endpoint:** `GET /api/brickowl/orders/{orderId}/items`

## Data and Endpoints

The stored models are described in:

- [`data.bo.Order`](./DataModel.md#databoorder)
- [`data.bo.OrderItem`](./DataModel.md#databoorderitem)

The Parts Collection page also aggregates these items across orders; see [PartsCollectionPage.md](./PartsCollectionPage.md#brickowl-tab).

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/brickowl/stats` | Statistics used by the Statistics tab |
| `POST /api/brickowl/update` | Fetch new orders and items from BrickOwl |
| `GET /api/brickowl/orders` | List stored orders |
| `GET /api/brickowl/orders/{orderId}/items` | List the items of an order |
| `GET /api/brickowl/parts` | Aggregated parts across all orders |
