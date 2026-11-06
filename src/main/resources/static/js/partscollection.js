$(function () {
  'use strict';

  BrickTools.initHeader('partscollection');

  const fmt = BrickTools.fmt;
  const ORDER_URL = 'https://www.brickowl.com/user/934717/orders/';

  let parts = [];
  let loading = false;
  let loaded = false;
  const sortState = { key: 'name', dir: 1 };

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

  function sortValue(row, key) {
    // Sorting the Orders column by the number of orders containing the part is
    // more useful than comparing the order objects themselves.
    if (key === 'orders') {
      return Array.isArray(row.orders) ? row.orders.length : 0;
    }
    return row[key];
  }

  function sortRows(rows, state) {
    if (!state.key) {
      return rows;
    }
    return rows.slice().sort((a, b) =>
      compareValues(sortValue(a, state.key), sortValue(b, state.key), state.dir));
  }

  function sortBy(state, key) {
    state.dir = state.key === key ? -state.dir : 1;
    state.key = key;
  }

  function markSortedHeader(table, state) {
    $(table).find('thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + state.key + '"]')
      .addClass(state.dir > 0 ? 'sort-asc' : 'sort-desc');
  }

  function report(selector, text) {
    $(selector).text(text);
  }

  function orderIdOf(order) {
    return order && order.id != null ? order.id : order;
  }

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

  function renderParts() {
    const $tbody = $('#bo-parts-collection tbody').empty();
    markSortedHeader('#bo-parts-collection', sortState);
    if (parts.length === 0) {
      $tbody.append('<tr><td colspan="8" class="muted">No BrickOwl order items yet. ' +
        'Run an update from the <a href="brickowl.html#update">BrickOwl page</a>.</td></tr>');
      return;
    }
    sortRows(parts, sortState).forEach(function (part) {
      const $row = $('<tr></tr>');
      $row.append($('<td></td>').text(part.type || ''));
      $row.append($('<td></td>').text(BrickTools.getPartNameFromBOName(part.name || '', part.colorName || '')));
      $row.append(renderColorCell(part));
      $row.append($('<td></td>').text(part.designIds || ''));
      $row.append($('<td></td>').text(part.itemNumbers || ''));
      $row.append($('<td></td>').text(part.condition || ''));
      $row.append(renderOrdersCell(part.orders));
      $row.append($('<td></td>').text(fmt.number(part.totalQuantity)));
      $tbody.append($row);
    });
  }

  function showError(xhr) {
    parts = [];
    const $tbody = $('#bo-parts-collection tbody').empty();
    $tbody.append($('<tr></tr>').append(
      $('<td colspan="8" class="muted"></td>').text('Unable to load BrickOwl parts.')));
    report('#bo-parts-msg', BrickTools.errorOf(xhr));
  }

  function loadParts() {
    if (loading) {
      return;
    }
    loading = true;
    loaded = true;
    report('#bo-parts-msg', 'Loading BrickOwl parts…');
    BrickTools.api('GET', '/brickowl/parts')
      .done(function (list) {
        parts = Array.isArray(list) ? list : [];
        renderParts();
        if (parts.length === 0) {
          report('#bo-parts-msg', 'No BrickOwl order items stored yet.');
        } else {
          report('#bo-parts-msg', fmt.number(parts.length) + ' distinct parts from ' +
            fmt.number(orderCount(parts)) + ' order(s).');
        }
      })
      .fail(showError)
      .always(function () {
        loading = false;
      });
  }

  $('#bo-parts-collection thead').on('click', 'th[data-key]', function () {
    sortBy(sortState, $(this).attr('data-key'));
    renderParts();
  });

  BrickTools.initTabs('main', function (name) {
    if (name === 'brickowl') {
      loadParts();
    }
  });

  if (!loaded) {
    loadParts();
  }
});
