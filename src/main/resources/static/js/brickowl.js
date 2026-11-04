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
      $tbody.append('<tr><td colspan="9" class="muted">No orders yet. Run an update from the Update tab.</td></tr>');
      return;
    }
    orders.forEach(function (o) {
      const cells = [o.Id, o.OrderTime, o.StoreName, o.Weight, o.TotalParts, o.TotalLots,
        fmt.money(o.PaidTotal), fmt.money(o.RefundTotal), fmt.money(o.Total)];
      $tbody.append('<tr class="clickable" data-id="' + esc(o.Id) + '">' +
        cells.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>');
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

  function loadItems(orderId) {
    const $tbody = $('#bo-items tbody').empty();
    if (!orderId) {
      return;
    }
    BrickTools.api('GET', '/brickowl/orders/' + encodeURIComponent(orderId) + '/items')
      .done(function (items) {
        if (items.length === 0) {
          $tbody.append('<tr><td colspan="9" class="muted">No items for this order.</td></tr>');
        }
        items.forEach(function (i) {
          const cells = [i.Type, i.Name, i.ColorName, i.DesignIds, i.ItemNumbers, i.Condition, i.Quantity,
            fmt.money(i.ItemPrice), fmt.money(i.TotalPrice)];
          $tbody.append('<tr>' + cells.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>');
        });
      })
      .fail(function (xhr) { report('#bo-update-msg', BrickTools.errorOf(xhr)); });
  }

  $('#bo-orders').on('click', 'tbody tr[data-id]', function () {
    const id = $(this).attr('data-id');
    $('#bo-order-select').val(id);
    $('[data-tab="items"]').trigger('click');
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
