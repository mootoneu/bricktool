/**
 * Parts Collection - Shared Utilities Module
 * Common functions used across all parts collection modules
 */
(function () {
  'use strict';

  const ORDER_URL = 'https://www.brickowl.com/user/934717/orders/';

  // Initialize namespace
  if (typeof BrickTools === 'undefined') {
    window.BrickTools = {};
  }

  // ============================================================================
  // Shared utility functions
  // ============================================================================

  /**
   * Compare two values for sorting purposes
   * @param {*} a - First value
   * @param {*} b - Second value
   * @param {number} dir - Sort direction (1 for ascending, -1 for descending)
   * @returns {number} Comparison result
   */
  function compareValues(a, b, dir) {
    const x = a == null ? '' : String(a);
    const y = b == null ? '' : String(b);
    if (x === '' && y === '') return 0;
    if (x === '') return 1;
    if (y === '') return -1;
    const nx = Number(x), ny = Number(y);
    if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * dir;
    return x.localeCompare(y, undefined, { numeric: true }) * dir;
  }

  /**
   * Get the sort value for a row based on the key
   * @param {Object} row - The row object
   * @param {string} key - The key to sort by
   * @returns {*} The sort value
   */
  function sortValue(row, key) {
    // Sorting the Orders column by the number of orders containing the part is
    // more useful than comparing the order objects themselves.
    if (key === 'orders') {
      return Array.isArray(row.orders) ? row.orders.length : 0;
    }
    return row[key];
  }

  /**
   * Sort rows based on a sort state
   * @param {Array} rows - Array of row objects
   * @param {Object} state - Sort state with key and dir properties
   * @returns {Array} Sorted array of rows
   */
  function sortRows(rows, state) {
    if (!state.key) {
      return rows;
    }
    return rows.slice().sort((a, b) =>
      compareValues(sortValue(a, state.key), sortValue(b, state.key), state.dir));
  }

  /**
   * Toggle sort direction for a sort state
   * @param {Object} state - Sort state object
   * @param {string} key - The key to sort by
   */
  function sortBy(state, key) {
    state.dir = state.key === key ? -state.dir : 1;
    state.key = key;
  }

  /**
   * Mark the sorted header in a table based on sort state
   * @param {string|jQuery} table - Table selector or jQuery object
   * @param {Object} state - Sort state object
   */
  function markSortedHeader(table, state) {
    $(table).find('thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + state.key + '"]')
      .addClass(state.dir > 0 ? 'sort-asc' : 'sort-desc');
  }

  /**
   * Display a report message in a selector
   * @param {string} selector - jQuery selector
   * @param {string} text - Text to display
   */
  function report(selector, text) {
    $(selector).text(text);
  }

  /**
   * Extract order ID from an order object or primitive
   * @param {*} order - Order object or ID
   * @returns {*} The order ID
   */
  function orderIdOf(order) {
    return order && order.id != null ? order.id : order;
  }

  /**
   * Count unique order IDs from an array of parts
   * @param {Array} rows - Array of part objects with orders
   * @returns {number} Count of unique order IDs
   */
  function orderCount(rows) {
    const ids = new Set();
    rows.forEach(function (part) {
      (part.orders || []).forEach(function (order) {
        const id = orderIdOf(order);
        if (id != null && id !== '') {
          ids.add(String(id));
        }
      });
    });
    return ids.size;
  }

  /**
   * Determine readable text color (black or white) based on background hex color
   * @param {string} hex - Hex color string
   * @returns {string} Either '#111827' (dark) or '#ffffff' (white)
   */
  function readableTextColor(hex) {
    const full = String(hex || '#e5e7eb').replace('#', '');
    const expanded = full.length === 3 ? full.split('').map(function (c) { return c + c; }).join('') : full.slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
      return '#111827';
    }
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111827' : '#ffffff';
  }

  /**
   * Normalize a color RGB value to a hex string
   * @param {Object} color - Color object with rgb property
   * @returns {string|null} Hex color string or null if invalid
   */
  function colorHex(color) {
    const rgb = String((color && color.rgb) || '').replace('#', '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(rgb)) {
      return '#' + rgb;
    }
    if (/^[0-9a-fA-F]{3}$/.test(rgb)) {
      return '#' + rgb.split('').map(function (c) { return c + c; }).join('');
    }
    return null;
  }

  /**
   * Render a color cell with color chip for BrickOwl parts
   * @param {Object} part - Part object with colorId and colorName
   * @returns {jQuery} jQuery TD element
   */
  function renderColorCell(part) {
    const colorId = String(part.colorId || '').trim();
    const colorName = part.colorName || '';
    const $cell = $('<td></td>');
    if (!colorId || !colorName) {
      $cell.text(colorName);
      return $cell;
    }
    const $chip = $('<span class="color-chip"></span>')
      .attr('title', colorName)
      .text(colorName)
      .css('cursor', 'pointer')
      .attr('tabindex', '0');
    $cell.append($chip);

    BrickColor.getLegoColorId('BO', colorId).then(function (legoId) {
      if (legoId === null || legoId === undefined) {
        return;
      }
      BrickColor.getColor(legoId).done(function (color) {
        const hex = colorHex(color);
        if (hex) {
          $chip.css({
            'background-color': hex,
            color: readableTextColor(hex)
          });
        }
      });
    });

    function openColor() {
      BrickColor.getLegoColorId('BO', colorId).then(function (legoId) {
        if (legoId !== null && legoId !== undefined) {
          BrickColor.openColorInfo(legoId);
        }
      });
    }

    $chip.on('click', openColor);
    $chip.on('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openColor();
      }
    });
    return $cell;
  }

  /**
   * Render a cell displaying order links
   * @param {Array} orders - Array of order objects
   * @returns {jQuery} jQuery TD element
   */
  function renderOrdersCell(orders) {
    const $cell = $('<td></td>');
    const list = Array.isArray(orders) ? orders : [];
    if (list.length === 0) {
      $cell.text('—');
      return $cell;
    }
    list.forEach(function (order, index) {
      if (index > 0) {
        $cell.append(document.createTextNode(', '));
      }
      const id = String(orderIdOf(order));
      const details = order && typeof order === 'object'
        ? [order.orderTime, order.storeName].filter(Boolean).join(' · ')
        : '';
      const $link = $('<a></a>')
        .attr('href', ORDER_URL + encodeURIComponent(id))
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .text(id);
      if (details) {
        $link.attr('title', details);
      }
      $cell.append($link);
    });
    return $cell;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PartsCollectionShared = {
    ORDER_URL: ORDER_URL,
    compareValues: compareValues,
    sortValue: sortValue,
    sortRows: sortRows,
    sortBy: sortBy,
    markSortedHeader: markSortedHeader,
    report: report,
    orderIdOf: orderIdOf,
    orderCount: orderCount,
    readableTextColor: readableTextColor,
    colorHex: colorHex,
    renderColorCell: renderColorCell,
    renderOrdersCell: renderOrdersCell
  };
})();
