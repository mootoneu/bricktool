$(function () {
  'use strict';

  BrickTools.initHeader('purchases');

  const fmt = BrickTools.fmt;

  const COLUMNS = [
    { key: 'imageUrl', label: 'Image', image: true, width: 5 },
    { key: 'id', label: 'Purchase Id', width: 4 },
    { key: 'setNumber', label: 'Set Number', width: 5.5 },
    { key: 'name', label: 'Name', width: 6 },
    { key: 'numParts', label: 'Total parts', fmt: fmt.number, width: 5 },
    { key: 'year', label: 'Year', width: 3 },
    { key: 'theme', label: 'Theme', theme: true, width: 5.5 },
    { key: 'officialPrice', label: 'Official Price', fmt: fmt.money, priceFetch: true, width: 5.5 },
    { key: 'price', label: 'Price', fmt: fmt.money, width: 5.5 },
    { key: 'promo', label: 'Promo', fmt: fmt.percent, width: 5 },
    { key: 'purchaseDate', label: 'Date', width: 7 },
    { key: 'vendor', label: 'Vendor', logo: true, width: 5.5 },
    { key: 'broughtBy', label: 'Buyer', avatar: true, width: 5 },
    { key: 'owner', label: 'Owner', avatar: true, width: 5 },
    { key: 'partsMissing', label: 'Parts missing', fmt: fmt.number, width: 5 },
    { key: 'complete', label: 'Complete', fmt: fmt.percent, width: 5 },
    { key: 'owned', label: 'Owned ?', width: 3.5 },
    { key: 'reason', label: 'Reason', width: 4 },
    { key: 'links', label: 'Sites', links: true, width: 5 }
  ];

  const OPTION_LISTS = [
    { list: 'vendor-options', key: 'vendors' },
    { list: 'buyer-options', key: 'buyers' },
    { list: 'owner-options', key: 'owners' }
  ];

  const FILTERS = {
    name: '#filter-name',
    number: '#filter-number',
    reason: '#filter-reason',
    yearMin: '#filter-year-min',
    yearMax: '#filter-year-max',
    dateMin: '#filter-date-min',
    dateMax: '#filter-date-max',
    partsMin: '#filter-parts-min',
    partsMax: '#filter-parts-max',
    theme: '#filter-theme',
    vendor: '#filter-vendor',
    buyer: '#filter-buyer',
    owner: '#filter-owner',
    owned: '#filter-owned'
  };

  const CHART_COLORS = [
    '#1e40af', '#0e7490', '#047857', '#b45309',
    '#be123c', '#7c3aed', '#db2777', '#64748b'
  ];
  const MAX_THEME_SLICES = 8;

  let purchases = [];
  let sortKey = 'purchaseDate';
  let sortDir = -1;

  function filterValue(key) {
    const $el = $(FILTERS[key]);
    return $el.is(':checkbox') ? $el.is(':checked') : $.trim($el.val() || '');
  }

  function normalizeDate(value) {
    return value.replace(/-/g, '/');
  }

  function distinct(key, rows) {
    const values = new Set();
    (rows || purchases).forEach(function (p) {
      if (p[key] != null && p[key] !== '') {
        values.add(p[key]);
      }
    });
    return Array.from(values).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }

  function applyFilters() {
    const name = filterValue('name').toLowerCase();
    const number = filterValue('number').toLowerCase();
    const reason = filterValue('reason').toLowerCase();
    const yearMin = filterValue('yearMin') === '' ? null : Number(filterValue('yearMin'));
    const yearMax = filterValue('yearMax') === '' ? null : Number(filterValue('yearMax'));
    const dateMin = normalizeDate(filterValue('dateMin'));
    const dateMax = normalizeDate(filterValue('dateMax'));
    const partsMin = filterValue('partsMin') === '' ? null : Number(filterValue('partsMin'));
    const partsMax = filterValue('partsMax') === '' ? null : Number(filterValue('partsMax'));
    const theme = filterValue('theme');
    const vendor = filterValue('vendor');
    const buyer = filterValue('buyer');
    const owner = filterValue('owner');
    const ownedOnly = filterValue('owned');

    return purchases.filter(function (p) {
      if (name && !String(p.name || '').toLowerCase().includes(name)) return false;
      if (number && !String(p.setNumber || '').toLowerCase().includes(number)) return false;
      if (reason && !String(p.reason || '').toLowerCase().includes(reason)) return false;
      if (yearMin != null && (p.year == null || p.year < yearMin)) return false;
      if (yearMax != null && (p.year == null || p.year > yearMax)) return false;
      if (dateMin || dateMax) {
        const date = normalizeDate(String(p.purchaseDate || ''));
        if (!date) return false;
        if (dateMin && date < dateMin) return false;
        if (dateMax && date > dateMax) return false;
      }
      if (partsMin != null && (p.numParts == null || p.numParts < partsMin)) return false;
      if (partsMax != null && (p.numParts == null || p.numParts > partsMax)) return false;
      if (theme && p.theme !== theme) return false;
      if (vendor && p.vendor !== vendor) return false;
      if (buyer && p.broughtBy !== buyer) return false;
      if (owner && p.owner !== owner) return false;
      if (ownedOnly && !p.owned) return false;
      return true;
    });
  }

  function fillSelect(selector, key, rows) {
    const $select = $(selector);
    const current = $select.val() || '';
    const values = distinct(key, rows);
    $select.find('option:not(:first)').remove();
    values.forEach(v => $select.append($('<option></option>').val(v).text(v)));
    if (current && values.includes(current)) {
      $select.val(current);
    }
  }

  function populateFilterOptions() {
    fillSelect('#filter-theme', 'theme');
    fillSelect('#filter-vendor', 'vendor');
    fillSelect('#filter-buyer', 'broughtBy');
    fillSelect('#filter-owner', 'owner');

    const owned = purchases.filter(p => p.owned);
    fillSelect('#stat-theme', 'theme', owned);
    fillSelect('#stat-buyer', 'broughtBy', owned);
    fillSelect('#stat-owner', 'owner', owned);
  }

  function totalOf(rows, key) {
    return rows.reduce((sum, p) => sum + (Number(p[key]) || 0), 0);
  }

  function themeEntries(rows, valueOf) {
    const values = new Map();
    rows.forEach(function (p) {
      const theme = p.theme == null || p.theme === '' ? 'Unknown' : p.theme;
      const value = Number(valueOf(p)) || 0;
      if (value > 0) {
        values.set(theme, (values.get(theme) || 0) + value);
      }
    });
    const entries = Array.from(values, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (entries.length > MAX_THEME_SLICES) {
      const rest = entries.splice(MAX_THEME_SLICES - 1);
      entries.push({
        name: 'Other themes',
        value: rest.reduce((sum, e) => sum + e.value, 0)
      });
    }
    return entries;
  }

  function renderDonut(selector, entries, format) {
    const host = d3.select(selector);
    host.html('');
    if (entries.length === 0) {
      host.append('p').attr('class', 'muted').text('No data');
      return;
    }

    const total = d3.sum(entries, e => e.value);
    const color = d3.scaleOrdinal()
      .domain(entries.map(e => e.name))
      .range(CHART_COLORS);
    const width = 170;
    const height = 170;
    const radius = Math.min(width, height) / 2;
    const arcs = d3.pie().value(e => e.value).sort(null)(entries);
    const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius - 2);

    const wrap = host.append('div').attr('class', 'donut-wrap');
    const svg = wrap.append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'donut-svg')
      .attr('role', 'img');
    const plot = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    plot.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .append('title')
      .text(d => `${d.data.name}: ${format(d.data.value)} (${(d.data.value / total * 100).toFixed(1)} %)`);

    plot.append('text')
      .attr('class', 'donut-total')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(format(total));

    const legend = wrap.append('ul').attr('class', 'donut-legend');
    const items = legend.selectAll('li').data(entries).join('li');
    items.append('span').attr('class', 'swatch').style('background', d => color(d.name));
    items.append('span').attr('class', 'legend-label').text(d => d.name);
    items.append('span').attr('class', 'legend-value').text(d => format(d.value));
  }

  function drawYearBars(el, data, metric, showXAxis) {
    const width = 960;
    const height = 170;
    const margin = { top: 26, right: 16, bottom: showXAxis ? 34 : 12, left: 74 };
    const value = d => Number(d[metric.key]) || 0;
    const x = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([margin.left, width - margin.right])
      .padding(0.25);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, value) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3.select(el).append('svg')
      .attr('class', 'chart')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img');
    const band = x.bandwidth();
    const barWidth = Math.min(band, 72);
    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', margin.left)
      .attr('y', 16)
      .text(metric.label);

    const xAxis = d3.axisBottom(x).tickSizeOuter(0);
    if (!showXAxis) {
      xAxis.tickFormat('').tickSize(0);
    }
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis);
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')));

    svg.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.year) + (band - barWidth) / 2)
      .attr('width', barWidth)
      .attr('y', d => y(value(d)))
      .attr('height', d => y(0) - y(value(d)))
      .attr('rx', 2)
      .attr('fill', metric.color)
      .append('title')
      .text(d => `${d.year}: ${metric.format(d[metric.key])}`);
  }

  function renderYearChart() {
    const theme = $('#stat-theme').val() || '';
    const buyer = $('#stat-buyer').val() || '';
    const owner = $('#stat-owner').val() || '';
    const rows = purchases.filter(p => p.owned
      && (!theme || p.theme === theme)
      && (!buyer || p.broughtBy === buyer)
      && (!owner || p.owner === owner));

    const byYear = new Map();
    rows.forEach(function (p) {
      const year = String(p.purchaseDate || '').slice(0, 4);
      if (!/^\d{4}$/.test(year)) return;
      const entry = byYear.get(year) || { year, count: 0, price: 0, parts: 0 };
      entry.count += 1;
      entry.price += Number(p.price) || 0;
      entry.parts += Number(p.numParts) || 0;
      byYear.set(year, entry);
    });
    const data = Array.from(byYear.values()).sort((a, b) => a.year.localeCompare(b.year));

    const host = d3.select('#stat-year');
    host.html('');
    if (data.length === 0) {
      host.append('p').attr('class', 'muted').text('No owned purchases match these filters.');
      return;
    }

    const metrics = [
      { key: 'count', label: 'Sets', color: '#2563eb', format: fmt.number },
      { key: 'price', label: 'Price', color: '#059669', format: fmt.money },
      { key: 'parts', label: 'Total parts', color: '#d97706', format: fmt.number }
    ];
    metrics.forEach(function (metric, index) {
      const el = host.append('div').attr('class', 'year-chart').node();
      drawYearBars(el, data, metric, index === metrics.length - 1);
    });
  }

  function renderStatistics() {
    const owned = purchases.filter(p => p.owned);
    const notOwned = purchases.filter(p => !p.owned);

    $('#stat-count').text(fmt.number(owned.length));
    $('#stat-price').text(fmt.money(totalOf(owned, 'price')));
    $('#stat-parts').text(fmt.number(totalOf(owned, 'numParts')));
    $('#stat-not-owned-count').text(fmt.number(notOwned.length));
    $('#stat-not-owned-price').text(fmt.money(totalOf(notOwned, 'price')));

    if (typeof d3 === 'undefined') {
      $('.stats-charts, #stat-year').html('<p class="muted">Charts are unavailable.</p>');
      return;
    }

    renderDonut('#stat-theme-count', themeEntries(owned, () => 1), fmt.number);
    renderDonut('#stat-theme-price', themeEntries(owned, p => p.price), fmt.money);
    renderDonut('#stat-theme-parts', themeEntries(owned, p => p.numParts), fmt.number);
    renderYearChart();
  }

  function resetFilters() {
    $('#purchases-filters').find('input, select').each(function () {
      if (this.type === 'checkbox') {
        this.checked = false;
      } else {
        this.value = '';
      }
    });
    render();
  }

  function buildHeader() {
    const $colgroup = $('<colgroup></colgroup>');
    COLUMNS.forEach(c => $colgroup.append($('<col>').css('width', c.width + '%')));
    $colgroup.append($('<col>').css('width', '5%'));
    $('#purchases').prepend($colgroup);

    const $row = $('#purchases thead tr').empty();
    COLUMNS.forEach(function (c) {
      if (c.links) {
        $row.append($('<th></th>').text(c.label));
      } else {
        $row.append($('<th class="sortable"></th>').attr('data-key', c.key).text(c.label));
      }
    });
    $row.append('<th></th>');
    $('#purchases thead').on('click', 'th[data-key]', function () {
      const key = $(this).attr('data-key');
      sortDir = sortKey === key ? -sortDir : 1;
      sortKey = key;
      render();
    });
  }

  function compare(a, b) {
    const x = a[sortKey], y = b[sortKey];
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    if (typeof x === 'boolean') return (Number(x) - Number(y)) * sortDir;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * sortDir;
  }

  function render() {
    $('#purchases thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + sortKey + '"]')
      .addClass(sortDir > 0 ? 'sort-asc' : 'sort-desc');

    const $tbody = $('#purchases tbody').empty();
    const rows = applyFilters().sort(compare);
    if (rows.length === 0) {
      $tbody.append('<tr><td colspan="' + (COLUMNS.length + 1) + '" class="muted">No purchases match the filters.</td></tr>');
    }
    rows.forEach(function (p) {
      const $tr = $('<tr></tr>');
      COLUMNS.forEach(function (c) {
        const $td = $('<td></td>');
        const value = p[c.key];
        if (c.links) {
          $td.append($('<button type="button" class="btn secondary">Open</button>')
            .attr('title', 'Open set ' + (p.setNumber || '') + ' on external websites')
            .on('click', function () { BrickSets.openSetSites(p.setNumber, p); }));
        } else if (c.image) {
          if (value) {
            $td.append($('<img class="set-img" alt="" loading="lazy">').attr('src', value));
          }
        } else if (c.key === 'owned') {
          $td.append($('<input type="checkbox" disabled>').prop('checked', !!value));
        } else if (c.theme) {
          const $cell = $('<div class="theme-cell"></div>');
          if (p.themeImageUrl) {
            const $badge = $('<span class="theme-badge"></span>');
            if (p.themeColor) {
              $badge.css('background-color', p.themeColor);
            }
            $badge.append($('<img class="theme-img" loading="lazy">')
              .attr('src', p.themeImageUrl)
              .attr('alt', value || '')
              .attr('title', value || ''));
            $cell.append($badge);
          }
          if (value != null && value !== '') {
            $cell.append($('<span class="theme-name"></span>').text(value));
          }
          $td.append($cell);
        } else if (c.logo || c.avatar) {
          const imageUrl = p[c.key + 'ImageUrl'];
          const color = p[c.key + 'Color'];
          if (imageUrl) {
            const $image = $('<img loading="lazy">')
              .addClass(c.logo ? 'vendor-img' : 'person-img')
              .attr('src', imageUrl)
              .attr('alt', value || '')
              .attr('title', value || '');
            if (c.avatar && color) {
              $image.css('border-color', color);
            }
            $td.append($image);
          } else {
            const $tag = BrickTools.tag(value);
            if (c.avatar && color && $tag) {
              $tag.css('border', '2px solid ' + color);
            }
            $td.append($tag);
          }
        } else if (c.tag) {
          $td.append(BrickTools.tag(value));
        } else if (c.priceFetch && value == null) {
          $td.append(BrickSets.priceButton(p.setNumber, function () { load(); }));
        } else {
          $td.text(c.fmt ? c.fmt(value) : (value == null ? '' : value));
        }
        $tr.append($td);
      });
      $tr.append($('<td></td>').append(
        $('<button type="button" class="btn secondary">Edit</button>').on('click', () => openForm(p))
      ));
      $tbody.append($tr);
    });
    $('#filter-summary').text(rows.length + ' of ' + purchases.length + ' purchases');
  }

  function load() {
    return BrickTools.api('GET', '/purchases')
      .done(function (list) {
        purchases = list;
        $('#purchases-msg').text('');
        populateFilterOptions();
        render();
        renderStatistics();
      })
      .fail(function (xhr) { $('#purchases-msg').text(BrickTools.errorOf(xhr)); });
  }

  function loadOptions() {
    return BrickTools.api('GET', '/purchases/options')
      .done(function (options) {
        OPTION_LISTS.forEach(function (o) {
          const $list = $('#' + o.list).empty();
          (options[o.key] || []).forEach(v => $list.append($('<option></option>').val(v)));
        });
      });
  }

  function today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
  }

  function openForm(p) {
    $('#form-msg').text('');
    $('#purchase-id').val(p ? p.id : '');
    $('#purchase-title').text(p ? 'Edit purchase #' + p.id : 'Add purchase');
    $('#f-setNumber').val(p ? p.setNumber : '');
    $('#f-purchasePrice').val(p ? p.price : '');
    $('#f-purchaseDate').val(p && p.purchaseDate ? p.purchaseDate : today());
    $('#f-vendor').val(p ? p.vendor : BrickTools.getCookie('purchaseVendor'));
    $('#f-broughtBy').val(p ? p.broughtBy : BrickTools.getCookie('purchaseBroughtBy'));
    $('#f-owner').val(p ? p.owner : BrickTools.getCookie('purchaseOwner'));
    $('#f-partMissings').val(p ? p.partsMissing : 0);
    $('#f-owned').prop('checked', p ? !!p.owned : true);
    $('#f-reason').val(p ? p.reason : '');
    $('#purchase-modal').prop('hidden', false);
    loadOptions();
  }

  $('#add-purchase').on('click', () => openForm(null));
  $('#cancel-form').on('click', () => $('#purchase-modal').prop('hidden', true));
  $('#purchases-filters').on('input change', 'input, select', render);
  $('#stat-filters').on('change', 'select', renderYearChart);
  $('#filter-reset').on('click', resetFilters);

  $('#purchase-form').on('submit', function (e) {
    e.preventDefault();
    const id = $('#purchase-id').val();
    const body = {
      setNumber: $.trim($('#f-setNumber').val()),
      purchasePrice: Number($('#f-purchasePrice').val()),
      purchaseDate: $.trim($('#f-purchaseDate').val()),
      vendor: $.trim($('#f-vendor').val()),
      broughtBy: $.trim($('#f-broughtBy').val()),
      owner: $.trim($('#f-owner').val()),
      partMissings: parseInt($('#f-partMissings').val(), 10) || 0,
      owned: $('#f-owned').is(':checked'),
      reason: $.trim($('#f-reason').val())
    };
    const request = id
      ? BrickTools.api('PUT', '/purchases/' + encodeURIComponent(id), body)
      : BrickTools.api('POST', '/purchases', body);
    request
      .done(function () {
        BrickTools.setCookie('purchaseVendor', body.vendor);
        BrickTools.setCookie('purchaseBroughtBy', body.broughtBy);
        BrickTools.setCookie('purchaseOwner', body.owner);
        $('#purchase-modal').prop('hidden', true);
        load();
        loadOptions();
      })
      .fail(function (xhr) { $('#form-msg').text(BrickTools.errorOf(xhr)); });
  });

  buildHeader();
  BrickTools.initTabs('main');
  load();
  loadOptions();
});
