/**
 * Purchases - Set Inventory Module
 * Handles set inventory display and management
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Populate the set inventory set dropdown
   */
  function populateSetInventorySets() {
    const purchases = BrickTools.PurchasesShared.getPurchases();
    const $select = $('#set-inventory-set');
    const current = BrickTools.PurchasesShared.getSetInventorySet() || $select.val() || '';
    const seen = new Set();
    $select.empty().append($('<option></option>').val('').text('Select a set…'));
    purchases.forEach(function(p) {
      const number = String(p.setNumber || '').trim();
      if (!number || seen.has(number)) {
        return;
      }
      seen.add(number);
      $select.append($('<option></option>').val(number)
        .text(number + (p.name ? ' — ' + p.name : '')));
    });
    if (current && !seen.has(current)) {
      seen.add(current);
      $select.append($('<option></option>').val(current).text(current));
    }
    if (current && seen.has(current)) {
      $select.val(current);
    } else if (seen.size > 0) {
      $select.val(Array.from(seen)[0]);
    } else {
      $select.val('');
    }
    BrickTools.PurchasesShared.setSetInventorySet($select.val() || '');
    $select.prop('disabled', seen.size === 0);
  }

  /**
   * Ensure set inventory is loaded for the selected set
   */
  function ensureSetInventoryLoaded() {
    const purchases = BrickTools.PurchasesShared.getPurchases();
    if (!purchases.length) {
      return;
    }
    if (!$('#set-inventory-set option').filter(function() { return this.value; }).length) {
      populateSetInventorySets();
    }
    const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
    const setInventoryLoadedSet = BrickTools.PurchasesShared.getSetInventoryLoadedSet();
    if (setInventorySet && setInventoryLoadedSet !== setInventorySet) {
      loadSetInventory(setInventorySet);
    }
  }

  /**
   * Open set inventory for a specific set number
   * @param {string} setNumber - Set number to open
   */
  function openSetInventory(setNumber) {
    const number = $.trim(setNumber == null ? '' : String(setNumber));
    if (!number) {
      return;
    }
    const $select = $('#set-inventory-set');
    if (!$select.find('option').filter(function() { return this.value === number; }).length) {
      $select.append($('<option></option>').val(number).text(number));
    }
    $select.val(number);
    BrickTools.PurchasesShared.setSetInventorySet(number);
    BrickTools.PurchasesShared.setSetInventoryLoadedSet(number);
    $('main [data-tab="set-inventory"]').trigger('click');
    loadSetInventory(number);
  }

  /**
   * Load set inventory from API
   * @param {string} setNumber - Set number
   * @param {string} [successMessage] - Success message to display
   * @returns {jQuery} Promise
   */
  function loadSetInventory(setNumber, successMessage) {
    const request = 1 + BrickTools.PurchasesShared.getSetInventoryRequest();
    BrickTools.PurchasesShared.setSetInventoryRequest(request);
    if (!setNumber) {
      BrickTools.PurchasesShared.setSetInventory([]);
      BrickTools.PurchasesShared.setSetInventoryLoadedSet('');
      renderSetInventory();
      return $.Deferred().resolve().promise();
    }
    $('#set-inventory-msg').text('Loading set parts…');
    return BrickTools.api('GET', '/sets/' + encodeURIComponent(setNumber) + '/inventory')
      .done(function(list) {
        if (request !== BrickTools.PurchasesShared.getSetInventoryRequest()) {
          return;
        }
        BrickTools.PurchasesShared.setSetInventory(Array.isArray(list) ? list : []);
        BrickTools.PurchasesShared.setSetInventoryLoadedSet(setNumber);
        $('#set-inventory-msg').text(successMessage || '');
        renderSetInventory();
      })
      .fail(function(xhr) {
        if (request !== BrickTools.PurchasesShared.getSetInventoryRequest()) {
          return;
        }
        BrickTools.PurchasesShared.setSetInventory([]);
        BrickTools.PurchasesShared.setSetInventoryLoadedSet('');
        renderSetInventory();
        $('#set-inventory-msg').text(BrickTools.errorOf(xhr));
      });
  }

  /**
   * Get image URL for a part
   * @param {Object} part - Part object
   * @returns {string} Image URL
   */
  function setInventoryImageUrl(part) {
    if (!part.partNumber) {
      return '';
    }
    return '/api/parts/' + encodeURIComponent(part.partNumber) + '/image' +
      (part.colorId == null || part.colorId === ''
        ? '' : '?colorId=' + encodeURIComponent(part.colorId));
  }

  /**
   * Create a color chip for a part
   * @param {Object} part - Part object
   * @returns {jQuery} Color chip jQuery element
   */
  function setInventoryColorChip(part) {
    const label = part.colorName || (part.colorId == null ? '' : String(part.colorId));
    const $chip = $('<span class="color-chip"></span>').attr('title', label).text(label);
    const rgb = String(part.colorRgb || '').replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(rgb)) {
      const hex = '#' + rgb;
      $chip.css({ 'background-color': hex, color: BrickTools.readableText(hex) });
    }
    return $chip;
  }

  /**
   * Create a status indicator for a part
   * @param {Object} part - Part object
   * @returns {jQuery} Status indicator jQuery element
   */
  function setInventoryStatus(part) {
    const expected = Number(part.expectedQut) || 0;
    const actual = Number(part.actualQut) || 0;
    if (actual >= expected) {
      return $('<span class="inventory-status complete"></span>').text('Complete');
    }
    return $('<span class="inventory-status missing"></span>').text((expected - actual) + ' missing');
  }

  /**
   * Generate set inventory summary text
   * @returns {string} Summary text
   */
  function setInventorySummary() {
    const setInventory = BrickTools.PurchasesShared.getSetInventory();
    if (setInventory.length === 0) {
      return '';
    }
    let complete = 0;
    let missing = 0;
    setInventory.forEach(function(part) {
      const expected = Number(part.expectedQut) || 0;
      const actual = Number(part.actualQut) || 0;
      if (actual >= expected) {
        complete++;
      } else {
        missing += expected - actual;
      }
    });
    return complete + ' of ' + setInventory.length + ' parts complete' +
      (missing > 0 ? ' — ' + missing + ' piece(s) missing' : '');
  }

  /**
   * Check if a part matches the search criteria
   * @param {Object} part - Part object
   * @param {string} search - Search string
   * @returns {boolean} True if part matches
   */
  function setInventoryMatches(part, search) {
    if (!search) {
      return true;
    }
    return [part.partNumber, part.partName, part.partCategory, part.colorName, part.colorId]
      .some(function(value) {
        return String(value == null ? '' : value).toLowerCase().includes(search);
      });
  }

  /**
   * Compare two parts for sorting
   * @param {Object} a - First part
   * @param {Object} b - Second part
   * @returns {number} Comparison result
   */
  function compareSetInventory(a, b) {
    const key = BrickTools.PurchasesShared.getSetInventorySortKey();
    if (key === 'expectedQut' || key === 'actualQut') {
      return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * BrickTools.PurchasesShared.getSetInventorySortDir();
    }
    const x = a[key] == null ? '' : String(a[key]);
    const y = b[key] == null ? '' : String(b[key]);
    if (x === '' && y === '') return 0;
    if (x === '') return 1;
    if (y === '') return -1;
    return x.localeCompare(y, undefined, { numeric: true }) * BrickTools.PurchasesShared.getSetInventorySortDir();
  }

  /**
   * Render the set inventory table
   */
  function renderSetInventory() {
    const setInventory = BrickTools.PurchasesShared.getSetInventory();
    const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
    const setInventorySearch = BrickTools.PurchasesShared.getSetInventorySearch();
    const setInventoryHideComplete = BrickTools.PurchasesShared.getSetInventoryHideComplete();
    const setInventorySortKey = BrickTools.PurchasesShared.getSetInventorySortKey();
    const setInventorySortDir = BrickTools.PurchasesShared.getSetInventorySortDir();
    const fmt = BrickTools.fmt;
    
    const $tbody = $('#set-inventory tbody').empty();
    updateSetInventoryButtons();
    $('#set-inventory thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + setInventorySortKey + '"]')
      .addClass(setInventorySortDir > 0 ? 'sort-asc' : 'sort-desc');

    if (!setInventorySet) {
      $tbody.append('<tr><td colspan="8" class="muted">Select a set to see its parts.</td></tr>');
      updateSetInventorySummary(0);
      return;
    }
    if (setInventory.length === 0) {
      $tbody.append($('<tr></tr>').append(
        $('<td colspan="8" class="muted"></td>').text('No inventory found for set ' + setInventorySet + '.')));
      updateSetInventorySummary(0);
      return;
    }

    const search = setInventorySearch.toLowerCase();
    const rows = setInventory.filter(function(part) {
      if (setInventoryHideComplete
          && (Number(part.actualQut) || 0) >= (Number(part.expectedQut) || 0)) {
        return false;
      }
      return setInventoryMatches(part, search);
    }).sort(compareSetInventory);

    if (rows.length === 0) {
      $tbody.append('<tr><td colspan="8" class="muted">No parts match the filters.</td></tr>');
    }
    rows.forEach(function(part) {
      const $row = $('<tr></tr>');
      $row.append(BrickTools.partImageCell(setInventoryImageUrl(part), part.partName || part.partNumber));
      $row.append($('<td></td>').text(part.partNumber || ''));
      $row.append($('<td></td>').text(part.partName || ''));
      $row.append($('<td></td>').text(part.partCategory || ''));
      $row.append($('<td></td>').append(setInventoryColorChip(part)));
      $row.append($('<td></td>').text(fmt.number(part.expectedQut)));
      $row.append($('<td></td>').append(
        $('<input type="number" class="set-inventory-actual" min="0" step="1">')
          .attr('title', 'Actual quantity')
          .attr('data-part-number', part.partNumber)
          .attr('data-color-id', part.colorId)
          .val(Number(part.actualQut) || 0)));
      $row.append($('<td class="inventory-status-cell"></td>').append(setInventoryStatus(part)));
      $tbody.append($row);
    });
    updateSetInventorySummary(rows.length);
  }

  /**
   * Update set inventory button states
   */
  function updateSetInventoryButtons() {
    const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
    const setInventoryBusy = BrickTools.PurchasesShared.getSetInventoryBusy();
    const setInventory = BrickTools.PurchasesShared.getSetInventory();
    const noSet = !setInventorySet || setInventoryBusy;
    $('#set-inventory-clear, #set-inventory-delete').prop('disabled', noSet);
    $('#set-inventory-fill').prop('disabled', noSet || setInventory.length === 0);
  }

  /**
   * Update set inventory summary display
   * @param {number} visibleCount - Number of visible rows
   */
  function updateSetInventorySummary(visibleCount) {
    const count = visibleCount == null
      ? $('#set-inventory tbody tr').filter(function() {
          return $(this).find('td.muted').length === 0;
        }).length
      : visibleCount;
    const summary = setInventorySummary();
    $('#set-inventory-summary').text(summary +
      (count !== BrickTools.PurchasesShared.getSetInventory().length ? ' — showing ' + count : ''));
  }

  /**
   * Run a set inventory action
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {string} loadingMessage - Loading message
   * @param {string} successMessage - Success message
   * @param {string} confirmMessage - Confirmation message
   */
  function runSetInventoryAction(path, method, loadingMessage, successMessage, confirmMessage) {
    const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
    if (!setInventorySet) {
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    BrickTools.PurchasesShared.setSetInventoryBusy(true);
    updateSetInventoryButtons();
    $('#set-inventory-msg').text(loadingMessage);
    BrickTools.api(method, '/sets/' + encodeURIComponent(setInventorySet) + path)
      .done(function() {
        loadSetInventory(setInventorySet, successMessage);
      })
      .fail(function(xhr) {
        $('#set-inventory-msg').text(BrickTools.errorOf(xhr));
      })
      .always(function() {
        BrickTools.PurchasesShared.setSetInventoryBusy(false);
        updateSetInventoryButtons();
      });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the set inventory module
   */
  function init() {
    // Set inventory set selector
    $('#set-inventory-set').on('change', function() {
      const setNumber = $(this).val() || '';
      BrickTools.PurchasesShared.setSetInventorySet(setNumber);
      BrickTools.PurchasesShared.setSetInventoryLoadedSet('');
      loadSetInventory(setNumber);
    });

    // Set inventory search
    $('#set-inventory-search').on('input', function() {
      BrickTools.PurchasesShared.setSetInventorySearch(this.value);
      renderSetInventory();
    });

    // Hide complete filter
    $('#set-inventory-hide-complete').on('change', function() {
      BrickTools.PurchasesShared.setSetInventoryHideComplete(this.checked);
      renderSetInventory();
    });

    // Clear inventory
    $('#set-inventory-clear').on('click', function() {
      const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
      runSetInventoryAction('/inventory/clear', 'POST',
        'Clearing actual quantities…', 'Actual quantities cleared.',
        'Clear the actual quantity of every part in set ' + setInventorySet + '?');
    });

    // Fill inventory
    $('#set-inventory-fill').on('click', function() {
      const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
      runSetInventoryAction('/inventory/fill', 'POST',
        'Setting actual quantities to expected…', 'Actual quantities set to expected.',
        'Set the actual quantity of every part in set ' + setInventorySet +
          ' to its expected quantity?');
    });

    // Delete inventory
    $('#set-inventory-delete').on('click', function() {
      const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
      runSetInventoryAction('/inventory', 'DELETE',
        'Deleting the set inventory…', 'Set inventory deleted.',
        'Delete the stored inventory for set ' + setInventorySet + '?');
    });

    // Table sorting
    $('#set-inventory thead').on('click', 'th[data-key]', function() {
      const key = $(this).attr('data-key');
      const sortDir = BrickTools.PurchasesShared.getSetInventorySortKey() === key 
        ? -BrickTools.PurchasesShared.getSetInventorySortDir() 
        : 1;
      BrickTools.PurchasesShared.setSetInventorySortKey(key);
      BrickTools.PurchasesShared.setSetInventorySortDir(sortDir);
      renderSetInventory();
    });

    // Actual quantity input change
    $('#set-inventory').on('change', '.set-inventory-actual', function() {
      const $input = $(this);
      const partNumber = $input.attr('data-part-number');
      const colorId = $input.attr('data-color-id');
      const setInventorySet = BrickTools.PurchasesShared.getSetInventorySet();
      const setInventory = BrickTools.PurchasesShared.getSetInventory();
      const part = setInventory.find(function(item) {
        return String(item.partNumber) === String(partNumber)
          && String(item.colorId) === String(colorId);
      });
      if (!part) {
        return;
      }
      const value = parseInt($input.val(), 10);
      if (isNaN(value) || value < 0) {
        $('#set-inventory-msg').text('Actual quantity must be a non-negative integer.');
        $input.val(Number(part.actualQut) || 0);
        return;
      }
      const previous = Number(part.actualQut) || 0;
      if (value === previous) {
        $('#set-inventory-msg').text('');
        return;
      }
      $input.prop('disabled', true);
      BrickTools.api('PUT',
        '/sets/' + encodeURIComponent(setInventorySet) + '/inventory/' +
        encodeURIComponent(partNumber) + '/' + encodeURIComponent(colorId),
        { actualQut: value })
        .done(function() {
          part.actualQut = value;
          $('#set-inventory-msg').text('');
          const hideComplete = BrickTools.PurchasesShared.getSetInventoryHideComplete();
          if (hideComplete && value >= (Number(part.expectedQut) || 0)) {
            renderSetInventory();
            return;
          }
          $input.closest('tr').find('td.inventory-status-cell')
            .empty().append(setInventoryStatus(part));
          updateSetInventorySummary();
        })
        .fail(function(xhr) {
          $input.val(previous);
          $('#set-inventory-msg').text(BrickTools.errorOf(xhr));
        })
        .always(function() {
          $input.prop('disabled', false);
        });
    });

    // Open set inventory from set sites
    $(document).on('click', '#set-sites-inventory-link', function(e) {
      e.preventDefault();
      const number = $(this).attr('data-set-number');
      BrickSets.closeSetSites();
      openSetInventory(number);
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PurchasesInventory = {
    init: init,
    populateSetInventorySets: populateSetInventorySets,
    ensureSetInventoryLoaded: ensureSetInventoryLoaded,
    openSetInventory: openSetInventory,
    loadSetInventory: loadSetInventory,
    setInventoryImageUrl: setInventoryImageUrl,
    setInventoryColorChip: setInventoryColorChip,
    setInventoryStatus: setInventoryStatus,
    setInventorySummary: setInventorySummary,
    setInventoryMatches: setInventoryMatches,
    compareSetInventory: compareSetInventory,
    renderSetInventory: renderSetInventory,
    updateSetInventoryButtons: updateSetInventoryButtons,
    updateSetInventorySummary: updateSetInventorySummary,
    runSetInventoryAction: runSetInventoryAction
  };
})();
