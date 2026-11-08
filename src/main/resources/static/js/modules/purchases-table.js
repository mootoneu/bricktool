/**
 * Purchases - Table Module
 * Handles purchases table rendering, filtering, and sorting
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Build the table header
   */
  function buildHeader() {
    const COLUMNS = BrickTools.PurchasesShared.COLUMNS;
    const $colgroup = $('<colgroup></colgroup>');
    COLUMNS.forEach(function(c) { 
      $colgroup.append($('<col>').css('width', c.width + '%')); 
    });
    $colgroup.append($('<col>').css('width', '9%'));
    $('#purchases').prepend($colgroup);

    const $row = $('#purchases thead tr').empty();
    COLUMNS.forEach(function(c) {
      if (c.links) {
        $row.append($('<th></th>').text(c.label));
      } else {
        $row.append($('<th class="sortable"></th>').attr('data-key', c.key).text(c.label));
      }
    });
    $row.append('<th class="actions-col"></th>');
    $('#purchases thead').on('click', 'th[data-key]', function() {
      const key = $(this).attr('data-key');
      const sortKey = BrickTools.PurchasesShared.getSortKey();
      const sortDir = BrickTools.PurchasesShared.getSortDir();
      BrickTools.PurchasesShared.setSortDir(sortKey === key ? -sortDir : 1);
      BrickTools.PurchasesShared.setSortKey(key);
      render();
    });
  }

  /**
   * Compare two purchases for sorting
   * @param {Object} a - First purchase
   * @param {Object} b - Second purchase
   * @returns {number} Comparison result
   */
  function compare(a, b) {
    const sortKey = BrickTools.PurchasesShared.getSortKey();
    const sortDir = BrickTools.PurchasesShared.getSortDir();
    const x = a[sortKey], y = b[sortKey];
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    if (typeof x === 'boolean') return (Number(x) - Number(y)) * sortDir;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * sortDir;
  }

  /**
   * Render the purchases table
   */
  function render() {
    const COLUMNS = BrickTools.PurchasesShared.COLUMNS;
    const purchases = BrickTools.PurchasesShared.getPurchases();
    const sortKey = BrickTools.PurchasesShared.getSortKey();
    const sortDir = BrickTools.PurchasesShared.getSortDir();
    const fmt = BrickTools.fmt;
    
    $('#purchases thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + sortKey + '"]')
      .addClass(sortDir > 0 ? 'sort-asc' : 'sort-desc');

    const $tbody = $('#purchases tbody').empty();
    const rows = BrickTools.PurchasesShared.applyFilters().sort(compare);
    if (rows.length === 0) {
      $tbody.append('<tr><td colspan="' + (COLUMNS.length + 1) + '" class="muted">No purchases match the filters.</td></tr>');
    }
    rows.forEach(function(p) {
      const $tr = $('<tr></tr>');
      COLUMNS.forEach(function(c) {
        const $td = $('<td></td>');
        const value = p[c.key];
        if (c.links) {
          $td.append($('<button type="button" class="btn secondary">Open</button>')
            .attr('title', 'Open set ' + (p.setNumber || '') + ' on external websites')
            .on('click', function() { BrickSets.openSetSites(p.setNumber, p); }));
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
          $td.append(BrickSets.priceButton(p.setNumber, function() { BrickTools.PurchasesTable.load(); }));
        } else {
          $td.text(c.fmt ? c.fmt(value) : (value == null ? '' : value));
        }
        $tr.append($td);
      });
      const $actions = $('<td class="row-actions"></td>');
      $actions.append(
        $('<button type="button" class="btn secondary">Inventory</button>')
          .attr('title', 'Open set ' + (p.setNumber || '') + ' in Set Inventory')
          .on('click', function() { BrickTools.PurchasesInventory.openSetInventory(p.setNumber); })
      );
      $actions.append(
        $('<button type="button" class="btn secondary">Edit</button>').on('click', function() { openForm(p); })
      );
      $tr.append($actions);
      $tbody.append($tr);
    });
    $('#filter-summary').text(rows.length + ' of ' + purchases.length + ' purchases');
  }

  /**
   * Load purchases from API
   * @returns {jQuery} Promise
   */
  function load() {
    return BrickTools.api('GET', '/purchases')
      .done(function(list) {
        BrickTools.PurchasesShared.setPurchases(list);
        $('#purchases-msg').text('');
        BrickTools.PurchasesShared.populateFilterOptions();
        render();
        BrickTools.PurchasesStats.renderStatistics();
        BrickTools.PurchasesInventory.populateSetInventorySets();
        const pendingSetInventory = BrickTools.PurchasesShared.getPendingSetInventory();
        if (pendingSetInventory) {
          const pending = pendingSetInventory;
          BrickTools.PurchasesShared.setPendingSetInventory('');
          BrickTools.PurchasesInventory.openSetInventory(pending);
        } else if (!$('[data-panel="set-inventory"]').prop('hidden')
            && BrickTools.PurchasesShared.getSetInventorySet() 
            && BrickTools.PurchasesShared.getSetInventoryLoadedSet() !== BrickTools.PurchasesShared.getSetInventorySet()) {
          const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
          BrickTools.PurchasesInventory.loadSetInventory(setInventorySet);
        }
      })
      .fail(function(xhr) { $('#purchases-msg').text(BrickTools.errorOf(xhr)); });
  }

  /**
   * Load option lists from API
   * @returns {jQuery} Promise
   */
  function loadOptions() {
    return BrickTools.api('GET', '/purchases/options')
      .done(function(options) {
        const OPTION_LISTS = BrickTools.PurchasesShared.OPTION_LISTS;
        OPTION_LISTS.forEach(function(o) {
          const $list = $('#' + o.list).empty();
          (options[o.key] || []).forEach(function(v) { 
            $list.append($('<option></option>').val(v)); 
          });
        });
      });
  }

  /**
   * Open the purchase form for editing or adding
   * @param {Object|null} p - Purchase object or null for new
   */
  function openForm(p) {
    const today = BrickTools.PurchasesShared.today();
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

  /**
   * Reset all filters to default
   */
  function resetFilters() {
    $('#purchases-filters').find('input, select').each(function() {
      if (this.type === 'checkbox') {
        this.checked = false;
      } else {
        this.value = '';
      }
    });
    render();
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the table module
   */
  function init() {
    // Add purchase button
    $('#add-purchase').on('click', function() { openForm(null); });

    // Cancel form
    $('#cancel-form').on('click', function() { $('#purchase-modal').prop('hidden', true); });

    // Filter inputs
    $('#purchases-filters').on('input change', 'input, select', render);

    // Reset filters button
    $('#filter-reset').on('click', resetFilters);

    // Form submission
    $('#purchase-form').on('submit', function(e) {
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
        .done(function() {
          BrickTools.setCookie('purchaseVendor', body.vendor);
          BrickTools.setCookie('purchaseBroughtBy', body.broughtBy);
          BrickTools.setCookie('purchaseOwner', body.owner);
          $('#purchase-modal').prop('hidden', true);
          load();
          loadOptions();
        })
        .fail(function(xhr) { $('#form-msg').text(BrickTools.errorOf(xhr)); });
    });

    // Build header
    buildHeader();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PurchasesTable = {
    init: init,
    buildHeader: buildHeader,
    compare: compare,
    render: render,
    load: load,
    loadOptions: loadOptions,
    openForm: openForm,
    resetFilters: resetFilters
  };
})();
