/**
 * Parts Collection - BrickOwl Module
 * Handles BrickOwl parts collection display and management
 */
(function () {
  'use strict';

  // State variables
  let parts = [];
  let loading = false;
  let loaded = false;
  const sortState = { key: 'name', dir: 1 };

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Check if BrickOwl parts have been loaded
   * @returns {boolean} True if loaded
   */
  function isLoaded() {
    return loaded;
  }

  /**
   * Refresh the BrickOwl parts display
   */
  function refresh() {
    if (!loaded) {
      loadParts();
    }
  }

  /**
   * Render the BrickOwl parts table
   */
  function renderParts() {
    const fmt = BrickTools.fmt;
    const $tbody = $('#bo-parts-collection tbody').empty();
    BrickTools.PartsCollectionShared.markSortedHeader('#bo-parts-collection', sortState);
    if (parts.length === 0) {
      $tbody.append('<tr><td colspan="9" class="muted">No BrickOwl order items yet. ' +
        'Run an update from the <a href="brickowl.html#update">BrickOwl page</a>.</td></tr>');
      return;
    }
    BrickTools.PartsCollectionShared.sortRows(parts, sortState).forEach(function (part) {
      const $row = $('<tr></tr>');
      const name = BrickTools.getPartNameFromBOName(part.name || '', part.colorName || '');
      $row.append(BrickTools.partImageCell(
        BrickTools.partImageUrls(part.itemNumbers, part.designIds), name));
      $row.append($('<td></td>').text(part.type || ''));
      $row.append($('<td></td>').text(name));
      $row.append(BrickTools.PartsCollectionShared.renderColorCell(part));
      $row.append($('<td></td>').text(part.designIds || ''));
      $row.append($('<td></td>').text(part.itemNumbers || ''));
      $row.append($('<td></td>').text(part.condition || ''));
      $row.append(BrickTools.PartsCollectionShared.renderOrdersCell(part.orders));
      $row.append($('<td></td>').text(fmt.number(part.totalQuantity)));
      $tbody.append($row);
    });
  }

  /**
   * Show error message for BrickOwl parts
   * @param {jQuery} xhr - jQuery XMLHttpRequest object
   */
  function showError(xhr) {
    parts = [];
    const $tbody = $('#bo-parts-collection tbody').empty();
    $tbody.append($('<tr></tr>').append(
      $('<td colspan="9" class="muted"></td>').text('Unable to load BrickOwl parts.')));
    BrickTools.PartsCollectionShared.report('#bo-parts-msg', BrickTools.errorOf(xhr));
  }

  /**
   * Load BrickOwl parts from the API
   */
  function loadParts() {
    if (loading) {
      return;
    }
    loading = true;
    loaded = true;
    BrickTools.PartsCollectionShared.report('#bo-parts-msg', 'Loading BrickOwl parts…');
    BrickTools.api('GET', '/brickowl/parts')
      .done(function (list) {
        parts = Array.isArray(list) ? list : [];
        renderParts();
        if (parts.length === 0) {
          BrickTools.PartsCollectionShared.report('#bo-parts-msg', 'No BrickOwl order items stored yet.');
        } else {
          const fmt = BrickTools.fmt;
          BrickTools.PartsCollectionShared.report('#bo-parts-msg', fmt.number(parts.length) + ' distinct parts from ' +
            fmt.number(BrickTools.PartsCollectionShared.orderCount(parts)) + ' order(s).');
        }
      })
      .fail(showError)
      .always(function () {
        loading = false;
      });
  }

  // ============================================================================
  // Event handlers
  // ============================================================================

  /**
   * Initialize event handlers for the BrickOwl table
   */
  function initEventHandlers() {
    $('#bo-parts-collection thead').on('click', 'th[data-key]', function () {
      BrickTools.PartsCollectionShared.sortBy(sortState, $(this).attr('data-key'));
      renderParts();
    });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the BrickOwl module
   */
  function init() {
    initEventHandlers();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PartsCollectionBrickOwl = {
    init: init,
    isLoaded: isLoaded,
    refresh: refresh,
    renderParts: renderParts,
    loadParts: loadParts,
    getParts: function() { return parts; },
    getSortState: function() { return sortState; }
  };
})();
