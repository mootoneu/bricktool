$(function () {
  'use strict';

  BrickTools.initHeader('brickowl');

  const fmt = BrickTools.fmt;
  const esc = BrickTools.esc;

  const METRICS = [
    { key: 'amount', label: 'Amount', format: fmt.money },
    { key: 'pieces', label: 'Pieces', format: fmt.number },
    { key: 'pricePerPiece', label: 'Price per piece', format: fmt.money },
    { key: 'pricePerKg', label: 'Price per kg', format: fmt.money },
    { key: 'minifigs', label: 'Minifigs', format: fmt.number },
    { key: 'sets', label: 'Sets', format: fmt.number }
  ];

  let orders = [];
  let items = [];
  const sortState = {
    orders: { key: null, dir: 1 },
    items: { key: null, dir: 1 }
  };

  function compareValues(a, b, dir) {
    const x = a == null ? '' : String(a);
    const y = b == null ? '' : String(b);
    if (x === '') return 1;
    if (y === '') return -1;
    const nx = Number(x), ny = Number(y);
    if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * dir;
    return x.localeCompare(y, undefined, { numeric: true }) * dir;
  }

  function sortRows(rows, state) {
    if (!state.key) {
      return rows;
    }
    return rows.slice().sort((a, b) => compareValues(a[state.key], b[state.key], state.dir));
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

  function loadStats() {
    return BrickTools.api('GET', '/brickowl/stats')
      .done(renderStats)
      .fail(function (xhr) { report('#bo-stats-msg', BrickTools.errorOf(xhr)); });
  }

  function renderStats(stats) {
    report('#bo-stats-msg', '');
    const t = stats.totals;

    const totals = [
      ['Total amount', fmt.money(t.amount)],
      ['Pieces', fmt.number(t.pieces)],
      ['Minifigs', fmt.number(t.minifigs)],
      ['Sets', fmt.number(t.sets)],
      ['Orders', fmt.number(t.orders)]
    ];
    $('#bo-totals').html(totals.map(([label, value]) =>
      '<div class="stat"><h3>' + esc(label) + '</h3><div class="value">' + esc(value) + '</div></div>'
    ).join(''));

    const rows = METRICS.map(m => {
      const avg = stats.averages[m.key];
      return '<tr><th>' + esc(m.label) + '</th><td>' + esc(m.format(avg.mean)) + '</td><td>' +
        esc(m.format(avg.median)) + '</td></tr>';
    }).join('');
    $('#bo-averages').html(
      '<section class="card"><h2>Averages per order</h2><div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Metric</th><th>Mean</th><th>Median</th></tr></thead><tbody>' + rows +
      '</tbody></table></div></section>'
    );

    const storeRows = stats.byStoreYear.map(d => ({ ...d, store: d.store || 'Unknown store', year: String(d.year) }));
    const stores = Array.from(new Set(storeRows.map(d => d.store))).sort((a, b) => a.localeCompare(b));
    const years = Array.from(new Set(storeRows.map(d => d.year))).sort((a, b) => a.localeCompare(b));
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(stores);
    const byKey = new Map(storeRows.map(d => [d.store + '\u0000' + d.year, d]));

    const $legend = $('<div class="legend"></div>');
    stores.forEach(s => $legend.append($('<span class="legend-item"></span>')
      .append($('<span class="legend-swatch"></span>').css('background-color', color(s)))
      .append(document.createTextNode(' ' + s))));

    const $card = $('<section class="card"></section>')
      .append($('<h2>Histograms by year</h2>'))
      .append($legend);
    const $grid = $('<div class="grid"></div>').appendTo($card);
    METRICS.forEach(m => drawBars($('<div></div>').appendTo($grid)[0], storeRows, byKey, years, stores, color, m));
    $('#bo-histograms').empty().append($card);
  }

  function drawBars(el, rows, byKey, years, stores, color, metric) {
    const width = 320, height = 180;
    const margin = { top: 24, right: 8, bottom: 28, left: 56 };
    const valueOf = (store, year) => {
      const d = byKey.get(store + '\u0000' + year);
      return d ? d[metric.key] || 0 : 0;
    };
    const groups = years.map(year => ({
      year,
      bars: stores.map(store => ({ store, year, value: valueOf(store, year) }))
    }));

    const x = d3.scaleBand()
      .domain(years)
      .range([margin.left, width - margin.right])
      .padding(0.2);
    const x1 = d3.scaleBand()
      .domain(stores)
      .range([0, x.bandwidth()])
      .padding(0.1);
    const y = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d[metric.key] || 0) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3.select(el).append('svg')
      .attr('class', 'chart')
      .attr('viewBox', `0 0 ${width} ${height}`);

    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', margin.left)
      .attr('y', 14)
      .text(metric.label);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4));

    svg.selectAll('g.group')
      .data(groups)
      .join('g')
      .attr('class', 'group')
      .attr('transform', d => `translate(${x(d.year)},0)`)
      .selectAll('rect')
      .data(d => d.bars)
      .join('rect')
      .attr('x', d => x1(d.store))
      .attr('width', x1.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => y(0) - y(d.value))
      .attr('fill', d => color(d.store))
      .append('title')
      .text(d => `${d.store} ${d.year}: ${metric.format(d.value)}`);
  }

  function loadOrders() {
    return BrickTools.api('GET', '/brickowl/orders')
      .done(function (list) {
        orders = list;
        renderOrders();
        renderOrderSelect();
      })
      .fail(function (xhr) { report('#bo-update-msg', BrickTools.errorOf(xhr)); });
  }

  function renderOrders() {
    const $tbody = $('#bo-orders tbody').empty();
    if (orders.length === 0) {
      $tbody.append('<tr><td colspan="10" class="muted">No orders yet. Run an update from the Update tab.</td></tr>');
      return;
    }
    markSortedHeader('#bo-orders', sortState.orders);
    sortRows(orders, sortState.orders).forEach(function (o) {
      const cells = [o.OrderTime, o.StoreName, o.Weight, o.TotalParts, o.TotalLots,
        fmt.money(o.PaidTotal), fmt.money(o.RefundTotal), fmt.money(o.Total)];
      const url = 'https://www.brickowl.com/user/934717/orders/' + encodeURIComponent(o.Id);
      $tbody.append('<tr class="clickable" data-id="' + esc(o.Id) + '">' +
        '<td><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(o.Id) + '</a></td>' +
        cells.map(v => '<td>' + esc(v) + '</td>').join('') +
        '<td><button type="button" class="btn secondary bo-items" data-id="' + esc(o.Id) + '">Items</button></td>' +
        '</tr>');
    });
  }

  function renderOrderSelect() {
    const $select = $('#bo-order-select');
    const current = $select.val();
    $select.empty();
    orders.forEach(function (o) {
      $select.append($('<option></option>').val(o.Id).text(o.Id + ' - ' + o.OrderTime + ' - ' + o.StoreName));
    });
    if (current) {
      $select.val(current);
    }
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
      .on('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          $chip.trigger('click');
        }
      });
    $cell.append($chip);
    BrickColor.getLegoColorId('BO', colorId).then(function (legoId) {
      if (legoId === null || legoId === undefined) {
        $chip.text(item.ColorName || '');
        return;
      }
      BrickColor.getColor(legoId).done(function (color) {
        const hex = colorHex(color);
        if (hex) {
          $chip.css({
            'background-color': hex,
            color: readableTextColor(hex)
          });
        } else {
          $chip.text(item.ColorName || '');
        }
      }).fail(function () {
        $chip.text(item.ColorName || '');
      });
    }).fail(function () {
      $chip.text(item.ColorName || '');
    });
    $chip.on('click', function () {
      BrickColor.getLegoColorId('BO', colorId).then(function (legoId) {
        if (legoId !== null && legoId !== undefined) {
          BrickColor.getColor(legoId).done(function (color) {
            if (color) {
              BrickColor.openColorInfo(color.id);
            }
          });
        }
      });
    });
    return $cell;
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
  function renderItems() {
    const $tbody = $('#bo-items tbody').empty();
    markSortedHeader('#bo-items', sortState.items);
    if (items.length === 0) {
      $tbody.append('<tr><td colspan="10" class="muted">No items for this order.</td></tr>');
      return;
    }
    sortRows(items, sortState.items).forEach(function (i) {
      const $row = $('<tr></tr>');
      const name = BrickTools.getPartNameFromBOName(i.Name, i.ColorName);
      $row.append(BrickTools.partImageCell(
        BrickTools.partImageUrls(i.ItemNumbers, i.DesignIds), name));
      $row.append($('<td></td>').text(i.Type));
      $row.append($('<td></td>').text(name));
      $row.append(renderColorCell(i));
      $row.append($('<td></td>').text(i.DesignIds));
      $row.append($('<td></td>').text(i.ItemNumbers));
      $row.append($('<td></td>').text(i.Condition));
      $row.append($('<td></td>').text(i.Quantity));
      $row.append($('<td></td>').text(fmt.money(i.ItemPrice)));
      $row.append($('<td></td>').text(fmt.money(i.TotalPrice)));
      $tbody.append($row);
    });
  }

  function loadItems(orderId) {
    items = [];
    $('#bo-items tbody').empty();
    if (!orderId) {
      return;
    }
    BrickTools.api('GET', '/brickowl/orders/' + encodeURIComponent(orderId) + '/items')
      .done(function (list) {
        items = list;
        renderItems();
      })
      .fail(function (xhr) { report('#bo-update-msg', BrickTools.errorOf(xhr)); });
  }

  function showItems(orderId) {

    $('#bo-order-select').val(orderId);
    $('[data-tab="items"]').trigger('click');
  }

  $('#bo-orders thead').on('click', 'th[data-key]', function () {
    sortBy(sortState.orders, $(this).attr('data-key'));
    renderOrders();
  });

  $('#bo-items thead').on('click', 'th[data-key]', function () {
    sortBy(sortState.items, $(this).attr('data-key'));
    renderItems();
  });

  $('#bo-orders').on('click', 'tbody tr[data-id]', function (e) {
    if ($(e.target).closest('a, button').length) {
      return;
    }
    showItems($(this).attr('data-id'));
  });

  $('#bo-orders').on('click', '.bo-items', function () {
    showItems($(this).attr('data-id'));
  });

  $('#bo-order-select').on('change', function () {
    loadItems($(this).val());
  });

  $('#bo-update').on('click', function () {
    const $button = $(this).prop('disabled', true);
    report('#bo-update-msg', 'Updating from BrickOwl, this may take a while...');
    BrickTools.api('POST', '/brickowl/update')
      .done(function (r) {
        report('#bo-update-msg', 'Update completed: ' + r.added + ' new order(s), ' + r.total + ' in total.');
      })
      .fail(function (xhr) { report('#bo-update-msg', BrickTools.errorOf(xhr)); })
      .always(function () {
        $button.prop('disabled', false);
        loadStats();
        loadOrders();
      });
  });

  BrickTools.initTabs('main', function (name) {
    if (name === 'stats') {
      loadStats();
    } else if (name === 'orders') {
      loadOrders();
    } else if (name === 'items') {
      loadOrders().done(function () {
        if (!$('#bo-order-select').val() && orders.length) {
          $('#bo-order-select').val(orders[0].Id);
        }
        loadItems($('#bo-order-select').val());
      });
    }
  });

  loadStats();
});
