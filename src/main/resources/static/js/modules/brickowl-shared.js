/**
 * BrickOwl - Shared Utilities Module
 * Common functions and constants used across all BrickOwl modules
 */
(function () {
  'use strict';

  // Initialize namespace
  if (typeof BrickTools === 'undefined') {
    window.BrickTools = {};
  }

  // ============================================================================
  // Constants
  // ============================================================================

  const fmt = BrickTools.fmt;
  const esc = BrickTools.esc;

  /**
   * Metrics for statistics display
   */
  const METRICS = [
    { key: 'amount', label: 'Amount', format: fmt.money },
    { key: 'pieces', label: 'Pieces', format: fmt.number },
    { key: 'pricePerPiece', label: 'Price per piece', format: fmt.money },
    { key: 'pricePerKg', label: 'Price per kg', format: fmt.money },
    { key: 'minifigs', label: 'Minifigs', format: fmt.number },
    { key: 'sets', label: 'Sets', format: fmt.number }
  ];

  // ============================================================================
  // State variables
  // ============================================================================

  let orders = [];
  let items = [];
  const sortState = {
    orders: { key: null, dir: 1 },
    items: { key: null, dir: 1 }
  };

  // ============================================================================
  // Utility functions
  // ============================================================================

  /**
   * Compare two values for sorting
   * @param {*} a - First value
   * @param {*} b - Second value
   * @param {number} dir - Sort direction (1 for ascending, -1 for descending)
   * @returns {number} Comparison result
   */
  function compareValues(a, b, dir) {
    const x = a == null ? '' : String(a);
    const y = b == null ? '' : String(b);
    if (x === '') return 1;
    if (y === '') return -1;
    const nx = Number(x), ny = Number(y);
    if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * dir;
    return x.localeCompare(y, undefined, { numeric: true }) * dir;
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
    return rows.slice().sort(function(a, b) {
      return compareValues(a[state.key], b[state.key], state.dir);
    });
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
   * Determine readable text color (black or white) based on background hex color
   * @param {string} hex - Hex color string
   * @returns {string} Either '#111827' (dark) or '#ffffff' (white)
   */
  function readableTextColor(hex) {
    const full = String(hex || '#e5e7eb').replace('#', '');
    const expanded = full.length === 3 ? full.split('').map(function(c) { return c + c; }).join('') : full.slice(0, 6);
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
      return '#' + rgb.split('').map(function(c) { return c + c; }).join('');
    }
    return null;
  }

  /**
   * Render a color cell with color chip for BrickOwl items
   * @param {Object} item - Item object with ColorId and ColorName
   * @returns {jQuery} jQuery TD element
   */
  function renderColorCell(item) {
    const colorId = String(item.ColorId || '').trim();
    const $cell = $('<td></td>');
    if (!colorId) {
      $cell.text(item.ColorName || '');
      return $cell;
    }
    const $chip = $('<span class="color-chip"></span>')
      .attr('title', item.ColorName || '')
      .text(item.ColorName || '')
      .css('cursor', 'pointer')
      .attr('tabindex', '0')
      .on('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          $chip.trigger('click');
        }
      });
    $cell.append($chip);
    BrickColor.getLegoColorId('BO', colorId).then(function(legoId) {
      if (legoId === null || legoId === undefined) {
        $chip.text(item.ColorName || '');
        return;
      }
      BrickColor.getColor(legoId).done(function(color) {
        const hex = colorHex(color);
        if (hex) {
          $chip.css({
            'background-color': hex,
            color: readableTextColor(hex)
          });
        } else {
          $chip.text(item.ColorName || '');
        }
      }).fail(function() {
        $chip.text(item.ColorName || '');
      });
    }).fail(function() {
      $chip.text(item.ColorName || '');
    });
    $chip.on('click', function() {
      BrickColor.getLegoColorId('BO', colorId).then(function(legoId) {
        if (legoId !== null && legoId !== undefined) {
          BrickColor.getColor(legoId).done(function(color) {
            if (color) {
              BrickColor.openColorInfo(color.id);
            }
          });
        }
      });
    });
    return $cell;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.BrickOwlShared = {
    // Constants
    METRICS: METRICS,
    fmt: fmt,
    esc: esc,
    
    // State accessors
    getOrders: function() { return orders; },
    setOrders: function(data) { orders = data; },
    getItems: function() { return items; },
    setItems: function(data) { items = data; },
    getSortState: function() { return sortState; },
    
    // Utility functions
    compareValues: compareValues,
    sortRows: sortRows,
    sortBy: sortBy,
    markSortedHeader: markSortedHeader,
    report: report,
    readableTextColor: readableTextColor,
    colorHex: colorHex,
    renderColorCell: renderColorCell
  };
})();
