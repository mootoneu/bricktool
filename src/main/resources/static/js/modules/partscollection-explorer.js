/**
 * Parts Collection - Explorer Module
 * Handles part category exploration and main parts display
 */
(function () {
  'use strict';

  // State variables
  let partCategoryGroups = [];
  let partCategoriesLoading = false;
  let partCategoriesLoaded = false;
  let partCategoryCallbacks = [];
  let selectedPartCategoryId = '';
  let mainParts = [];
  let mainPartsRequest = 0;
  let pendingPartHighlight = '';
  let hideZeroStars = true;
  let mainPartsSearch = '';
  const mainPartsSort = { key: 'stars', dir: -1 };

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Check if part categories have been loaded
   * @returns {boolean} True if loaded
   */
  function isCategoriesLoaded() {
    return partCategoriesLoaded;
  }

  /**
   * Run the callbacks waiting for the category tree to load.
   */
  function flushCategoryCallbacks() {
    const callbacks = partCategoryCallbacks;
    partCategoryCallbacks = [];
    callbacks.forEach(function (callback) {
      try {
        callback();
      } catch (error) {
        // A failing callback must not prevent the others from running.
      }
    });
  }

  /**
   * Load part categories from the API
   * @param {Function} [callback] - Called once the categories have loaded (or failed to load)
   */
  function loadPartCategories(callback) {
    if (typeof callback === 'function') {
      partCategoryCallbacks.push(callback);
    }
    if (partCategoriesLoaded) {
      flushCategoryCallbacks();
      return;
    }
    if (partCategoriesLoading) {
      return;
    }
    partCategoriesLoading = true;
    BrickTools.PartsCollectionShared.report('#part-explorer-msg', 'Loading part categories…');
    BrickTools.api('GET', '/parts/categories')
      .done(function (list) {
        partCategoryGroups = Array.isArray(list) ? list : [];
        partCategoriesLoaded = true;
        renderPartCategoryTree();
        BrickTools.PartsCollectionShared.report('#part-explorer-msg',
          partCategoryGroups.length === 0 ? 'No part categories available.' : 'Select a category.');
        flushCategoryCallbacks();
      })
      .fail(function (xhr) {
        partCategoryGroups = [];
        renderPartCategoryTree();
        BrickTools.PartsCollectionShared.report('#part-explorer-msg', BrickTools.errorOf(xhr));
        flushCategoryCallbacks();
      })
      .always(function () {
        partCategoriesLoading = false;
      });
  }

  /**
   * Load main parts for the selected category
   * @param {string} [partNumber] - Part to scroll to and highlight once rendered
   */
  function loadMainParts(partNumber) {
    pendingPartHighlight = partNumber ? String(partNumber) : '';
    const request = ++mainPartsRequest;
    if (!selectedPartCategoryId) {
      mainParts = [];
      pendingPartHighlight = '';
      $('#main-parts').prop('hidden', true);
      $('#main-parts-count').text('');
      BrickTools.PartsCollectionShared.report('#part-explorer-msg', 'Select a category.');
      return;
    }
    BrickTools.PartsCollectionShared.report('#part-explorer-msg', 'Loading main parts…');
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
        BrickTools.PartsCollectionShared.report('#part-explorer-msg', BrickTools.errorOf(xhr));
      });
  }

  // ============================================================================
  // Helper functions
  // ============================================================================

  /**
   * Create a category button element
   * @param {Object} category - Category object
   * @returns {jQuery} jQuery button element
   */
  function partCategoryButton(category) {
    return $('<button type="button" class="part-category-item"></button>')
      .attr('data-category-id', category.id)
      .text(category.name || '')
      .toggleClass('active', String(category.id) === String(selectedPartCategoryId));
  }

  /**
   * Create a star rating cell
   * @param {Object} part - Part object with stars property
   * @returns {jQuery} jQuery TD element
   */
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

  /**
   * Create a part image cell
   * @param {Object} part - Part object with partNumber and name
   * @returns {jQuery} jQuery TD element
   */
  function partImageCell(part) {
    const $cell = $('<td class="main-part-image"></td>');
    $('<img class="part-img" loading="lazy" alt="">')
      .attr('src', '/api/parts/' + encodeURIComponent(part.partNumber) + '/image')
      .attr('alt', part.name || part.partNumber)
      .attr('title', part.name || part.partNumber)
      .attr('data-part-number', part.partNumber)
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', 'Part information for ' + (part.name || part.partNumber))
      .on('error', function () { $(this).prop('hidden', true); })
      .appendTo($cell);
    return $cell;
  }

  // ============================================================================
  // Render functions
  // ============================================================================

  /**
   * Render the part category tree
   */
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

  /**
   * Render the main parts table
   */
  function renderMainParts() {
    const fmt = BrickTools.fmt;
    const partToHighlight = pendingPartHighlight;
    pendingPartHighlight = '';
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
    const visible = BrickTools.PartsCollectionShared.sortRows(filtered, mainPartsSort);
    BrickTools.PartsCollectionShared.markSortedHeader('#main-parts', mainPartsSort);
    $('#main-parts-count').text(mainParts.length === 0 ? '' :
      fmt.number(visible.length) + ' of ' + fmt.number(mainParts.length) + ' parts');

    if (visible.length === 0) {
      $table.prop('hidden', true);
      BrickTools.PartsCollectionShared.report('#part-explorer-msg', mainParts.length === 0
        ? 'No main parts in this category.'
        : 'No main parts match the current filters.');
      return;
    }

    visible.forEach(function (part) {
      const $row = $('<tr></tr>').attr('data-part-number', part.partNumber);
      $row.append(partImageCell(part));
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
    BrickTools.PartsCollectionShared.report('#part-explorer-msg', '');
    highlightPart(partToHighlight);
  }

  /**
   * Scroll to a part row and briefly highlight it.
   * @param {string} partNumber - The part number to highlight
   */
  function highlightPart(partNumber) {
    if (!partNumber) {
      return;
    }
    const $row = $('#main-parts tbody tr').filter(function () {
      return String($(this).attr('data-part-number')) === partNumber;
    }).first();
    if (!$row.length) {
      // The part exists in the category but is hidden by the current filters.
      if ((hideZeroStars || mainPartsSearch) && mainParts.some(function (part) {
        return String(part.partNumber) === partNumber;
      })) {
        hideZeroStars = false;
        mainPartsSearch = '';
        $('#main-parts-hide-zero').prop('checked', false);
        $('#main-parts-search').val('');
        pendingPartHighlight = partNumber;
        renderMainParts();
      }
      return;
    }
    $row.addClass('highlight');
    if ($row[0].scrollIntoView) {
      $row[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setTimeout(function () {
      $row.removeClass('highlight');
    }, 2500);
  }

  /**
   * Select a category and show it in the explorer, optionally highlighting a part.
   * @param {string|number} categoryId - Category to select
   * @param {string} [partNumber] - Part to scroll to and highlight
   */
  function showPart(categoryId, partNumber) {
    const id = String(categoryId == null ? '' : categoryId).trim();
    if (!id) {
      return;
    }
    const part = String(partNumber == null ? '' : partNumber).trim();
    loadPartCategories(function () {
      const $button = $('#part-category-tree .part-category-item').filter(function () {
        return String($(this).attr('data-category-id')) === id;
      }).first();
      if (!$button.length) {
        return;
      }
      const $group = $button.closest('details.part-category-group');
      if ($group.length) {
        $group.prop('open', true);
      }
      selectedPartCategoryId = id;
      $('#part-category-tree .part-category-item').removeClass('active');
      $button.addClass('active');
      loadMainParts(part);
    });
  }

  // ============================================================================
  // Modal functions
  // ============================================================================

  /**
   * Close the main part alternates modal
   */
  function closeMainPartAlternates() {
    $('#main-part-alternates-modal').prop('hidden', true);
  }

  /**
   * Open the main part alternates modal
   * @param {string} partNumber - The part number to show alternates for
   */
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

  /**
   * Save star rating for a main part
   * @param {string} partNumber - The part number
   * @param {number} stars - The star rating (0-5)
   */
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
        BrickTools.PartsCollectionShared.report('#part-explorer-msg', BrickTools.errorOf(xhr));
      });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the Explorer module
   */
  function init() {
    // Category tree event handler
    $('#part-category-tree').on('click', '.part-category-item', function () {
      selectedPartCategoryId = String($(this).attr('data-category-id'));
      $('#part-category-tree .part-category-item').removeClass('active');
      $(this).addClass('active');
      loadMainParts();
    });

    // Main parts filter and search handlers
    $('#main-parts-hide-zero').on('change', function () {
      hideZeroStars = this.checked;
      renderMainParts();
    });

    $('#main-parts-search').on('input', function () {
      mainPartsSearch = this.value;
      renderMainParts();
    });

    $('#main-parts thead').on('click', 'th[data-key]', function () {
      BrickTools.PartsCollectionShared.sortBy(mainPartsSort, $(this).attr('data-key'));
      renderMainParts();
    });

    // Star rating handler
    $('#main-parts').on('click', '.star', function () {
      const partNumber = $(this).closest('tr').attr('data-part-number');
      const stars = parseInt($(this).attr('data-stars'), 10);
      if (partNumber && !isNaN(stars)) {
        saveMainPartStars(partNumber, stars);
      }
    });

    // Alternates handler
    $('#main-parts').on('click', '.main-part-alternates', function () {
      openMainPartAlternates($(this).attr('data-part-number'));
    });

    // Modal handlers
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
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PartsCollectionExplorer = {
    init: init,
    isCategoriesLoaded: isCategoriesLoaded,
    loadPartCategories: loadPartCategories,
    loadMainParts: loadMainParts,
    renderMainParts: renderMainParts,
    showPart: showPart,
    getPartCategoryGroups: function() { return partCategoryGroups; },
    getMainParts: function() { return mainParts; },
    getSelectedPartCategoryId: function() { return selectedPartCategoryId; },
    getHideZeroStars: function() { return hideZeroStars; },
    getMainPartsSearch: function() { return mainPartsSearch; },
    getMainPartsSort: function() { return mainPartsSort; }
  };
})();
