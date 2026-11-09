/**
 * New Sets - Wishlist Module
 * Handles wishlist display and management
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Reload wishlist from API
   * @returns {jQuery} Promise
   */
  function reloadWishlist() {
    return BrickTools.api('GET', '/wishlist')
      .done(function(entries) {
        BrickTools.NewSetsShared.setWishlist(entries || []);
        BrickTools.NewSetsCatalogue.indexWishlist();
        BrickTools.NewSetsShared.renderThemeFilters();
        BrickTools.NewSetsCatalogue.renderSets(true);
        renderWishlistFilterOptions();
        renderWishlist();
      })
      .fail(function(xhr) { BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr)); });
  }

  /**
   * Render the wishlist table
   */
  function renderWishlist() {
    const wishlist = BrickTools.NewSetsShared.getWishlist();
    const wishlistBySet = BrickTools.NewSetsShared.getWishlistBySet();
    const fmt = BrickTools.fmt;
    const sortKey = BrickTools.NewSetsShared.getWishlistSortKey();
    const sortDir = BrickTools.NewSetsShared.getWishlistSortDir();
    
    // Get filter values
    const nameFilter = BrickTools.NewSetsShared.textValue('#wl-name').toLowerCase();
    const themeFilter = BrickTools.NewSetsShared.textValue('#wl-theme');
    const memberFilter = BrickTools.NewSetsShared.textValue('#wl-member-filter');
    const priorityFilter = BrickTools.NewSetsShared.textValue('#wl-priority-filter');
    const priceMin = BrickTools.NewSetsShared.numberValue('#wl-price-min');
    const priceMax = BrickTools.NewSetsShared.numberValue('#wl-price-max');
    
    // Filter wishlist
    let filtered = wishlist.filter(function(entry) {
      // Name filter
      if (nameFilter) {
        const name = (entry.name || '').toLowerCase();
        const setNumber = (entry.setNumber || '').toLowerCase();
        if (!name.includes(nameFilter) && !setNumber.includes(nameFilter)) {
          return false;
        }
      }
      // Theme filter
      if (themeFilter && entry.theme !== themeFilter) {
        return false;
      }
      // Member filter
      if (memberFilter && entry.member !== memberFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter && entry.priority !== priorityFilter) {
        return false;
      }
      // Price filter
      if (entry.officialPrice != null) {
        if (priceMin != null && entry.officialPrice < priceMin) {
          return false;
        }
        if (priceMax != null && entry.officialPrice > priceMax) {
          return false;
        }
      }
      return true;
    });
    
    const $tbody = $('#wishlist tbody').empty();
    if (filtered.length === 0) {
      $tbody.append('<tr><td colspan="12" class="muted">No sets match the filters.</td></tr>');
      return;
    }

    // Sort wishlist
    const sorted = filtered.slice().sort(function(a, b) {
      const key = sortKey;
      const x = a[key] == null ? '' : a[key];
      const y = b[key] == null ? '' : b[key];
      if (x === '' && y === '') return 0;
      if (x === '') return 1;
      if (y === '') return -1;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * sortDir;
    });

    // Update sort indicators
    $('#wishlist thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + sortKey + '"]')
      .addClass(sortDir > 0 ? 'sort-asc' : 'sort-desc');

    sorted.forEach(function(entry) {
      const $tr = $('<tr></tr>');
      
      // Image column
      const $imageTd = $('<td></td>');
      if (entry.imageUrl) {
        $imageTd.append($('<img class="set-img" alt="" loading="lazy">').attr('src', entry.imageUrl));
      }
      $tr.append($imageTd);
      
      // Set number
      $tr.append($('<td></td>').text(entry.setNumber || ''));
      
      // Set name
      $tr.append($('<td></td>').text(entry.name || ''));
      
      // Year
      $tr.append($('<td></td>').text(entry.year || ''));
      
      // Total parts
      $tr.append($('<td></td>').text(entry.numParts == null ? '' : fmt.number(entry.numParts)));
      
      // Theme
      $tr.append($('<td></td>').text(entry.theme || ''));
      
      // Official Price
      $tr.append($('<td></td>').text(entry.officialPrice == null ? '' : fmt.money(entry.officialPrice)));
      
      // Member (with image)
      const memberFilter = BrickTools.NewSetsShared.textValue('#wl-member-filter');
      const showMember = !memberFilter || entry.member === memberFilter;
      if (showMember && entry.member) {
        const memberImageUrl = entry.memberImageUrl;
        const memberColor = entry.memberColor;
        const $memberTd = $('<td></td>');
        if (memberImageUrl) {
          const $image = $('<img loading="lazy">')
            .addClass('person-img')
            .attr('src', memberImageUrl)
            .attr('alt', entry.member)
            .attr('title', entry.member);
          if (memberColor) {
            $image.css('border-color', memberColor);
          }
          $memberTd.append($image);
        } else {
          const $tag = BrickTools.tag(entry.member);
          if (memberColor && $tag) {
            $tag.css('border', '2px solid ' + memberColor);
          }
          $memberTd.append($tag);
        }
        $tr.append($memberTd);
      } else {
        $tr.append($('<td></td>'));
      }
      
      // Buyer (with image)
      if (entry.buyer) {
        const buyerImageUrl = entry.buyerImageUrl;
        const buyerColor = entry.buyerColor;
        const $buyerTd = $('<td></td>');
        if (buyerImageUrl) {
          const $image = $('<img loading="lazy">')
            .addClass('person-img')
            .attr('src', buyerImageUrl)
            .attr('alt', entry.buyer)
            .attr('title', entry.buyer);
          if (buyerColor) {
            $image.css('border-color', buyerColor);
          }
          $buyerTd.append($image);
        } else {
          const $tag = BrickTools.tag(entry.buyer);
          if (buyerColor && $tag) {
            $tag.css('border', '2px solid ' + buyerColor);
          }
          $buyerTd.append($tag);
        }
        $tr.append($buyerTd);
      } else {
        $tr.append($('<td></td>'));
      }
      
      // Priority
      $tr.append($('<td></td>').text(entry.priority || ''));
      
      // Date
      $tr.append($('<td></td>').text(entry.wishlistDate || ''));
      
      // Action buttons
      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary wishlist-open">Open</button>')
        .attr('data-set-number', entry.setNumber)
        .attr('title', 'Open set ' + (entry.setNumber || '') + ' on external websites'));
      $actions.append($('<button type="button" class="btn secondary wishlist-buy">Buy</button>')
        .attr('data-wishlist-id', entry.id)
        .attr('title', 'Buy this set'));
      $actions.append($('<button type="button" class="btn secondary wishlist-edit">Edit</button>')
        .attr('data-wishlist-id', entry.id));
      $actions.append($('<button type="button" class="btn secondary wishlist-delete">Delete</button>')
        .attr('data-wishlist-id', entry.id));
      $tr.append($actions);
      
      $tbody.append($tr);
    });

    $('#wl-summary').text(filtered.length + ' of ' + wishlist.length + ' set(s) in wishlist');
  }

  /**
   * Render wishlist filter dropdowns (member and priority)
   */
  function renderWishlistFilterOptions() {
    const options = BrickTools.NewSetsShared.getOptions();
    if (options.members && options.members.length > 0) {
      BrickTools.NewSetsShared.fillSelect('#wl-member-filter', options.members, true);
    }
    if (options.priorities && options.priorities.length > 0) {
      BrickTools.NewSetsShared.fillSelect('#wl-priority-filter', options.priorities, true);
    }
  }

  /**
   * Find a set in the catalogue by set number
   * @param {string} setNumber - Set number to find
   * @returns {Object|null} Set object or null
   */
  function findSet(setNumber) {
    const catalog = BrickTools.NewSetsShared.getCatalog();
    return catalog.sets.find(function(s) {
      return String(s.setNumber) === String(setNumber);
    }) || null;
  }

  /**
   * Find a wishlist entry by ID
   * @param {string} id - Entry ID
   * @returns {Object|null} Wishlist entry or null
   */
  function findWishlistEntry(id) {
    const wishlist = BrickTools.NewSetsShared.getWishlist();
    return wishlist.find(function(entry) {
      return String(entry.id) === String(id);
    }) || null;
  }

  /**
   * Open the wishlist form for editing or adding
   * @param {Object|null} entry - Wishlist entry or null for new
   * @param {Object|null} set - Set object (optional, for context)
   */
  function openWishlistForm(entry, set) {
    const options = BrickTools.NewSetsShared.getOptions();
    $('#wishlist-form-msg').text('');
    $('#wishlist-id').val(entry ? entry.id : '');
    $('#wishlist-title').text(entry ? 'Edit wishlist entry' : 'Add to wishlist');
    $('#wishlist-set-number').val(entry ? entry.setNumber : (set ? set.setNumber : ''));
    $('#wishlist-date').val(entry ? entry.wishlistDate : BrickTools.NewSetsShared.today());
    BrickTools.NewSetsShared.fillSelect('#wishlist-member', options.members, false);
    BrickTools.NewSetsShared.fillSelect('#wishlist-priority', options.priorities, false);
    BrickTools.NewSetsShared.fillSelect('#wishlist-buyer', options.members, false);
    if (entry) {
      $('#wishlist-member').val(entry.member || '');
      $('#wishlist-priority').val(entry.priority || '');
      $('#wishlist-buyer').val(entry.buyer || '');
    } else if (set) {
      $('#wishlist-member').val(BrickTools.getCookie('wishlistMember'));
      $('#wishlist-priority').val(BrickTools.getCookie('wishlistPriority'));
      $('#wishlist-buyer').val(BrickTools.getCookie('wishlistBuyer'));
    } else {
      $('#wishlist-member').val(BrickTools.getCookie('wishlistMember'));
      $('#wishlist-priority').val(BrickTools.getCookie('wishlistPriority'));
      $('#wishlist-buyer').val(BrickTools.getCookie('wishlistBuyer'));
    }
    $('#wishlist-modal').prop('hidden', false);
    $('#wishlist-set-number').trigger('focus');
  }

  /**
   * Close the wishlist form
   */
  function closeWishlistForm() {
    $('#wishlist-modal').prop('hidden', true);
  }

  /**
   * Buy a wishlist entry
   * @param {Object} entry - Wishlist entry
   * @param {jQuery} $button - Button element that triggered the action
   */
  function buyWishlistEntry(entry, $button) {
    const set = findSet(entry.setNumber);
    const label = entry.name || entry.setNumber || (set ? set.name || set.setNumber : 'this set');
    const price = entry.price != null ? entry.price : (set ? set.officialPrice : null);
    const priceText = price == null ? 'no official price' : BrickTools.fmt.money(price);
    const message = 'Buy ' + label + ' (' + priceText + ')?\n\n'
      + 'This records the purchase and removes the set from the wishlist.';
    if (!window.confirm(message)) {
      return;
    }
    $button.prop('disabled', true);
    BrickTools.api('POST', '/purchases', {
      setNumber: entry.setNumber,
      purchasePrice: price,
      purchaseDate: BrickTools.NewSetsShared.today(),
      vendor: '',
      broughtBy: '',
      owner: entry.member || '',
      partMissings: 0,
      owned: true,
      reason: ''
    }).done(function() {
      const redirect = function() { window.location.href = 'purchases.html#list'; };
      if (entry.id == null) {
        redirect();
        return;
      }
      BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
        .always(redirect);
    }).fail(function(xhr) {
      $button.prop('disabled', false);
      BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr));
    });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the wishlist module
   */
  function init() {
    // Wishlist filter
    $('#wl-name').on('input', renderWishlist);
    $('#wl-member-filter').on('change', renderWishlist);
    $('#wl-theme').on('change', renderWishlist);
    $('#wl-priority-filter').on('change', renderWishlist);
    $('#wl-price-min').on('input', renderWishlist);
    $('#wl-price-max').on('input', renderWishlist);
    $('#wl-reset').on('click', function() {
      $('#wl-name').val('');
      $('#wl-theme').val('');
      $('#wl-member-filter').val('');
      $('#wl-priority-filter').val('');
      $('#wl-price-min').val('');
      $('#wl-price-max').val('');
      renderWishlist();
    });

    // Wishlist table sort
    $('#wishlist thead').on('click', 'th[data-key]', function() {
      const key = $(this).attr('data-key');
      const sortDir = BrickTools.NewSetsShared.getWishlistSortKey() === key 
        ? -BrickTools.NewSetsShared.getWishlistSortDir() 
        : 1;
      BrickTools.NewSetsShared.setWishlistSortKey(key);
      BrickTools.NewSetsShared.setWishlistSortDir(sortDir);
      renderWishlist();
    });

    // Add to wishlist button
    $('#wishlist-add').on('click', function() {
      openWishlistForm(null, null);
    });

    // Cancel button
    $('#wishlist-cancel').on('click', closeWishlistForm);

    // Form submission
    $('#wishlist-form').on('submit', function(event) {
      event.preventDefault();
      const id = $('#wishlist-id').val();
      const body = {
        setNumber: $.trim($('#wishlist-set-number').val()),
        wishlistDate: $.trim($('#wishlist-date').val()),
        member: $('#wishlist-member').val() || '',
        priority: $('#wishlist-priority').val() || '',
        buyer: $('#wishlist-buyer').val() || ''
      };
      const request = id
        ? BrickTools.api('PUT', '/wishlist/' + encodeURIComponent(id), body)
        : BrickTools.api('POST', '/wishlist', body);
      request
        .done(function() {
          BrickTools.setCookie('wishlistMember', body.member);
          BrickTools.setCookie('wishlistPriority', body.priority);
          BrickTools.setCookie('wishlistBuyer', body.buyer);
          closeWishlistForm();
          reloadWishlist();
        })
        .fail(function(xhr) { BrickTools.NewSetsShared.report('#wishlist-form-msg', BrickTools.errorOf(xhr)); });
    });

    // Wishlist row actions
    $('#wishlist tbody').on('click', '.wishlist-open', function() {
      const setNumber = $(this).attr('data-set-number');
      const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
      BrickSets.openSetSites(setNumber, entry || findSet(setNumber));
    });

    $('#wishlist tbody').on('click', '.wishlist-buy', function() {
      const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
      if (entry) {
        buyWishlistEntry(entry, $(this));
      }
    });

    $('#wishlist tbody').on('click', '.wishlist-edit', function() {
      const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
      if (entry) {
        openWishlistForm(entry, findSet(entry.setNumber));
      }
    });

    $('#wishlist tbody').on('click', '.wishlist-delete', function() {
      const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
      if (!entry || !window.confirm('Delete ' + (entry.name || entry.setNumber) + ' from the wishlist?')) {
        return;
      }
      BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
        .done(reloadWishlist)
        .fail(function(xhr) { BrickTools.NewSetsShared.report('#newsets-msg', BrickTools.errorOf(xhr)); });
    });

    // Listen for wishlist changes from other modules
    $(document).on('bricktools:wishlist-changed', reloadWishlist);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.NewSetsWishlist = {
    init: init,
    reloadWishlist: reloadWishlist,
    renderWishlist: renderWishlist,
    findSet: findSet,
    findWishlistEntry: findWishlistEntry,
    openWishlistForm: openWishlistForm,
    closeWishlistForm: closeWishlistForm,
    buyWishlistEntry: buyWishlistEntry
  };
})();
