$(function () {
  'use strict';

  BrickTools.initHeader('purchases');

  const fmt = BrickTools.fmt;

  const COLUMNS = [
    { key: 'id', label: 'Purchase Id', width: 5 },
    { key: 'setNumber', label: 'Set Number', width: 6 },
    { key: 'name', label: 'Name', width: 9 },
    { key: 'numParts', label: 'Total parts', fmt: fmt.number, width: 5 },
    { key: 'year', label: 'Year', width: 3.5 },
    { key: 'theme', label: 'Theme', width: 6.5 },
    { key: 'officialPrice', label: 'Official Price', fmt: fmt.money, width: 6 },
    { key: 'price', label: 'Price', fmt: fmt.money, width: 5.5 },
    { key: 'promo', label: 'Promo', fmt: fmt.percent, width: 5 },
    { key: 'purchaseDate', label: 'Date', width: 7.5 },
    { key: 'vendor', label: 'Vendor', tag: true, width: 6.5 },
    { key: 'broughtBy', label: 'Buyer', tag: true, width: 5.5 },
    { key: 'owner', label: 'Owner', tag: true, width: 5.5 },
    { key: 'partsMissing', label: 'Parts missing', fmt: fmt.number, width: 5 },
    { key: 'complete', label: 'Complete', fmt: fmt.percent, width: 5 },
    { key: 'owned', label: 'Owned ?', width: 3.5 },
    { key: 'reason', label: 'Reason', width: 6 }
  ];

  const OPTION_LISTS = [
    { list: 'vendor-options', key: 'vendors' },
    { list: 'buyer-options', key: 'buyers' },
    { list: 'owner-options', key: 'owners' }
  ];

  let purchases = [];
  let sortKey = 'purchaseDate';
  let sortDir = -1;

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
    purchases.slice().sort(compare).forEach(function (p) {
      const $tr = $('<tr></tr>');
      COLUMNS.forEach(function (c) {
        const $td = $('<td></td>');
        const value = p[c.key];
        if (c.key === 'owned') {
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
  }

  function load() {
    return BrickTools.api('GET', '/purchases')
      .done(function (list) {
        purchases = list;
        $('#purchases-msg').text('');
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
