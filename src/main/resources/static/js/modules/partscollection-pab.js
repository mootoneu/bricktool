/**
 * Parts Collection - Pick-a-Brick (PaB) Module
 * Handles PaB purchases and parts management
 */
(function () {
  'use strict';

  // State variables
  let pabPurchases = [];
  let pabPurchasesLoading = false;
  let pabPurchasesLoaded = false;
  let pabPurchasesCallbacks = [];
  let selectedPabPurchaseId = '';
  let pabParts = [];
  let pabPartsRequest = 0;

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Check if PaB purchases have been loaded
   * @returns {boolean} True if loaded
   */
  function isPabLoaded() {
    return pabPurchasesLoaded;
  }

  /**
   * Load PaB purchases from the API
   * @param {Function} [callback] - Optional callback to execute after loading
   */
  function loadPabPurchases(callback) {
    if (callback) {
      pabPurchasesCallbacks.push(callback);
    }
    if (pabPurchasesLoading) {
      return;
    }
    pabPurchasesLoading = true;
    BrickTools.PartsCollectionShared.report('#pab-purchases-msg', 'Loading PaB purchases…');
    BrickTools.api('GET', '/pab/purchases')
      .done(function (list) {
        pabPurchases = Array.isArray(list) ? list : [];
        pabPurchasesLoaded = true;
        renderPabPurchases();
        populatePabPurchaseSelect();
        BrickTools.PartsCollectionShared.report('#pab-purchases-msg', pabPurchases.length === 0 ? 'No PaB purchases stored yet.' : '');
      })
      .fail(function (xhr) {
        pabPurchases = [];
        populatePabPurchaseSelect();
        const $tbody = $('#pab-purchases tbody').empty();
        $tbody.append($('<tr></tr>').append(
          $('<td colspan="7" class="muted"></td>').text('Unable to load PaB purchases.')));
        BrickTools.PartsCollectionShared.report('#pab-purchases-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        pabPurchasesLoading = false;
        const callbacks = pabPurchasesCallbacks;
        pabPurchasesCallbacks = [];
        callbacks.forEach(function (fn) { fn(); });
      });
  }

  /**
   * Load PaB parts for the selected purchase
   */
  function loadPabParts() {
    const request = ++pabPartsRequest;
    if (!selectedPabPurchaseId) {
      pabParts = [];
      renderPabParts();
      BrickTools.PartsCollectionShared.report('#pab-parts-msg', 'Add a PaB purchase first.');
      return;
    }
    BrickTools.PartsCollectionShared.report('#pab-parts-msg', 'Loading PaB parts…');
    BrickTools.api('GET', '/pab/purchases/' + encodeURIComponent(selectedPabPurchaseId) + '/parts')
      .done(function (list) {
        if (request !== pabPartsRequest) {
          return;
        }
        pabParts = Array.isArray(list) ? list : [];
        renderPabParts();
        BrickTools.PartsCollectionShared.report('#pab-parts-msg', pabParts.length === 0 ? 'No parts stored for this purchase.' : '');
      })
      .fail(function (xhr) {
        if (request !== pabPartsRequest) {
          return;
        }
        pabParts = [];
        renderPabParts();
        BrickTools.PartsCollectionShared.report('#pab-parts-msg', BrickTools.errorOf(xhr));
      });
  }

  // ============================================================================
  // Helper functions
  // ============================================================================

  /**
   * Find a PaB purchase by ID
   * @param {string} id - Purchase ID
   * @returns {Object|null} The purchase object or null
   */
  function findPabPurchase(id) {
    return pabPurchases.find(function (purchase) {
      return String(purchase.id) === String(id);
    });
  }

  /**
   * Find a PaB part by ID
   * @param {string} id - Part ID
   * @returns {Object|null} The part object or null
   */
  function findPabPart(id) {
    return pabParts.find(function (part) {
      return String(part.id) === String(id);
    });
  }

  /**
   * Create a color chip for PaB parts
   * @param {Object} part - Part object with color information
   * @returns {jQuery} jQuery span element
   */
  function pabColorChip(part) {
    const colorId = part.partColorId;
    const label = part.colorName || (colorId == null ? '' : String(colorId));
    const $chip = $('<span class="color-chip"></span>')
      .attr('title', label)
      .text(label)
      .css('cursor', 'pointer')
      .attr('tabindex', '0');
    const hex = BrickTools.PartsCollectionShared.colorHex({ rgb: part.colorRgb });
    if (hex) {
      $chip.css({ 'background-color': hex, color: BrickTools.PartsCollectionShared.readableTextColor(hex) });
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

  // ============================================================================
  // Render functions
  // ============================================================================

  /**
   * Render the PaB purchases table
   */
  function renderPabPurchases() {
    const fmt = BrickTools.fmt;
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

  /**
   * Render the PaB parts table
   */
  function renderPabParts() {
    const fmt = BrickTools.fmt;
    const $tbody = $('#pab-parts tbody').empty();
    if (!selectedPabPurchaseId) {
      $tbody.append('<tr><td colspan="9" class="muted">No PaB purchase selected.</td></tr>');
      return;
    }
    if (pabParts.length === 0) {
      $tbody.append('<tr><td colspan="9" class="muted">No parts for this purchase yet.</td></tr>');
      return;
    }
    pabParts.forEach(function (part) {
      const $row = $('<tr></tr>');
      const imageUrl = part.partNumber
        ? '/api/parts/' + encodeURIComponent(part.partNumber) + '/image' +
          (part.partColorId == null || part.partColorId === ''
            ? '' : '?colorId=' + encodeURIComponent(part.partColorId))
        : '';
      $row.append(BrickTools.partImageCell(imageUrl, part.partName || part.partNumber,
        part.partNumber));
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

  /**
   * Enable or disable the previous and next purchase buttons
   */
  function updatePabPurchaseNav() {
    const ids = pabPurchases.map(function (purchase) { return String(purchase.id); });
    const index = ids.indexOf(String(selectedPabPurchaseId));
    const missing = index < 0;
    $('#pab-parts-prev').prop('disabled', missing || index === 0);
    $('#pab-parts-next').prop('disabled', missing || index === ids.length - 1);
  }

  /**
   * Select the previous or next PaB purchase
   * @param {number} direction - -1 for the previous purchase, 1 for the next
   */
  function stepPabPurchase(direction) {
    const ids = pabPurchases.map(function (purchase) { return String(purchase.id); });
    const index = ids.indexOf(String(selectedPabPurchaseId));
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) {
      return;
    }
    selectedPabPurchaseId = ids[next];
    $('#pab-parts-purchase').val(selectedPabPurchaseId);
    updatePabPurchaseNav();
    loadPabParts();
  }

  /**
   * Populate the PaB purchase select dropdown
   */
  function populatePabPurchaseSelect() {
    const $select = $('#pab-parts-purchase').empty();
    if (pabPurchases.length === 0) {
      $select.append($('<option></option>').attr('value', '').text('No PaB purchases'));
      $select.prop('disabled', true);
      $('#pab-part-add').prop('disabled', true);
      selectedPabPurchaseId = '';
      updatePabPurchaseNav();
      return;
    }
    pabPurchases.forEach(function (purchase) {
      $select.append($('<option></option>')
        .attr('value', purchase.id)
        .text((purchase.purchaseDate || '') + ' (#' + purchase.id + ')'));
    });
    $select.prop('disabled', false);
    // Only reset selectedPabPurchaseId if it's not set
    if (!selectedPabPurchaseId) {
      selectedPabPurchaseId = String(pabPurchases[0].id);
    }
    $select.val(selectedPabPurchaseId);
    $('#pab-part-add').prop('disabled', false);
    updatePabPurchaseNav();
  }

  // ============================================================================
  // Form handling
  // ============================================================================

  /**
   * Open the PaB purchase form for editing or adding
   * @param {Object|null} purchase - Purchase object or null for new
   */
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

  /**
   * Close the PaB purchase form
   */
  function closePabPurchaseForm() {
    $('#pab-purchase-modal').prop('hidden', true);
  }

  /**
   * Open the PaB part form for editing or adding
   * @param {Object|null} part - Part object or null for new
   */
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

  /**
   * Close the PaB part form
   */
  function closePabPartForm() {
    $('#pab-part-modal').prop('hidden', true);
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the PaB module
   */
  function init() {
    // PaB Purchase form event handlers
    $('#pab-purchase-add').on('click', function () {
      openPabPurchaseForm(null);
    });

    $('#pab-purchase-cancel').on('click', closePabPurchaseForm);

    $('#pab-purchases').on('click', '.pab-purchase-edit', function () {
      openPabPurchaseForm(findPabPurchase($(this).attr('data-pab-purchase-id')));
    });

    $('#pab-purchases').on('click', '.pab-parts-open', function () {
      selectedPabPurchaseId = String($(this).attr('data-pab-purchase-id'));
      // Set the dropdown value immediately so it's correct when the tab opens
      $('.tabs [data-tab="pab-parts"]').trigger('click');
      $('#pab-parts-purchase').val(selectedPabPurchaseId);
      updatePabPurchaseNav();
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

    // PaB Parts event handlers
    $('#pab-parts-purchase').on('change', function () {
      selectedPabPurchaseId = String($(this).val() || '');
      updatePabPurchaseNav();
      loadPabParts();
    });

    $('#pab-parts-prev').on('click', function () {
      stepPabPurchase(-1);
    });

    $('#pab-parts-next').on('click', function () {
      stepPabPurchase(1);
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
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PartsCollectionPab = {
    init: init,
    isPabLoaded: isPabLoaded,
    loadPabPurchases: loadPabPurchases,
    loadPabParts: loadPabParts,
    populatePabPurchaseSelect: populatePabPurchaseSelect,
    getPabPurchases: function() { return pabPurchases; },
    getPabParts: function() { return pabParts; },
    getSelectedPabPurchaseId: function() { return selectedPabPurchaseId; }
  };
})();
