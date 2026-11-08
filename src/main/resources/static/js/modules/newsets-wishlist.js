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
    
    const $tbody = $('#wishlist tbody').empty();
    if (wishlist.length === 0) {
      $tbody.append('<tr><td colspan="8" class="muted">No sets in wishlist yet.</td></tr>');
      return;
    }

    // Sort wishlist
    const sorted = wishlist.slice().sort(function(a, b) {
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
      
      // Set number
      $tr.append($('<td></td>').text(entry.setNumber || ''));
      
      // Set name
      $tr.append($('<td></td>').text(entry.name || ''));
      
      // Theme
      $tr.append($('<td></td>').text(entry.theme || ''));
      
      // Date
      $tr.append($('<td></td>').text(entry.wishlistDate || ''));
      
      // Member
      const member = BrickTools.NewSetsShared.textValue('#wl-member');
      const showMember = !member || entry.member === member;
      $tr.append($('<td></td>').text(showMember ? (entry.member || '') : ''));
      
      // Priority
      $tr.append($('<td></td>').text(entry.priority || ''));
      
      // Buyer
      $tr.append($('<td></td>').text(entry.buyer || ''));
      
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

    $('#wl-summary').text(wishlist.length + ' set(s) in wishlist');
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
    $('#wl-member').on('change', renderWishlist);
    $('#wl-theme').on('change', renderWishlist);
    $('#wl-priority').on('change', renderWishlist);

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
