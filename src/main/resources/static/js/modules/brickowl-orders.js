/**
 * BrickOwl - Orders Module
 * Handles orders list and order items display
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Load orders from API
   * @returns {jQuery} Promise
   */
  function loadOrders() {
    return BrickTools.api('GET', '/brickowl/orders')
      .done(function(list) {
        BrickTools.BrickOwlShared.setOrders(list);
        renderOrders();
        renderOrderSelect();
      })
      .fail(function(xhr) { BrickTools.BrickOwlShared.report('#bo-update-msg', BrickTools.errorOf(xhr)); });
  }

  /**
   * Render the orders table
   */
  function renderOrders() {
    const orders = BrickTools.BrickOwlShared.getOrders();
    const sortState = BrickTools.BrickOwlShared.getSortState();
    const fmt = BrickTools.BrickOwlShared.fmt;
    const esc = BrickTools.BrickOwlShared.esc;
    
    const $tbody = $('#bo-orders tbody').empty();
    if (orders.length === 0) {
      $tbody.append('<tr><td colspan="10" class="muted">No orders yet. Run an update from the Update tab.</td></tr>');
      return;
    }
    BrickTools.BrickOwlShared.markSortedHeader('#bo-orders', sortState.orders);
    BrickTools.BrickOwlShared.sortRows(orders, sortState.orders).forEach(function(o) {
      const cells = [o.OrderTime, o.StoreName, o.Weight, o.TotalParts, o.TotalLots,
        fmt.money(o.PaidTotal), fmt.money(o.RefundTotal), fmt.money(o.Total)];
      const url = 'https://www.brickowl.com/user/934717/orders/' + encodeURIComponent(o.Id);
      $tbody.append('<tr class="clickable" data-id="' + esc(o.Id) + '">' +
        '<td><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(o.Id) + '</a></td>' +
        cells.map(function(v) { return '<td>' + esc(v) + '</td>'; }).join('') +
        '<td><button type="button" class="btn secondary bo-items" data-id="' + esc(o.Id) + '">Items</button></td>' +
        '</tr>');
    });
  }

  /**
   * Render the order select dropdown
   */
  function renderOrderSelect() {
    const orders = BrickTools.BrickOwlShared.getOrders();
    const $select = $('#bo-order-select');
    const current = $select.val();
    $select.empty();
    orders.forEach(function(o) {
      $select.append($('<option></option>').val(o.Id).text(o.Id + ' - ' + o.OrderTime + ' - ' + o.StoreName));
    });
    if (current) {
      $select.val(current);
    }
  }

  /**
   * Render the items table
   */
  function renderItems() {
    const items = BrickTools.BrickOwlShared.getItems();
    const sortState = BrickTools.BrickOwlShared.getSortState();
    const fmt = BrickTools.BrickOwlShared.fmt;
    
    const $tbody = $('#bo-items tbody').empty();
    BrickTools.BrickOwlShared.markSortedHeader('#bo-items', sortState.items);
    if (items.length === 0) {
      $tbody.append('<tr><td colspan="10" class="muted">No items for this order.</td></tr>');
      return;
    }
    BrickTools.BrickOwlShared.sortRows(items, sortState.items).forEach(function(i) {
      const $row = $('<tr></tr>');
      const name = BrickTools.getPartNameFromBOName(i.Name, i.ColorName);
      $row.append(BrickTools.partImageCell(
        BrickTools.partImageUrls(i.ItemNumbers, i.DesignIds), name,
        BrickTools.firstCommaValue(i.DesignIds)));
      $row.append($('<td></td>').text(i.Type));
      $row.append($('<td></td>').text(name));
      $row.append(BrickTools.BrickOwlShared.renderColorCell(i));
      $row.append($('<td></td>').text(i.DesignIds));
      $row.append($('<td></td>').text(i.ItemNumbers));
      $row.append($('<td></td>').text(i.Condition));
      $row.append($('<td></td>').text(i.Quantity));
      $row.append($('<td></td>').text(fmt.money(i.ItemPrice)));
      $row.append($('<td></td>').text(fmt.money(i.TotalPrice)));
      $tbody.append($row);
    });
  }

  /**
   * Load items for a specific order
   * @param {string} orderId - Order ID
   */
  function loadItems(orderId) {
    BrickTools.BrickOwlShared.setItems([]);
    $('#bo-items tbody').empty();
    if (!orderId) {
      return;
    }
    BrickTools.api('GET', '/brickowl/orders/' + encodeURIComponent(orderId) + '/items')
      .done(function(list) {
        BrickTools.BrickOwlShared.setItems(list);
        renderItems();
      })
      .fail(function(xhr) { BrickTools.BrickOwlShared.report('#bo-update-msg', BrickTools.errorOf(xhr)); });
  }

  /**
   * Show items for a specific order
   * @param {string} orderId - Order ID
   */
  function showItems(orderId) {
    $('#bo-order-select').val(orderId);
    $('[data-tab="items"]').trigger('click');
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the orders module
   */
  function init() {
    // Orders table sorting
    $('#bo-orders thead').on('click', 'th[data-key]', function() {
      const key = $(this).attr('data-key');
      BrickTools.BrickOwlShared.sortBy(BrickTools.BrickOwlShared.getSortState().orders, key);
      renderOrders();
    });

    // Items table sorting
    $('#bo-items thead').on('click', 'th[data-key]', function() {
      const key = $(this).attr('data-key');
      BrickTools.BrickOwlShared.sortBy(BrickTools.BrickOwlShared.getSortState().items, key);
      renderItems();
    });

    // Row click for orders
    $('#bo-orders').on('click', 'tbody tr[data-id]', function(e) {
      if ($(e.target).closest('a, button').length) {
        return;
      }
      showItems($(this).attr('data-id'));
    });

    // Items button click
    $('#bo-orders').on('click', '.bo-items', function() {
      showItems($(this).attr('data-id'));
    });

    // Order select change
    $('#bo-order-select').on('change', function() {
      loadItems($(this).val());
    });

    // Update button
    $('#bo-update').on('click', function() {
      const $button = $(this).prop('disabled', true);
      BrickTools.BrickOwlShared.report('#bo-update-msg', 'Updating from BrickOwl, this may take a while...');
      BrickTools.api('POST', '/brickowl/update')
        .done(function(r) {
          BrickTools.BrickOwlShared.report('#bo-update-msg', 'Update completed: ' + r.added + ' new order(s), ' + r.total + ' in total.');
        })
        .fail(function(xhr) { BrickTools.BrickOwlShared.report('#bo-update-msg', BrickTools.errorOf(xhr)); })
        .always(function() {
          $button.prop('disabled', false);
          BrickTools.BrickOwlStats.loadStats();
          loadOrders();
        });
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.BrickOwlOrders = {
    init: init,
    loadOrders: loadOrders,
    renderOrders: renderOrders,
    renderOrderSelect: renderOrderSelect,
    renderItems: renderItems,
    loadItems: loadItems,
    showItems: showItems
  };
})();
