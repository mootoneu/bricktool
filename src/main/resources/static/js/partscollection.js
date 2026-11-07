$(function () {
  'use strict';

  BrickTools.initHeader('partscollection');

  const fmt = BrickTools.fmt;
  const ORDER_URL = 'https://www.brickowl.com/user/934717/orders/';

  let parts = [];
  let loading = false;
  let loaded = false;
  const sortState = { key: 'name', dir: 1 };

  let pabPurchases = [];
  let pabPurchasesLoading = false;
  let pabPurchasesLoaded = false;
  let pabPurchasesCallbacks = [];
  let selectedPabPurchaseId = '';
  let pabParts = [];
  let pabPartsRequest = 0;
  let partCategoryGroups = [];
  let partCategoriesLoading = false;
  let partCategoriesLoaded = false;
  let selectedPartCategoryId = '';
  let mainParts = [];
  let mainPartsRequest = 0;
  let hideZeroStars = true;
  let mainPartsSearch = '';
  const mainPartsSort = { key: 'stars', dir: -1 };

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

  function findPabPurchase(id) {
    return pabPurchases.find(function (purchase) {
      return String(purchase.id) === String(id);
    });
  }

  function renderPabPurchases() {
    const $tbody = $('#pab-purchases tbody').empty();
    if (pabPurchases.length === 0) {
      $tbody.append('<tr><td colspan="7" class="muted">No PaB purchases yet.</td></tr>');
      return;
    }
    pabPurchases.forEach(function (purchase) {
      const $row = $('<tr></tr>');
      $row.append($('<td></td>').text(purchase.id == null ? '' : purchase.id));
      $row.append($('<td></td>').text(purchase.purchaseDate || ''));
      $row.append($('<td></td>').text(purchase.boxQuantity == null ? '' : fmt.number(purchase.boxQuantity)));
      $row.append($('<td></td>').text(purchase.minifigQuantity == null ? '' : fmt.number(purchase.minifigQuantity)));
      $row.append($('<td></td>').text(purchase.price == null ? '' : fmt.money(purchase.price)));
      $row.append($('<td></td>').text(fmt.number(purchase.totalParts || 0)));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary pab-parts-open">Parts</button>')
        .attr('data-pab-purchase-id', purchase.id));
      $actions.append($('<button type="button" class="btn secondary pab-purchase-edit">Edit</button>')
        .attr('data-pab-purchase-id', purchase.id));
      $row.append($actions);
      $tbody.append($row);
    });
  }

  function loadPabPurchases(callback) {
    if (callback) {
      pabPurchasesCallbacks.push(callback);
    }
    if (pabPurchasesLoading) {
      return;
    }
    pabPurchasesLoading = true;
    report('#pab-purchases-msg', 'Loading PaB purchases…');
    BrickTools.api('GET', '/pab/purchases')
      .done(function (list) {
        pabPurchases = Array.isArray(list) ? list : [];
        pabPurchasesLoaded = true;
        renderPabPurchases();
        populatePabPurchaseSelect();
        report('#pab-purchases-msg', pabPurchases.length === 0 ? 'No PaB purchases stored yet.' : '');
      })
      .fail(function (xhr) {
        pabPurchases = [];
        populatePabPurchaseSelect();
        const $tbody = $('#pab-purchases tbody').empty();
        $tbody.append($('<tr></tr>').append(
          $('<td colspan="7" class="muted"></td>').text('Unable to load PaB purchases.')));
        report('#pab-purchases-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        pabPurchasesLoading = false;
        const callbacks = pabPurchasesCallbacks;
        pabPurchasesCallbacks = [];
        callbacks.forEach(function (fn) { fn(); });
      });
  }

  function openPabPurchaseForm(purchase) {
    $('#pab-purchase-form-msg').text('');
    $('#pab-purchase-id').val(purchase ? purchase.id : '');
    $('#pab-purchase-title').text(purchase ? 'Edit PaB purchase' : 'Add PaB purchase');
    $('#pab-purchase-date').val(purchase ? purchase.purchaseDate : BrickTools.today());
    $('#pab-purchase-boxes').val(purchase && purchase.boxQuantity != null ? purchase.boxQuantity : 1);
    $('#pab-purchase-minifigs').val(purchase && purchase.minifigQuantity != null ? purchase.minifigQuantity : 0);
    $('#pab-purchase-price').val(purchase && purchase.price != null ? purchase.price : 0);
    $('#pab-purchase-modal').prop('hidden', false);
    $('#pab-purchase-date').trigger('focus');
  }

  function closePabPurchaseForm() {
    $('#pab-purchase-modal').prop('hidden', true);
  }

  $('#pab-purchase-add').on('click', function () {
    openPabPurchaseForm(null);
  });

  $('#pab-purchase-cancel').on('click', closePabPurchaseForm);

  $('#pab-purchases').on('click', '.pab-purchase-edit', function () {
    openPabPurchaseForm(findPabPurchase($(this).attr('data-pab-purchase-id')));
  });

  $('#pab-purchases').on('click', '.pab-parts-open', function () {
    selectedPabPurchaseId = String($(this).attr('data-pab-purchase-id'));
    $('.tabs [data-tab="pab-parts"]').trigger('click');
  });

  $('#pab-purchase-form').on('submit', function (event) {
    event.preventDefault();
    const id = $('#pab-purchase-id').val();
    const boxQuantity = parseInt($('#pab-purchase-boxes').val(), 10);
    const minifigQuantity = parseInt($('#pab-purchase-minifigs').val(), 10);
    const price = parseFloat($('#pab-purchase-price').val());
    const body = {
      purchaseDate: String($('#pab-purchase-date').val() || '').trim(),
      boxQuantity: isNaN(boxQuantity) ? 1 : boxQuantity,
      minifigQuantity: isNaN(minifigQuantity) ? 0 : minifigQuantity,
      price: isNaN(price) ? 0 : price
    };
    const $buttons = $('#pab-purchase-form button').prop('disabled', true);
    $('#pab-purchase-form-msg').text('Saving…');
    BrickTools.api(id ? 'PUT' : 'POST',
        id ? '/pab/purchases/' + encodeURIComponent(id) : '/pab/purchases', body)
      .done(function () {
        closePabPurchaseForm();
        loadPabPurchases();
      })
      .fail(function (xhr) {
        $('#pab-purchase-form-msg').text(BrickTools.errorOf(xhr));
      })
      .always(function () {
        $buttons.prop('disabled', false);
      });
  });

  function populatePabPurchaseSelect() {
    const $select = $('#pab-parts-purchase').empty();
    if (pabPurchases.length === 0) {
      $select.append($('<option></option>').attr('value', '').text('No PaB purchases'));
      $select.prop('disabled', true);
      $('#pab-part-add').prop('disabled', true);
      selectedPabPurchaseId = '';
      return;
    }
    pabPurchases.forEach(function (purchase) {
      $select.append($('<option></option>')
        .attr('value', purchase.id)
        .text((purchase.purchaseDate || '') + ' (#' + purchase.id + ')'));
    });
    $select.prop('disabled', false);
    if (!findPabPurchase(selectedPabPurchaseId)) {
      selectedPabPurchaseId = String(pabPurchases[0].id);
    }
    $select.val(selectedPabPurchaseId);
    $('#pab-part-add').prop('disabled', false);
  }

  function findPabPart(id) {
    return pabParts.find(function (part) {
      return String(part.id) === String(id);
    });
  }

  function pabColorChip(part) {
    const colorId = part.partColorId;
    const label = part.colorName || (colorId == null ? '' : String(colorId));
    const $chip = $('<span class="color-chip"></span>')
      .attr('title', label)
      .text(label)
      .css('cursor', 'pointer')
      .attr('tabindex', '0');
    const hex = colorHex({ rgb: part.colorRgb });
    if (hex) {
      $chip.css({ 'background-color': hex, color: readableTextColor(hex) });
    }
    function openColor() {
      if (colorId !== null && colorId !== undefined && colorId !== '') {
        BrickColor.openColorInfo(colorId);
      }
    }
    $chip.on('click', openColor);
    $chip.on('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openColor();
      }
    });
    return $chip;
  }

  function renderPabParts() {
    const $tbody = $('#pab-parts tbody').empty();
    if (!selectedPabPurchaseId) {
      $tbody.append('<tr><td colspan="8" class="muted">No PaB purchase selected.</td></tr>');
      return;
    }
    if (pabParts.length === 0) {
      $tbody.append('<tr><td colspan="8" class="muted">No parts for this purchase yet.</td></tr>');
      return;
    }
    pabParts.forEach(function (part) {
      const $row = $('<tr></tr>');
      $row.append($('<td></td>').text(part.id == null ? '' : part.id));
      $row.append($('<td></td>').text(part.paBPurchaseId == null ? '' : part.paBPurchaseId));
      $row.append($('<td></td>').text(part.partNumber || ''));
      $row.append($('<td></td>').text(part.partName || ''));
      $row.append($('<td></td>').text(part.partCategory || ''));
      $row.append($('<td></td>').append(pabColorChip(part)));
      $row.append($('<td></td>').text(part.quantity == null ? '' : fmt.number(part.quantity)));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary pab-part-edit">Edit</button>')
        .attr('data-pab-part-id', part.id));
      $row.append($actions);
      $tbody.append($row);
    });
  }

  function loadPabParts() {
    const request = ++pabPartsRequest;
    if (!selectedPabPurchaseId) {
      pabParts = [];
      renderPabParts();
      report('#pab-parts-msg', 'Add a PaB purchase first.');
      return;
    }
    report('#pab-parts-msg', 'Loading PaB parts…');
    BrickTools.api('GET', '/pab/purchases/' + encodeURIComponent(selectedPabPurchaseId) + '/parts')
      .done(function (list) {
        if (request !== pabPartsRequest) {
          return;
        }
        pabParts = Array.isArray(list) ? list : [];
        renderPabParts();
        report('#pab-parts-msg', pabParts.length === 0 ? 'No parts stored for this purchase.' : '');
      })
      .fail(function (xhr) {
        if (request !== pabPartsRequest) {
          return;
        }
        pabParts = [];
        renderPabParts();
        report('#pab-parts-msg', BrickTools.errorOf(xhr));
      });
  }

  function openPabPartForm(part) {
    $('#pab-part-form-msg').text('');
    $('#pab-part-id').val(part ? part.id : '');
    $('#pab-part-title').text(part ? 'Edit PaB part' : 'Add PaB part');
    $('#pab-part-number').val(part ? part.partNumber : '');
    $('#pab-part-color').val(part && part.partColorId != null ? part.partColorId : '');
    $('#pab-part-quantity').val(part && part.quantity != null ? part.quantity : 1);
    $('#pab-part-modal').prop('hidden', false);
    $('#pab-part-number').trigger('focus');
  }

  function closePabPartForm() {
    $('#pab-part-modal').prop('hidden', true);
  }

  $('#pab-parts-purchase').on('change', function () {
    selectedPabPurchaseId = String($(this).val() || '');
    loadPabParts();
  });

  $('#pab-part-add').on('click', function () {
    if (!selectedPabPurchaseId) {
      return;
    }
    openPabPartForm(null);
  });

  $('#pab-part-cancel').on('click', closePabPartForm);

  $('#pab-parts').on('click', '.pab-part-edit', function () {
    openPabPartForm(findPabPart($(this).attr('data-pab-part-id')));
  });

  $('#pab-part-form').on('submit', function (event) {
    event.preventDefault();
    if (!selectedPabPurchaseId) {
      $('#pab-part-form-msg').text('Select a PaB purchase first.');
      return;
    }
    const id = $('#pab-part-id').val();
    const color = parseInt($('#pab-part-color').val(), 10);
    const quantity = parseInt($('#pab-part-quantity').val(), 10);
    const body = {
      partNumber: String($('#pab-part-number').val() || '').trim(),
      partColorId: isNaN(color) ? null : color,
      quantity: isNaN(quantity) ? 1 : quantity
    };
    const $buttons = $('#pab-part-form button').prop('disabled', true);
    $('#pab-part-form-msg').text('Saving…');
    BrickTools.api(id ? 'PUT' : 'POST',
        id ? '/pab/parts/' + encodeURIComponent(id)
          : '/pab/purchases/' + encodeURIComponent(selectedPabPurchaseId) + '/parts', body)
      .done(function () {
        closePabPartForm();
        loadPabParts();
        loadPabPurchases();
      })
      .fail(function (xhr) {
        $('#pab-part-form-msg').text(BrickTools.errorOf(xhr));
      })
      .always(function () {
        $buttons.prop('disabled', false);
      });
  });

  function partCategoryButton(category) {
    return $('<button type="button" class="part-category-item"></button>')
      .attr('data-category-id', category.id)
      .text(category.name || '')
      .toggleClass('active', String(category.id) === String(selectedPartCategoryId));
  }

  function renderPartCategoryTree() {
    const $tree = $('#part-category-tree').empty();
    if (partCategoryGroups.length === 0) {
      $tree.append($('<p class="muted"></p>').text('No part categories available.'));
      return;
    }
    partCategoryGroups.forEach(function (group) {
      const categories = Array.isArray(group.categories) ? group.categories : [];
      if (categories.length === 1) {
        $tree.append(partCategoryButton(categories[0]));
        return;
      }
      const $details = $('<details class="part-category-group"></details>');
      $details.append($('<summary></summary>').text(group.group || 'Other'));
      const $list = $('<div class="part-category-list"></div>');
      categories.forEach(function (category) {
        $list.append(partCategoryButton(category));
      });
      $details.append($list);
      $tree.append($details);
    });
  }

  function loadPartCategories() {
    if (partCategoriesLoading) {
      return;
    }
    partCategoriesLoading = true;
    report('#part-explorer-msg', 'Loading part categories…');
    BrickTools.api('GET', '/parts/categories')
      .done(function (list) {
        partCategoryGroups = Array.isArray(list) ? list : [];
        partCategoriesLoaded = true;
        renderPartCategoryTree();
        report('#part-explorer-msg',
          partCategoryGroups.length === 0 ? 'No part categories available.' : 'Select a category.');
      })
      .fail(function (xhr) {
        partCategoryGroups = [];
        renderPartCategoryTree();
        report('#part-explorer-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        partCategoriesLoading = false;
      });
  }

  function starCell(part) {
    const $cell = $('<td></td>');
    const $stars = $('<span class="stars"></span>');
    const value = Number(part.stars || 0);
    $stars.append($('<button type="button" class="star star-zero"></button>')
      .toggleClass('on', value === 0)
      .attr('data-stars', 0)
      .attr('aria-label', 'Set 0 stars (hidden)')
      .attr('title', 'Set 0 stars (hidden)')
      .append('<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
        + '<path d="M2 2l20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M9.9 5.1A10.3 10.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1-1 2.4-2.2 3.6M6.6 6.6C4.3 8 2.7 10 2 12c.5 2.5 4.5 7 10 7 1.7 0 3.3-.4 4.7-1.1"'
        + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '</svg>'));
    for (let n = 1; n <= 5; n++) {
      $stars.append($('<button type="button" class="star"></button>')
        .toggleClass('on', value >= n)
        .attr('data-stars', n)
        .attr('aria-label', n + (n === 1 ? ' star' : ' stars'))
        .attr('title', 'Set ' + n + (n === 1 ? ' star' : ' stars'))
        .text('★'));
    }
    $cell.append($stars);
    return $cell;
  }

  function renderMainParts() {
    const $tbody = $('#main-parts tbody').empty();
    const $table = $('#main-parts');
    const query = mainPartsSearch.trim().toLowerCase();
    const filtered = mainParts.filter(function (part) {
      if (hideZeroStars && Number(part.stars || 0) <= 0) {
        return false;
      }
      if (!query) {
        return true;
      }
      return String(part.partNumber || '').toLowerCase().includes(query)
        || String(part.name || '').toLowerCase().includes(query);
    });
    const visible = sortRows(filtered, mainPartsSort);
    markSortedHeader('#main-parts', mainPartsSort);
    $('#main-parts-count').text(mainParts.length === 0 ? '' :
      fmt.number(visible.length) + ' of ' + fmt.number(mainParts.length) + ' parts');

    if (visible.length === 0) {
      $table.prop('hidden', true);
      report('#part-explorer-msg', mainParts.length === 0
        ? 'No main parts in this category.'
        : 'No main parts match the current filters.');
      return;
    }

    visible.forEach(function (part) {
      const $row = $('<tr></tr>').attr('data-part-number', part.partNumber);
      $row.append($('<td></td>').text(part.partNumber || ''));
      $row.append($('<td></td>').text(part.name || ''));
      $row.append($('<td></td>').text(part.material || ''));

      const $alternates = $('<td></td>');
      if (part.hasAlternates) {
        $alternates.append($('<button type="button" class="btn secondary main-part-alternates">View</button>')
          .attr('data-part-number', part.partNumber));
      }
      $row.append($alternates);
      $row.append(starCell(part));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary add-to-collection">Add to collection</button>')
        .attr('data-part-number', part.partNumber));
      $row.append($actions);
      $tbody.append($row);
    });
    $table.prop('hidden', false);
    report('#part-explorer-msg', '');
  }

  function loadMainParts() {
    const request = ++mainPartsRequest;
    if (!selectedPartCategoryId) {
      mainParts = [];
      $('#main-parts').prop('hidden', true);
      $('#main-parts-count').text('');
      report('#part-explorer-msg', 'Select a category.');
      return;
    }
    report('#part-explorer-msg', 'Loading main parts…');
    $('#main-parts').prop('hidden', true);
    BrickTools.api('GET', '/parts/categories/' + encodeURIComponent(selectedPartCategoryId) + '/main-parts')
      .done(function (list) {
        if (request !== mainPartsRequest) {
          return;
        }
        mainParts = Array.isArray(list) ? list : [];
        renderMainParts();
      })
      .fail(function (xhr) {
        if (request !== mainPartsRequest) {
          return;
        }
        mainParts = [];
        renderMainParts();
        report('#part-explorer-msg', BrickTools.errorOf(xhr));
      });
  }

  function saveMainPartStars(partNumber, stars) {
    BrickTools.api('PUT', '/parts/main-parts/' + encodeURIComponent(partNumber) + '/stars', { stars: stars })
      .done(function () {
        const part = mainParts.find(function (item) {
          return String(item.partNumber) === String(partNumber);
        });
        if (part) {
          part.stars = stars;
        }
        renderMainParts();
      })
      .fail(function (xhr) {
        report('#part-explorer-msg', BrickTools.errorOf(xhr));
      });
  }

  function closeMainPartAlternates() {
    $('#main-part-alternates-modal').prop('hidden', true);
  }

  function openMainPartAlternates(partNumber) {
    $('#main-part-alternates tbody').empty();
    $('#main-part-alternates-title').text('Alternates of ' + partNumber);
    $('#main-part-alternates-sub').text('Loading…');
    $('#main-part-alternates-msg').text('');
    $('#main-part-alternates-modal').prop('hidden', false);
    $('#main-part-alternates-modal .modal-close').trigger('focus');

    BrickTools.api('GET', '/parts/main-parts/' + encodeURIComponent(partNumber) + '/alternates')
      .done(function (result) {
        const rows = result && Array.isArray(result.alternates) ? result.alternates : [];
        $('#main-part-alternates-title').text(
          'Alternates of ' + (result && result.name ? result.name : partNumber));
        $('#main-part-alternates-sub').text(partNumber);
        if (rows.length === 0) {
          $('#main-part-alternates-msg').text('No alternates found.');
          return;
        }
        rows.forEach(function (row) {
          $('#main-part-alternates tbody').append($('<tr></tr>')
            .append($('<td></td>').text(row.relType || ''))
            .append($('<td></td>').text(row.childPartNumber || ''))
            .append($('<td></td>').text(row.childName || ''))
            .append($('<td></td>').text(row.childCategoryId == null ? '' : row.childCategoryId))
            .append($('<td></td>').text(row.childMaterial || ''))
            .append($('<td></td>').text(row.parentPartNumber || ''))
            .append($('<td></td>').text(row.parentName || '')));
        });
      })
      .fail(function (xhr) {
        $('#main-part-alternates-sub').text(partNumber);
        $('#main-part-alternates-msg').text(BrickTools.errorOf(xhr));
      });
  }

  $('#part-category-tree').on('click', '.part-category-item', function () {
    selectedPartCategoryId = String($(this).attr('data-category-id'));
    $('#part-category-tree .part-category-item').removeClass('active');
    $(this).addClass('active');
    loadMainParts();
  });

  $('#main-parts-hide-zero').on('change', function () {
    hideZeroStars = this.checked;
    renderMainParts();
  });

  $('#main-parts-search').on('input', function () {
    mainPartsSearch = this.value;
    renderMainParts();
  });

  $('#main-parts thead').on('click', 'th[data-key]', function () {
    sortBy(mainPartsSort, $(this).attr('data-key'));
    renderMainParts();
  });

  $('#main-parts').on('click', '.star', function () {
    const partNumber = $(this).closest('tr').attr('data-part-number');
    const stars = parseInt($(this).attr('data-stars'), 10);
    if (partNumber && !isNaN(stars)) {
      saveMainPartStars(partNumber, stars);
    }
  });

  $('#main-parts').on('click', '.main-part-alternates', function () {
    openMainPartAlternates($(this).attr('data-part-number'));
  });

  $('#main-part-alternates-modal').on('click', function (event) {
    if (event.target === this) {
      closeMainPartAlternates();
    }
  });
  $('#main-part-alternates-modal').on('click', '.modal-close', closeMainPartAlternates);
  $(document).on('keydown', function (event) {
    if (event.key === 'Escape' && !$('#main-part-alternates-modal').prop('hidden')) {
      closeMainPartAlternates();
    }
  });

  $('#bo-parts-collection thead').on('click', 'th[data-key]', function () {
    sortBy(sortState, $(this).attr('data-key'));
    renderParts();
  });

  BrickTools.initTabs('main', function (name) {
    if (name === 'brickowl') {
      loadParts();
    }
    if (name === 'explorer' && !partCategoriesLoaded) {
      loadPartCategories();
    }
    if (name === 'pab-purchases' && !pabPurchasesLoaded) {
      loadPabPurchases();
    }
    if (name === 'pab-parts') {
      if (pabPurchasesLoaded) {
        populatePabPurchaseSelect();
        loadPabParts();
      } else {
        loadPabPurchases(function () {
          populatePabPurchaseSelect();
          loadPabParts();
        });
      }
    }
  });

  if (!loaded) {
    loadParts();
  }
});
