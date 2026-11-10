# BrickOwl Page

[BrickOwl](https://www.brickowl.com/) is a website that allows purchasing LEGO sets, minifigures, and parts individually.
This feature provides tracking of past orders from BrickOwl.

## Table of Contents

- [BrickOwl Page](#brickowl-page)
  - [Table of Contents](#table-of-contents)
  - [Page Contents](#page-contents)
    - [BrickOwl Statistics Tab](#brickowl-statistics-tab)
    - [Update Order Data from BrickOwl](#update-order-data-from-brickowl)

## Page Contents

- Statistics tab: Shows statistics about the orders
- Update tab: Contains a button to update data from BrickOwl
- Orders tab: Displays a list of BrickOwl orders (`data.bo.Order`)
- Order Items tab: Displays the items purchased in the selected BrickOwl order (`data.bo.OrderItems`)

### BrickOwl Statistics Tab

This tab presents information about the orders:

- Card with total amount, pieces, minifigures, and sets purchased
- Card with average/median amount, pieces, price per piece, price per kg, minifigures, and sets purchased
- Several cards with histograms grouped by Store, showing respectively: amount, pieces, price per piece, price per kg, minifigures, and sets purchased each year

### Update Order Data from BrickOwl

BrickOwl provides a public API at [https://www.brickowl.com/api_docs](https://www.brickowl.com/api_docs)

The GET endpoint `https://api.brickowl.com/v1/order/list` returns the list of BrickOwl orders. If any orders have already been retrieved, it must be called with the `order_time` parameter to retrieve orders that are more recent than the already retrieved ones.

From that list, for each `order_id`, retrieve the data from:

1. `https://api.brickowl.com/v1/order/view` - Full order data (stored in `data.bo.Order`)
2. `https://api.brickowl.com/v1/order/items` - List of BrickOwl items in that order (stored in `data.bo.OrderItem`)
