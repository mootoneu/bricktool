$(function () {
  'use strict';

  BrickTools.initHeader('purchases');

  const fmt = BrickTools.fmt;

  const COLUMNS = [
    { key: 'imageUrl', label: 'Image', image: true, width: 6 },
    { key: 'id', label: 'Purchase Id', width: 5 },
    { key: 'setNumber', label: 'Set Number', width: 6 },
    { key: 'name', label: 'Name', width: 7.5 },
    { key: 'numParts', label: 'Total parts', fmt: fmt.number, width: 5 },
    { key: 'year', label: 'Year', width: 3.5 },
    { key: 'theme', label: 'Theme', width: 5.5 },
    { key: 'officialPrice', label: 'Official Price', fmt: fmt.money, width: 5.5 },
    { key: 'price', label: 'Price', fmt: fmt.money, width: 5.5 },
    { key: 'promo', label: 'Promo', fmt: fmt.percent, width: 5 },
    { key: 'purchaseDate', label: 'Date', width: 7.5 },
    { key: 'vendor', label: 'Vendor', tag: true, width: 6 },
    { key: 'broughtBy', label: 'Buyer', tag: true, width: 5 },
    { key: 'owner', label: 'Owner', tag: true, width: 5 },
    { key: 'partsMissing', label: 'Parts missing', fmt: fmt.number, width: 5 },
    { key: 'complete', label: 'Complete', fmt: fmt.percent, width: 5 },
    { key: 'owned', label: 'Owned ?', width: 3.5 },
    { key: 'reason', label: 'Reason', width: 5 }
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

  function distinct(key) {
    const values = new Set();
    purchases.forEach(function (p) {
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

  function populateFilterOptions() {
    [
      { id: 'theme', key: 'theme' },
      { id: 'vendor', key: 'vendor' },
      { id: 'buyer', key: 'broughtBy' },
      { id: 'owner', key: 'owner' }
    ].forEach(function (s) {
      const $select = $('#filter-' + s.id);
      const current = $select.val() || '';
      const values = distinct(s.key);
      $select.find('option:not(:first)').remove();
      values.forEach(v => $select.append($('<option></option>').val(v).text(v)));
      if (current && values.includes(current)) {
        $select.val(current);
      }
    });
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
    $colgroup.append($('<col>').css('width', '4%'));
    $('#purchases').prepend($colgroup);

    const $row = $('#purchases thead tr').empty();
    COLUMNS.forEach(c => $row.append($('<th class="sortable"></th>').attr('data-key', c.key).text(c.label)));
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
        if (c.image) {
          if (value) {
            $td.append($('<img class="set-img" alt="" loading="lazy">').attr('src', value));
          }
        } else if (c.key === 'owned') {
          $td.append($('<input type="checkbox" disabled>').prop('checked', !!value));
        } else if (c.tag) {
          $td.append(BrickTools.tag(value));
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
    $('#f-vendor').val(p ? p.vendor : '');
    $('#f-broughtBy').val(p ? p.broughtBy : '');
    $('#f-owner').val(p ? p.owner : '');
    $('#f-partMissings').val(p ? p.partsMissing : 0);
    $('#f-owned').prop('checked', p ? !!p.owned : true);
    $('#f-reason').val(p ? p.reason : '');
    $('#purchase-modal').prop('hidden', false);
    loadOptions();
  }

  $('#add-purchase').on('click', () => openForm(null));
  $('#cancel-form').on('click', () => $('#purchase-modal').prop('hidden', true));
  $('#purchases-filters').on('input change', 'input, select', render);
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
        $('#purchase-modal').prop('hidden', true);
        load();
        loadOptions();
      })
      .fail(function (xhr) { $('#form-msg').text(BrickTools.errorOf(xhr)); });
  });

  buildHeader();
  load();
  loadOptions();
});
