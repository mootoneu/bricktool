/**
 * Parts Collection - Explorer Module
 * Handles part category exploration and main parts display
 */
(function () {
  'use strict';

  // The fake category that holds the results of a search across all categories.
  const SEARCH_CATEGORY_ID = 'search';

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
  let categorySearch = '';
  let categorySearchTotal = 0;
  let categorySearchTimer = null;
  let visibleMainParts = [];
  const selectedPartNumbers = new Set();
  const mainPartsSort = { key: 'stars', dir: -1 };

  /**
   * Check whether the fake Search category is selected
   * @returns {boolean} True when searching all categories
   */
  function isSearchSelected() {
    return selectedPartCategoryId === SEARCH_CATEGORY_ID;
  }

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
    if (isSearchSelected()) {
      loadSearchParts(request);
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

  /**
   * Load the parts matching the global search across all categories
   * @param {number} request - Request token used to ignore stale responses
   */
  function loadSearchParts(request) {
    const query = categorySearch.trim();
    mainParts = [];
    categorySearchTotal = 0;
    if (!query) {
      renderMainParts();
      return;
    }
    BrickTools.PartsCollectionShared.report('#part-explorer-msg', 'Searching parts…');
    $('#main-parts').prop('hidden', true);
    BrickTools.api('GET', '/parts/main-parts/search?query=' + encodeURIComponent(query))
      .done(function (result) {
        if (request !== mainPartsRequest) {
          return;
        }
        mainParts = result && Array.isArray(result.parts) ? result.parts : [];
        categorySearchTotal = result && typeof result.total === 'number'
          ? result.total : mainParts.length;
        renderMainParts();
      })
      .fail(function (xhr) {
        if (request !== mainPartsRequest) {
          return;
        }
        mainParts = [];
        categorySearchTotal = 0;
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
   * Build the star rating buttons
   * @param {number} value - Number of stars to mark as on; -1 marks none
   * @param {jQuery} [$container] - Optional existing container to fill
   * @returns {jQuery} The stars container
   */
  function starButtons(value, $container) {
    const $stars = $container || $('<span class="stars"></span>');
    $stars.empty();
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
    return $stars;
  }

  /**
   * Create a star rating cell
   * @param {Object} part - Part object with stars property
   * @returns {jQuery} jQuery TD element
   */
  function starCell(part) {
    return $('<td></td>').append(starButtons(Number(part.stars || 0)));
  }

  /**
   * Create a selection checkbox cell
   * @param {Object} part - Part object with partNumber and name
   * @returns {jQuery} jQuery TD element
   */
  function selectionCell(part) {
    const $cell = $('<td class="main-part-select-col"></td>');
    $('<input type="checkbox" class="main-part-select">')
      .attr('data-part-number', part.partNumber)
      .prop('checked', selectedPartNumbers.has(String(part.partNumber)))
      .attr('aria-label', 'Select ' + (part.name || part.partNumber))
      .appendTo($cell);
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
  // Selection functions
  // ============================================================================

  /**
   * Clear the selected parts
   */
  function clearSelection() {
    selectedPartNumbers.clear();
    updateSelectionUi();
  }

  /**
   * Add every visible part to the selection
   */
  function selectVisibleParts() {
    visibleMainParts.forEach(function (part) {
      selectedPartNumbers.add(String(part.partNumber));
    });
    updateSelectionUi();
  }

  /**
   * Refresh the selection toolbar and the row/header checkboxes
   */
  function updateSelectionUi() {
    const count = selectedPartNumbers.size;
    let selectedVisible = 0;
    visibleMainParts.forEach(function (part) {
      if (selectedPartNumbers.has(String(part.partNumber))) {
        selectedVisible++;
      }
    });

    $('#main-parts-selection').prop('hidden', visibleMainParts.length === 0 && count === 0);
    $('#main-parts-selected-count').text(
      count === 1 ? '1 part selected' : count + ' parts selected');
    $('#main-parts-clear-selection').prop('disabled', count === 0);
    $('#main-parts-bulk-stars .star').prop('disabled', count === 0);
    $('#main-parts-bulk-add').prop('disabled', count === 0);
    $('#main-parts-select-all').prop('disabled', visibleMainParts.length === 0);

    const $header = $('#main-parts-select-all-visible');
    $header.prop('disabled', visibleMainParts.length === 0)
      .prop('checked', visibleMainParts.length > 0 && selectedVisible === visibleMainParts.length)
      .prop('indeterminate', selectedVisible > 0 && selectedVisible < visibleMainParts.length);

    $('#main-parts tbody tr').each(function () {
      const $row = $(this);
      const number = String($row.attr('data-part-number'));
      const selected = selectedPartNumbers.has(number);
      $row.toggleClass('selected', selected);
      $row.find('.main-part-select').prop('checked', selected);
    });
  }

  /**
   * Set the star rating of every selected part
   * @param {number} stars - The star rating (0-5)
   */
  function saveSelectedMainPartStars(stars) {
    const numbers = Array.from(selectedPartNumbers);
    if (numbers.length === 0) {
      return;
    }
    $('#main-parts-bulk-stars .star').prop('disabled', true);
    BrickTools.api('PUT', '/parts/main-parts/stars', { partNumbers: numbers, stars: stars })
      .done(function (result) {
        numbers.forEach(function (partNumber) {
          const part = mainParts.find(function (item) {
            return String(item.partNumber) === String(partNumber);
          });
          if (part) {
            part.stars = stars;
          }
        });
        renderMainParts();
        const updated = result && typeof result.updated === 'number' ? result.updated : numbers.length;
        BrickTools.PartsCollectionShared.report('#part-explorer-msg',
          'Updated stars for ' + updated + (updated === 1 ? ' part.' : ' parts.'));
      })
      .fail(function (xhr) {
        BrickTools.PartsCollectionShared.report('#part-explorer-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        updateSelectionUi();
      });
  }

  /**
   * Add parts to the active container. The active container is a part storage, a storage
   * drawer, a Pick-a-Brick purchase, or a BrickOwl order, chosen from the parts collection
   * page and shown in the application header.
   * @param {string[]} partNumbers - Part numbers to add
   */
  function addPartsToContainer(partNumbers) {
    const numbers = (partNumbers || []).filter(function (partNumber) {
      return String(partNumber == null ? '' : partNumber).trim() !== '';
    });
    if (numbers.length === 0) {
      return;
    }
    const container = BrickTools.getActiveContainer();
    if (!container) {
      BrickTools.PartsCollectionShared.report('#part-explorer-msg',
        'No active container. Set one from the Collection, Part storage, or Storage drawers tab.');
      return;
    }
    const label = BrickTools.activeContainerLabel(container);
    $('#main-parts-bulk-add').prop('disabled', true);
    BrickTools.PartsCollectionShared.report('#part-explorer-msg',
      'Adding ' + numbers.length + (numbers.length === 1 ? ' part' : ' parts')
        + ' to ' + label + '…');
    BrickTools.addToActiveContainer(numbers)
      .done(function (result) {
        const added = result && typeof result.added === 'number' ? result.added : numbers.length;
        BrickTools.PartsCollectionShared.report('#part-explorer-msg',
          'Added ' + added + (added === 1 ? ' part' : ' parts') + ' to ' + label + '.');
        if (selectedPartNumbers.size > 0) {
          clearSelection();
        }
      })
      .fail(function (xhr) {
        BrickTools.PartsCollectionShared.report('#part-explorer-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        updateSelectionUi();
      });
  }

  /**
   * Show a part in the Collection tab by filling its search field and running the search.
   * @param {string} partNumber - The part number to search for
   */
  function searchPartInCollection(partNumber) {
    const value = String(partNumber == null ? '' : partNumber).trim();
    if (!value) {
      return;
    }
    $('[data-tab="collection"]').trigger('click');
    $('#collection-search').val(value).trigger('input').trigger('focus');
  }

  // ============================================================================
  // Render functions
  // ============================================================================

  /**
   * Render the part category tree
   */
  function renderPartCategoryTree() {
    const $tree = $('#part-category-tree').empty();
    $tree.append(partCategoryButton({ id: SEARCH_CATEGORY_ID, name: 'Search' })
      .addClass('part-category-search-item'));
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
    const searching = isSearchSelected();
    const searchText = categorySearch.trim();
    const $tbody = $('#main-parts tbody').empty();
    const $table = $('#main-parts');
    const query = mainPartsSearch.trim().toLowerCase();
    visibleMainParts = [];

    $('#main-parts thead th.main-part-category-col').prop('hidden', !searching);
    $('#main-parts-search').attr('placeholder', searching ? 'Filter results' : 'Filter this category');

    if (searching && !searchText) {
      $table.prop('hidden', true);
      $('#main-parts-selection').prop('hidden', true);
      $('#main-parts-count').text('');
      updateSelectionUi();
      BrickTools.PartsCollectionShared.report('#part-explorer-msg',
        'Type a part number or name to search all categories.');
      return;
    }

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
    visibleMainParts = visible;
    BrickTools.PartsCollectionShared.markSortedHeader('#main-parts', mainPartsSort);

    if (searching) {
      let count = fmt.number(visible.length) + ' of ' + fmt.number(categorySearchTotal)
        + ' parts matching "' + searchText + '"';
      if (categorySearchTotal > mainParts.length) {
        count += ' (first ' + fmt.number(mainParts.length) + ' loaded)';
      }
      $('#main-parts-count').text(count);
    } else {
      $('#main-parts-count').text(mainParts.length === 0 ? '' :
        fmt.number(visible.length) + ' of ' + fmt.number(mainParts.length) + ' parts');
    }

    if (visible.length === 0) {
      $table.prop('hidden', true);
      // Keep the selection toolbar available when selected parts are hidden by the filters.
      $('#main-parts-selection').prop('hidden', selectedPartNumbers.size === 0);
      updateSelectionUi();
      let message;
      if (searching) {
        message = mainParts.length === 0
          ? 'No parts match "' + searchText + '".'
          : 'No parts match the current filters.';
      } else {
        message = mainParts.length === 0
          ? 'No main parts in this category.'
          : 'No main parts match the current filters.';
      }
      BrickTools.PartsCollectionShared.report('#part-explorer-msg', message);
      return;
    }

    visible.forEach(function (part) {
      const $row = $('<tr></tr>').attr('data-part-number', part.partNumber)
        .toggleClass('selected', selectedPartNumbers.has(String(part.partNumber)));
      $row.append(selectionCell(part));
      $row.append(partImageCell(part));
      $row.append($('<td></td>').text(part.partNumber || ''));
      $row.append($('<td></td>').text(part.name || ''));
      if (searching) {
        $row.append($('<td class="main-part-category-col"></td>').text(part.categoryName || ''));
      }
      $row.append($('<td></td>').text(part.material || ''));

      const $alternates = $('<td></td>');
      if (part.hasAlternates) {
        $alternates.append($('<button type="button" class="btn secondary main-part-alternates">View</button>')
          .attr('data-part-number', part.partNumber));
      }
      $row.append($alternates);
      $row.append(starCell(part));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary search-collection">Search</button>')
        .attr('data-part-number', part.partNumber)
        .attr('title', 'Search this part in the Collection tab'));
      $actions.append($('<button type="button" class="btn secondary add-to-container">Add to container</button>')
        .attr('data-part-number', part.partNumber));
      $row.append($actions);
      $tbody.append($row);
    });
    $table.prop('hidden', false);
    $('#main-parts-selection').prop('hidden', false);
    BrickTools.PartsCollectionShared.report('#part-explorer-msg', '');
    updateSelectionUi();
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
      if (selectedPartCategoryId !== id) {
        clearSelection();
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
   * Select the fake Search category in the tree
   */
  function selectSearchCategory() {
    clearSelection();
    selectedPartCategoryId = SEARCH_CATEGORY_ID;
    loadPartCategories();
    if (!$('#part-category-tree .part-category-item').length) {
      renderPartCategoryTree();
    }
    $('#part-category-tree .part-category-item').removeClass('active')
      .filter('[data-category-id="' + SEARCH_CATEGORY_ID + '"]').addClass('active');
  }

  /**
   * Initialize the Explorer module
   */
  function init() {
    starButtons(-1, $('#main-parts-bulk-stars'));

    // Category tree event handler
    $('#part-category-tree').on('click', '.part-category-item', function () {
      const categoryId = String($(this).attr('data-category-id'));
      if (categoryId !== selectedPartCategoryId) {
        clearSelection();
      }
      selectedPartCategoryId = categoryId;
      $('#part-category-tree .part-category-item').removeClass('active');
      $(this).addClass('active');
      if (isSearchSelected()) {
        $('#part-category-search').trigger('focus');
      }
      loadMainParts();
    });

    // Global search across all categories
    $('#part-category-search').on('input', function () {
      categorySearch = this.value;
      if (categorySearchTimer) {
        clearTimeout(categorySearchTimer);
      }
      categorySearchTimer = setTimeout(function () {
        categorySearchTimer = null;
        selectSearchCategory();
        loadMainParts();
      }, 250);
    }).on('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (categorySearchTimer) {
          clearTimeout(categorySearchTimer);
          categorySearchTimer = null;
        }
        selectSearchCategory();
        loadMainParts();
      }
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

    // Selection handlers
    $('#main-parts').on('change', '.main-part-select', function () {
      const partNumber = String($(this).attr('data-part-number') || '');
      if (!partNumber) {
        return;
      }
      if (this.checked) {
        selectedPartNumbers.add(partNumber);
      } else {
        selectedPartNumbers.delete(partNumber);
      }
      updateSelectionUi();
    });

    $('#main-parts-select-all-visible').on('change', function () {
      if (this.checked) {
        selectVisibleParts();
        return;
      }
      visibleMainParts.forEach(function (part) {
        selectedPartNumbers.delete(String(part.partNumber));
      });
      updateSelectionUi();
    });

    $('#main-parts-select-all').on('click', selectVisibleParts);
    $('#main-parts-clear-selection').on('click', clearSelection);

    $('#main-parts-bulk-stars').on('click', '.star', function () {
      const stars = parseInt($(this).attr('data-stars'), 10);
      if (!isNaN(stars)) {
        saveSelectedMainPartStars(stars);
      }
    });

    $('#main-parts-bulk-add').on('click', function () {
      addPartsToContainer(Array.from(selectedPartNumbers));
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

    // Search this part in the Collection tab
    $('#main-parts').on('click', '.search-collection', function () {
      searchPartInCollection($(this).attr('data-part-number'));
    });

    // Add to container handler
    $('#main-parts').on('click', '.add-to-container', function () {
      addPartsToContainer([$(this).attr('data-part-number')]);
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
