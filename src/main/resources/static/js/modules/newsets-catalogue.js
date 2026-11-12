/**
 * New Sets - Catalogue Module
 * Handles catalogue loading, filtering, and set card rendering
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Index wishlist entries by set number for quick lookup
   */
  function indexWishlist() {
    const wishlist = BrickTools.NewSetsShared.getWishlist();
    const wishlistBySet = new Map();
    wishlist.forEach(function(entry) {
      entry.priorityRank = BrickTools.NewSetsShared.PRIORITY_RANK[entry.priority] || 99;
      wishlistBySet.set(entry.setNumber, entry);
    });
    BrickTools.NewSetsShared.setWishlistBySet(wishlistBySet);
  }

  /**
   * Render the year selector dropdown
   */
  function renderYearSelector() {
    const $select = $('#newsets-year-value');
    const selectedYear = BrickTools.NewSetsShared.getSelectedYear();
    const firstYear = Math.max(new Date().getFullYear(), selectedYear);
    $select.empty();
    for (let year = firstYear; year >= 1970; year--) {
      $select.append($('<option></option>').val(year).text(year));
    }
    $select.val(String(selectedYear));
  }

  /**
   * Render theme filter dropdowns
   */
  function renderThemeFilters() {
    const names = BrickTools.NewSetsShared.themeNames(false);
    const selectedTheme = BrickTools.NewSetsShared.textValue('#ns-theme');
    if (selectedTheme && names.indexOf(selectedTheme) === -1) {
      names.push(selectedTheme);
      names.sort(function(a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    }
    BrickTools.NewSetsShared.fillSelect('#ns-theme', names, true);
    BrickTools.NewSetsShared.fillSelect('#wl-theme', BrickTools.NewSetsShared.themeNames(true), true);
  }

  /**
   * Render theme cards
   */
  function renderThemes() {
    const $host = $('#theme-cards').empty();
    const grouped = $('#theme-root-group').is(':checked');
    const catalog = BrickTools.NewSetsShared.getCatalog();
    const themes = grouped ? catalog.rootThemes : catalog.themes;
    if (themes.length === 0) {
      $host.append('<p class="muted">No new sets found for this year.</p>');
      return;
    }
    const fragment = document.createDocumentFragment();
    themes.forEach(function(theme) {
      const color = theme.color || '#e5e7eb';
      const $card = $('<button type="button" class="theme-card"></button>')
        .css({ 'background-color': color, color: BrickTools.NewSetsShared.readableText(color) })
        .attr('title', theme.name);
      if (theme.imageUrl) {
        $card.append($('<img loading="lazy">').attr('src', theme.imageUrl).attr('alt', theme.name));
      }
      $card.append($('<span class="theme-card-name"></span>').text(theme.name));
      $card.on('click', function() {
        BrickTools.NewSetsShared.setRootFilter(grouped ? theme.name : '');
        $('#ns-theme').val(grouped ? '' : theme.name);
        BrickTools.NewSetsShared.setForceSetReset(true);
        $('[data-tab="sets"]').trigger('click');
      });
      fragment.appendChild($card[0]);
    });
    $host.append(fragment);
  }

  /**
   * Filter sets based on current filter criteria
   * @returns {Array} Filtered sets
   */
  function filteredSets() {
    const name = BrickTools.NewSetsShared.textValue('#ns-name').toLowerCase();
    const theme = BrickTools.NewSetsShared.textValue('#ns-theme');
    const min = BrickTools.NewSetsShared.numberValue('#ns-price-min');
    const max = BrickTools.NewSetsShared.numberValue('#ns-price-max');
    const showNew = $('#ns-new').is(':checked');
    const showPurchased = $('#ns-purchased').is(':checked');
    const showWishlisted = $('#ns-wishlisted').is(':checked');
    
    const catalog = BrickTools.NewSetsShared.getCatalog();
    const wishlistBySet = BrickTools.NewSetsShared.getWishlistBySet();
    const rootFilter = BrickTools.NewSetsShared.getRootFilter();

    return catalog.sets.filter(function(set) {
      if (name && String(set.name || '').toLowerCase().indexOf(name) === -1) {
        return false;
      }
      if (theme && set.theme !== theme) {
        return false;
      }
      if (rootFilter && set.rootTheme !== rootFilter) {
        return false;
      }
      if (!BrickTools.NewSetsShared.priceMatches(set.officialPrice, min, max)) {
        return false;
      }
      const wishlisted = wishlistBySet.has(set.setNumber);
      const purchased = Boolean(set.purchased);
      const isNew = !wishlisted && !purchased;
      return (isNew && showNew) || (purchased && showPurchased) || (wishlisted && showWishlisted);
    });
  }

  /**
   * Update the set summary display
   */
  function updateSetSummary() {
    const filteredSetRows = BrickTools.NewSetsShared.getFilteredSetRows();
    const renderedSetCount = BrickTools.NewSetsShared.getRenderedSetCount();
    const catalog = BrickTools.NewSetsShared.getCatalog();
    const total = filteredSetRows.length;
    const catalogTotal = catalog.sets.length;
    const label = total === catalogTotal ? 'sets' : (total === 1 ? 'matching set' : 'matching sets');
    const suffix = total === catalogTotal ? '' : ' (' + catalogTotal + ' in catalogue)';
    const root = BrickTools.NewSetsShared.getRootFilter() ? 'Root theme ' + BrickTools.NewSetsShared.getRootFilter() + ': ' : '';
    BrickTools.NewSetsShared.report('#set-summary', root + 'Showing ' + renderedSetCount + ' of ' + total + ' ' + label + suffix);
  }

  /**
   * Update the set loader visibility
   */
  function updateSetLoader() {
    const filteredSetRows = BrickTools.NewSetsShared.getFilteredSetRows();
    const renderedSetCount = BrickTools.NewSetsShared.getRenderedSetCount();
    $('#set-loader').prop('hidden', renderedSetCount >= filteredSetRows.length);
  }

  /**
   * Create a set card element
   * @param {Object} set - Set object
   * @returns {jQuery} Set card jQuery element
   */
  function setCard(set) {
    const wishlistBySet = BrickTools.NewSetsShared.getWishlistBySet();
    const entry = wishlistBySet.get(set.setNumber);
    const fmt = BrickTools.fmt;
    const $card = $('<article class="set-card"></article>').attr('data-set-number', set.setNumber);
    if (set.purchased) {
      $card.addClass('purchased');
    } else if (entry) {
      $card.addClass('wishlisted');
    }

    const $image = $('<div class="set-card-image"></div>');
    if (set.imageUrl) {
      $image.append($('<img loading="lazy">').attr('src', set.imageUrl).attr('alt', set.name || set.setNumber));
    } else {
      $image.append('<span class="set-card-noimg">No image</span>');
    }
    $card.append($image);

    const $body = $('<div class="set-card-body"></div>');
    $body.append($('<h3></h3>').attr('title', set.name || '').text(set.name || set.setNumber));
    $body.append($('<p class="set-card-sub"></p>')
      .text('#' + set.setNumber + (set.year ? ' · ' + set.year : '')));

    const facts = [];
    facts.push(set.numParts == null ? '— parts' : fmt.number(set.numParts) + ' parts');
    facts.push(set.officialPrice == null ? '—' : fmt.money(set.officialPrice));
    const $facts = $('<p class="set-card-facts"></p>').text(facts.join(' · '));
    if (set.officialPrice == null) {
      $facts.append(' ').append(BrickSets.priceButton(set.setNumber, function(result) {
        set.officialPrice = result.legoPrice;
        BrickTools.NewSetsWishlist.reloadWishlist();
      }));
    }
    $body.append($facts);

    const $footer = $('<div class="set-card-footer"></div>');
    $footer.append(BrickTools.NewSetsShared.themeChip(set.theme, set.themeImageUrl, set.themeColor));
    $footer.append($('<button type="button" class="btn wishlist-toggle"></button>')
      .addClass(entry ? 'secondary' : '')
      .attr('data-set-number', set.setNumber)
      .attr('data-set-name', set.name || set.setNumber)
      .html(BrickTools.icon(entry ? 'delete' : 'add') + ' ' +
        (entry ? 'Remove from wishlist' : 'Save to wishlist')));
    $body.append($footer);

    $card.append($body);
    return $card;
  }

  /**
   * Append set cards to the display
   * @param {number} count - Number of cards to append
   */
  function appendSetCards(count) {
    const SET_PAGE_SIZE = BrickTools.NewSetsShared.SET_PAGE_SIZE;
    const filteredSetRows = BrickTools.NewSetsShared.getFilteredSetRows();
    let renderedSetCount = BrickTools.NewSetsShared.getRenderedSetCount();
    const target = Math.min(renderedSetCount + count, filteredSetRows.length);
    if (target <= renderedSetCount) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (let i = renderedSetCount; i < target; i++) {
      fragment.appendChild(setCard(filteredSetRows[i])[0]);
    }
    $('#set-cards').append(fragment);
    renderedSetCount = target;
    BrickTools.NewSetsShared.setRenderedSetCount(renderedSetCount);
    updateSetSummary();
    updateSetLoader();
  }

  /**
   * Load more sets
   */
  function loadMoreSets() {
    appendSetCards(BrickTools.NewSetsShared.SET_PAGE_SIZE);
  }

  /**
   * Render sets with optional preservation of current state
   * @param {boolean} preserve - Whether to preserve current scroll position
   */
  function renderSets(preserve) {
    const target = preserve ? BrickTools.NewSetsShared.getRenderedSetCount() : 0;
    const SET_PAGE_SIZE = BrickTools.NewSetsShared.SET_PAGE_SIZE;
    const filteredSetRows = filteredSets();
    BrickTools.NewSetsShared.setFilteredSetRows(filteredSetRows);
    BrickTools.NewSetsShared.setRenderedSetCount(0);
    $('#set-cards').empty();

    if (filteredSetRows.length === 0) {
      $('#set-cards').append('<p class="muted">No sets match the filters.</p>');
      updateSetSummary();
      updateSetLoader();
      return;
    }

    const forceSetReset = BrickTools.NewSetsShared.getForceSetReset();
    const initialCount = Math.max(0, Math.min(SET_PAGE_SIZE, filteredSetRows.length));
    appendSetCards(preserve && !forceSetReset ? target : initialCount);
    if (forceSetReset) {
      BrickTools.NewSetsShared.setForceSetReset(false);
    }
  }

  /**
   * Load catalogue data from API
   * @returns {jQuery} Promise
   */
  function loadCatalogue() {
    const $controls = $('#newsets-year-prev, #newsets-year-next, #newsets-year-value')
      .prop('disabled', true);
    renderYearSelector();
    return BrickTools.api('GET', BrickTools.NewSetsShared.catalogueUrl())
      .done(function(response) {
        const catalog = BrickTools.NewSetsShared.applyDefaultExclusions(response || BrickTools.NewSetsShared.getCatalog());
        BrickTools.NewSetsShared.setCatalog(catalog);
        renderThemeFilters();
        renderThemes();
        renderSets();
        BrickTools.NewSetsShared.report('#newsets-msg', '');
      })
      .fail(function(xhr) { BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr)); })
      .always(function() { $controls.prop('disabled', false); });
  }

  /**
   * Load all data (catalogue, wishlist, options)
   * @returns {jQuery} Promise
   */
  function loadAll() {
    return $.when(
      BrickTools.api('GET', BrickTools.NewSetsShared.catalogueUrl()),
      BrickTools.api('GET', '/wishlist'),
      BrickTools.api('GET', '/wishlist/options')
    ).done(function(catalogResponse, wishlistResponse, optionsResponse) {
      const catalog = BrickTools.NewSetsShared.applyDefaultExclusions(catalogResponse[0] || BrickTools.NewSetsShared.getCatalog());
      BrickTools.NewSetsShared.setCatalog(catalog);
      BrickTools.NewSetsShared.setWishlist(wishlistResponse[0] || []);
      BrickTools.NewSetsShared.setOptions(optionsResponse[0] || BrickTools.NewSetsShared.getOptions());
      indexWishlist();
      renderYearSelector();
      renderThemeFilters();
      renderThemes();
      renderSets();
      BrickTools.NewSetsWishlist.renderWishlistFilterOptions();
      BrickTools.NewSetsWishlist.renderWishlist();
      BrickTools.NewSetsShared.report('#newsets-msg', '');
    }).fail(function(xhr) {
      BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr));
    });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the catalogue module
   */
  function init() {
    // Set up IntersectionObserver for infinite scroll
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            loadMoreSets();
          }
        });
      }, { threshold: 0.1 });
      BrickTools.NewSetsShared.setSetObserver(observer);
    }

    // Set up year navigation
    $('#newsets-year-prev').on('click', function() {
      const current = BrickTools.NewSetsShared.getSelectedYear();
      BrickTools.NewSetsShared.setSelectedYear(current - 1);
      loadCatalogue();
    });

    $('#newsets-year-next').on('click', function() {
      const current = BrickTools.NewSetsShared.getSelectedYear();
      BrickTools.NewSetsShared.setSelectedYear(current + 1);
      loadCatalogue();
    });

    $('#newsets-year-value').on('change', function() {
      const year = parseInt($(this).val(), 10);
      if (!isNaN(year)) {
        BrickTools.NewSetsShared.setSelectedYear(year);
        loadCatalogue();
      }
    });

    // Set up set filters
    $('#ns-name, #ns-theme, #ns-price-min, #ns-price-max').on('input', function() {
      renderSets();
    });
    $('#ns-new, #ns-purchased, #ns-wishlisted').on('change', function() {
      renderSets();
    });

    // Set up reset filters button
    $('#ns-reset').on('click', function() {
      $('#ns-name').val('');
      $('#ns-theme').val('');
      $('#ns-price-min').val('');
      $('#ns-price-max').val('');
      $('#ns-new').prop('checked', true);
      $('#ns-purchased').prop('checked', true);
      $('#ns-wishlisted').prop('checked', true);
      BrickTools.NewSetsShared.setForceSetReset(true);
      renderSets();
    });

    $('#theme-root-group').on('change', function() {
      BrickTools.NewSetsShared.setRootFilter('');
      renderThemes();
      renderSets();
    });

    // Set card click handler - open set modal
    $('#set-cards').on('click', '.set-card', function() {
      const setNumber = $(this).attr('data-set-number');
      const catalog = BrickTools.NewSetsShared.getCatalog();
      const set = catalog.sets.find(function(s) {
        return String(s.setNumber) === String(setNumber);
      }) || null;
      BrickSets.openSetSites(setNumber, set);
    });

    // Wishlist toggle buttons
    $('#set-cards').on('click', '.wishlist-toggle', function(e) {
      // Stop propagation to prevent set-card click handler from firing
      e.stopPropagation();
      const $button = $(this);
      const setNumber = $button.attr('data-set-number');
      const setName = $button.attr('data-set-name');
      const wishlistBySet = BrickTools.NewSetsShared.getWishlistBySet();
      const entry = wishlistBySet.get(setNumber);
      
      if (entry) {
        // Remove from wishlist
        BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
          .done(function() {
            wishlistBySet.delete(setNumber);
            $button.removeClass('secondary').html(BrickTools.icon('add') + ' Save to wishlist');
            renderSets();
            BrickTools.NewSetsWishlist.renderWishlist();
          })
          .fail(function(xhr) { BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr)); });
      } else {
        // Add to wishlist
        BrickTools.api('POST', '/wishlist', {
          setNumber: setNumber,
          wishlistDate: BrickTools.NewSetsShared.today(),
          member: '',
          priority: 'Medium',
          buyer: ''
        })
          .done(function(newEntry) {
            wishlistBySet.set(setNumber, newEntry);
            $button.addClass('secondary').html(BrickTools.icon('delete') + ' Remove from wishlist');
            renderSets();
            BrickTools.NewSetsWishlist.renderWishlist();
          })
          .fail(function(xhr) { BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr)); });
      }
    });

    // Observe the loader element for infinite scroll
    const observer = BrickTools.NewSetsShared.getSetObserver();
    if (observer) {
      observer.observe(document.getElementById('set-loader'));
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.NewSetsCatalogue = {
    init: init,
    indexWishlist: indexWishlist,
    renderYearSelector: renderYearSelector,
    renderThemeFilters: renderThemeFilters,
    renderThemes: renderThemes,
    filteredSets: filteredSets,
    updateSetSummary: updateSetSummary,
    updateSetLoader: updateSetLoader,
    setCard: setCard,
    appendSetCards: appendSetCards,
    loadMoreSets: loadMoreSets,
    renderSets: renderSets,
    loadCatalogue: loadCatalogue,
    loadAll: loadAll
  };
})();
