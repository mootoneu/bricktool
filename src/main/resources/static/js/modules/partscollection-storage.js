/**
 * Parts Collection - Part Storage Module
 * Handles the Part storage tab, the Storage drawers tab, and the Collection search tab.
 */
(function () {
  'use strict';

  let storages = [];
  let storagesLoading = false;
  let storagesLoaded = false;
  let storageCallbacks = [];
  let storageSort = { key: 'id', dir: 1 };
  let storageFilter = '';

  let drawerCards = [];
  let drawersLoading = false;
  let drawersLoaded = false;
  let drawersFilter = '';

  let collectionRequest = 0;
  let collectionTimer = null;
  let collectionCards = [];

  // ============================================================================
  // Public API
  // ============================================================================

  function isStoragesLoaded() {
    return storagesLoaded;
  }

  function isDrawersLoaded() {
    return drawersLoaded;
  }

  function loadStorages(callback) {
    if (typeof callback === 'function') {
      storageCallbacks.push(callback);
    }
    if (storagesLoading) {
      return;
    }
    storagesLoading = true;
    BrickTools.PartsCollectionShared.report('#storage-msg', 'Loading part storages…');
    BrickTools.api('GET', '/part-storage')
      .done(function (list) {
        storages = Array.isArray(list) ? list : [];
        storagesLoaded = true;
        renderStorages();
        populateStorageSelect();
        BrickTools.PartsCollectionShared.report('#storage-msg',
          storages.length === 0 ? 'No part storage stored yet.' : '');
      })
      .fail(function (xhr) {
        storages = [];
        storagesLoaded = true;
        renderStorages();
        populateStorageSelect();
        BrickTools.PartsCollectionShared.report('#storage-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        storagesLoading = false;
        const callbacks = storageCallbacks;
        storageCallbacks = [];
        callbacks.forEach(function (fn) {
          try {
            fn();
          } catch (error) {
            // A failing callback must not prevent the others from running.
          }
        });
      });
  }

  function loadDrawers(callback) {
    if (drawersLoading) {
      return;
    }
    drawersLoading = true;
    BrickTools.PartsCollectionShared.report('#drawers-msg', 'Loading drawers…');
    BrickTools.api('GET', '/part-collection/drawers')
      .done(function (list) {
        drawerCards = Array.isArray(list) ? list : [];
        drawersLoaded = true;
        renderDrawers();
        syncActiveDrawerList();
        BrickTools.PartsCollectionShared.report('#drawers-msg',
          drawerCards.length === 0 ? 'No drawer yet. Add a part storage first.' : '');
      })
      .fail(function (xhr) {
        drawerCards = [];
        renderDrawers();
        BrickTools.PartsCollectionShared.report('#drawers-msg', BrickTools.errorOf(xhr));
      })
      .always(function () {
        drawersLoading = false;
        if (typeof callback === 'function') {
          callback();
        }
      });
  }

  function getDrawerCards() {
    return drawerCards;
  }

  // ============================================================================
  // Storages
  // ============================================================================

  function renderStorages() {
    const fmt = BrickTools.fmt;
    const $tbody = $('#part-storage tbody').empty();
    const filter = storageFilter.trim().toLowerCase();
    const active = BrickTools.getActiveContainer();
    const filtered = storages.filter(function (storage) {
      if (!filter) {
        return true;
      }
      return [storage.id, storage.model, storage.location, storage.description]
        .some(function (value) {
          return String(value || '').toLowerCase().indexOf(filter) !== -1;
        });
    });
    const visible = BrickTools.PartsCollectionShared.sortRows(filtered, storageSort);
    BrickTools.PartsCollectionShared.markSortedHeader('#part-storage', storageSort);
    $('#storage-count').text(storages.length === 0 ? '' :
      fmt.number(visible.length) + ' of ' + fmt.number(storages.length) + ' storage(s)');

    if (visible.length === 0) {
      $tbody.append('<tr><td colspan="7" class="muted">' +
        (storages.length === 0 ? 'No part storage yet.' : 'No storage matches the filter.') +
        '</td></tr>');
      return;
    }

    visible.forEach(function (storage) {
      const isActive = active && active.type === 'storage'
        && String(active.storageId) === String(storage.id);
      const $row = $('<tr></tr>').toggleClass('selected', Boolean(isActive));
      $row.append($('<td></td>').text(storage.id || ''));
      $row.append($('<td></td>').text(storage.model || ''));
      $row.append($('<td></td>').text(fmt.number(storage.drawersCount || 0)));
      $row.append($('<td></td>').text(storage.location || ''));
      $row.append($('<td></td>').text(storage.description || ''));
      $row.append($('<td></td>').text(fmt.number(storage.rowCount || 0)));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn secondary storage-edit">Edit</button>')
        .attr('data-storage-id', storage.id));
      $actions.append($('<button type="button" class="btn secondary storage-set-active">Set active</button>')
        .attr('data-storage-id', storage.id));
      $row.append($actions);
      $tbody.append($row);
    });
  }

  function findStorage(id) {
    return storages.find(function (storage) {
      return String(storage.id) === String(id);
    });
  }

  function openStorageForm(storage) {
    $('#storage-form-msg').text('');
    $('#storage-original-id').val(storage ? storage.id : '');
    $('#storage-title').text(storage ? 'Edit part storage' : 'Add part storage');
    $('#storage-id').val(storage ? storage.id : '').prop('readonly', Boolean(storage));
    $('#storage-model').val(storage ? storage.model : '');
    $('#storage-drawers').val(storage && storage.drawersCount != null ? storage.drawersCount : 0);
    $('#storage-location').val(storage ? storage.location : '');
    $('#storage-description').val(storage ? storage.description : '');
    $('#storage-modal').prop('hidden', false);
    (storage ? $('#storage-model') : $('#storage-id')).trigger('focus');
  }

  function closeStorageForm() {
    $('#storage-modal').prop('hidden', true);
  }

  function setActiveStorage(storage) {
    BrickTools.setActiveContainer({
      type: 'storage',
      storageId: storage.id,
      storageModel: storage.model,
      storageLocation: storage.location
    });
    renderStorages();
    BrickTools.PartsCollectionShared.report('#storage-msg',
      'Active container set to storage ' + storage.id + '.');
  }

  // ============================================================================
  // Drawers
  // ============================================================================

  function renderDrawers() {
    const filter = drawersFilter.trim().toLowerCase();
    const cards = drawerCards.filter(function (card) {
      if (!filter) {
        return true;
      }
      return [card.storageId, card.storageModel, card.storageLocation, card.drawer]
        .some(function (value) {
          return String(value || '').toLowerCase().indexOf(filter) !== -1;
        });
    });
    $('#drawers-count').text(drawerCards.length === 0 ? '' :
      BrickTools.fmt.number(cards.length) + ' of ' + BrickTools.fmt.number(drawerCards.length)
        + ' drawer(s)');
    renderDrawerCards($('#drawer-cards'), cards, false);
    if (cards.length === 0 && drawerCards.length > 0) {
      BrickTools.PartsCollectionShared.report('#drawers-msg', 'No drawer matches the filter.');
    }
  }

  function renderDrawerCards($host, cards, searching) {
    $host.empty();
    if (cards.length === 0) {
      return;
    }
    const active = BrickTools.getActiveContainer();
    cards.forEach(function (card) {
      const isActive = active && active.type === 'drawer'
        && String(active.storageId) === String(card.storageId)
        && String(active.drawer) === String(card.drawer);
      const $card = $('<article class="drawer-card"></article>').toggleClass('active', Boolean(isActive));

      const $head = $('<div class="drawer-card-head"></div>');
      const $titles = $('<div></div>');
      $titles.append($('<h3 class="drawer-card-title"></h3>').text(
        'Storage ' + (card.storageId || '') + ' · Drawer ' + (card.drawer || '—')));
      const sub = [card.storageModel, card.storageLocation].filter(Boolean).join(' · ');
      if (sub) {
        $titles.append($('<p class="drawer-card-sub"></p>').text(sub));
      }
      $head.append($titles);

      const $actions = $('<div class="drawer-card-actions"></div>');
      $actions.append($('<button type="button" class="btn secondary drawer-add-content">Add content</button>')
        .attr('data-storage-id', card.storageId)
        .attr('data-drawer', card.drawer));
      $actions.append($('<button type="button" class="btn secondary drawer-set-active">Set active</button>')
        .attr('data-storage-id', card.storageId)
        .attr('data-drawer', card.drawer));
      $head.append($actions);
      $card.append($head);

      const $content = $('<div class="drawer-content"></div>');
      const rows = Array.isArray(card.rows) ? card.rows : [];
      if (rows.length === 0) {
        $content.append($('<p class="drawer-empty"></p>').text('No content rule for this drawer.'));
      }
      rows.forEach(function (row) {
        $content.append(drawerRule(row, card));
      });
      $card.append($content);

      const matched = Array.isArray(card.matchedParts) ? card.matchedParts : [];
      if (searching && matched.length > 0) {
        const $matched = $('<div class="drawer-content"></div>');
        $matched.append($('<p class="drawer-card-sub"></p>').text(
          matched.length + ' matching part(s)'));
        $matched.append(drawerPartList(matched));
        $card.append($matched);
      }
      $host.append($card);
    });
  }

  function drawerRule(row, card) {
    const $rule = $('<div class="drawer-rule"></div>');
    const $head = $('<div class="drawer-rule-head"></div>');
    $head.append($('<span class="drawer-amount"></span>').text('Amount: ' + (row.amount || '—')));
    const $actions = $('<div class="drawer-rule-actions"></div>');
    $actions.append($('<button type="button" class="btn secondary drawer-rule-edit">Edit</button>')
      .attr('data-index', row.index)
      .attr('data-storage-id', card.storageId)
      .attr('data-drawer', card.drawer));
    $actions.append($('<button type="button" class="btn danger drawer-rule-delete">Delete</button>')
      .attr('data-index', row.index));
    $head.append($actions);
    $rule.append($head);

    const partChips = Array.isArray(row.partChips) ? row.partChips : [];
    if (partChips.length > 0) {
      $rule.append(drawerPartList(partChips));
    }

    const $chips = $('<div class="drawer-chips"></div>');
    (row.categoryChips || []).forEach(function (category) {
      $chips.append($('<span class="drawer-chip category"></span>').text('§ ' + (category.name || category.value)));
    });
    (row.tagChips || []).forEach(function (tag) {
      $chips.append($('<span class="drawer-chip tag"></span>').text('#' + tag));
    });
    (row.colorChips || []).forEach(function (color) {
      const $chip = $('<span class="drawer-chip"></span>').text(color.name || '');
      if (color.keyword) {
        $chip.addClass('keyword');
      } else {
        const hex = BrickTools.PartsCollectionShared.colorHex({ rgb: color.rgb });
        if (hex) {
          $chip.css({
            'background-color': hex,
            color: BrickTools.PartsCollectionShared.readableTextColor(hex)
          });
        }
      }
      $chips.append($chip);
    });
    if ($chips.children().length > 0) {
      $rule.append($chips);
    }
    return $rule;
  }

  function drawerPartList(parts) {
    const $list = $('<div class="drawer-parts"></div>');
    parts.forEach(function (part) {
      const $item = $('<span class="drawer-part"></span>');
      const colorId = part.colorId == null || part.colorId === '' ? '' : part.colorId;
      const src = '/api/parts/' + encodeURIComponent(part.partNumber) + '/image'
        + (colorId === '' ? '' : '?colorId=' + encodeURIComponent(colorId));
      $item.append($('<img class="part-img" loading="lazy" alt="">')
        .attr('src', src)
        .attr('alt', part.name || part.partNumber)
        .attr('title', part.name || part.partNumber)
        .attr('data-part-number', part.partNumber)
        .attr('tabindex', '0')
        .attr('role', 'button')
        .attr('aria-label', 'Part information for ' + (part.name || part.partNumber))
        .on('error', function () { $(this).prop('hidden', true); }));
      $item.append($('<span class="drawer-part-name"></span>').text(part.name || part.partNumber));
      $list.append($item);
    });
    return $list;
  }

  function findDrawer(storageId, drawer) {
    return drawerCards.concat(collectionCards).find(function (card) {
      return String(card.storageId) === String(storageId)
        && String(card.drawer) === String(drawer);
    });
  }

  function drawerList() {
    return drawerCards.map(function (card) {
      return {
        storageId: card.storageId,
        storageModel: card.storageModel,
        storageLocation: card.storageLocation,
        drawer: card.drawer
      };
    });
  }

  function setActiveDrawer(card) {
    BrickTools.setActiveContainer({
      type: 'drawer',
      storageId: card.storageId,
      storageModel: card.storageModel,
      storageLocation: card.storageLocation,
      drawer: card.drawer,
      drawers: drawerList()
    });
    renderDrawers();
    if (!drawersLoaded && !drawersLoading) {
      // The header navigation needs the full drawer list of the storage.
      loadDrawers();
    }
    BrickTools.PartsCollectionShared.report('#drawers-msg',
      'Active container set to storage ' + card.storageId + ', drawer ' + (card.drawer || '—') + '.');
  }

  function syncActiveDrawerList() {
    const active = BrickTools.getActiveContainer();
    if (!active || active.type !== 'drawer') {
      return;
    }
    const list = drawerList();
    const found = list.some(function (drawer) {
      return String(drawer.storageId) === String(active.storageId)
        && String(drawer.drawer) === String(active.drawer);
    });
    if (found) {
      active.drawers = list;
      BrickTools.setActiveContainer(active);
    }
  }

  // ============================================================================
  // Collection search
  // ============================================================================

  function searchCollection(query) {
    const value = String(query == null ? '' : query).trim();
    const request = ++collectionRequest;
    const $host = $('#collection-drawers').empty();
    collectionCards = [];
    if (!value) {
      $('#collection-count').text('');
      BrickTools.PartsCollectionShared.report('#collection-msg',
        'Type a part number, name, color, or category to find the drawers that contain matching parts.');
      return;
    }
    BrickTools.PartsCollectionShared.report('#collection-msg', 'Searching the part collection…');
    BrickTools.api('GET', '/part-collection/drawers?query=' + encodeURIComponent(value))
      .done(function (list) {
        if (request !== collectionRequest) {
          return;
        }
        const cards = Array.isArray(list) ? list : [];
        collectionCards = cards;
        $('#collection-count').text(BrickTools.fmt.number(cards.length) + ' drawer(s)');
        renderDrawerCards($host, cards, true);
        BrickTools.PartsCollectionShared.report('#collection-msg',
          cards.length === 0 ? 'No drawer contains a part matching "' + value + '".' : '');
      })
      .fail(function (xhr) {
        if (request !== collectionRequest) {
          return;
        }
        $('#collection-count').text('');
        BrickTools.PartsCollectionShared.report('#collection-msg', BrickTools.errorOf(xhr));
      });
  }

  function rerunCollectionSearch() {
    const query = String($('#collection-search').val() || '').trim();
    if (query) {
      searchCollection(query);
    }
  }

  // ============================================================================
  // Drawer content form
  // ============================================================================

  function populateStorageSelect() {
    const $select = $('#collection-rule-storage');
    const current = $select.val();
    $select.empty();
    if (storages.length === 0) {
      $select.append($('<option></option>').attr('value', '').text('No storage'));
      $select.prop('disabled', true);
      return;
    }
    $select.prop('disabled', false);
    storages.forEach(function (storage) {
      const label = storage.model ? storage.id + ' (' + storage.model + ')' : storage.id;
      $select.append($('<option></option>').attr('value', storage.id).text(label));
    });
    if (current && findStorage(current)) {
      $select.val(current);
    }
  }

  function openRuleForm(row, card) {
    if (!storagesLoaded) {
      loadStorages(function () { openRuleForm(row, card); });
      return;
    }
    const storageId = row ? row.storageId : (card ? card.storageId : '');
    const drawer = row ? row.drawer : (card ? card.drawer : '');
    $('#collection-rule-form-msg').text('');
    $('#collection-rule-index').val(row ? row.index : '');
    $('#collection-rule-title').text(row ? 'Edit drawer content' : 'Add drawer content');
    populateStorageSelect();
    $('#collection-rule-storage').val(storageId);
    $('#collection-rule-drawer').val(drawer);
    $('#collection-rule-parts').val(row ? row.parts : '');
    $('#collection-rule-colors').val(row ? row.colors : 'Any');
    $('#collection-rule-amount').val(row ? row.amount : '1');
    $('#collection-rule-modal').prop('hidden', false);
    $('#collection-rule-parts').trigger('focus');
  }

  function closeRuleForm() {
    $('#collection-rule-modal').prop('hidden', true);
  }

  function refreshAfterChange() {
    loadStorages(function () {
      if (drawersLoaded) {
        loadDrawers();
      }
      rerunCollectionSearch();
    });
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    // Storage table
    $('#storage-add').on('click', function () {
      if (!storagesLoaded) {
        loadStorages(function () { openStorageForm(null); });
        return;
      }
      openStorageForm(null);
    });

    $('#storage-filter').on('input', function () {
      storageFilter = this.value;
      renderStorages();
    });

    $('#part-storage thead').on('click', 'th[data-key]', function () {
      BrickTools.PartsCollectionShared.sortBy(storageSort, $(this).attr('data-key'));
      renderStorages();
    });

    $('#part-storage').on('click', '.storage-edit', function () {
      const storage = findStorage($(this).attr('data-storage-id'));
      if (storage) {
        openStorageForm(storage);
      }
    });

    $('#part-storage').on('click', '.storage-set-active', function () {
      const storage = findStorage($(this).attr('data-storage-id'));
      if (storage) {
        setActiveStorage(storage);
      }
    });

    $('#storage-cancel').on('click', closeStorageForm);

    $('#storage-form').on('submit', function (event) {
      event.preventDefault();
      const originalId = String($('#storage-original-id').val() || '');
      const body = {
        id: String($('#storage-id').val() || '').trim(),
        model: String($('#storage-model').val() || '').trim(),
        drawersCount: parseInt($('#storage-drawers').val(), 10),
        location: String($('#storage-location').val() || '').trim(),
        description: String($('#storage-description').val() || '').trim()
      };
      if (isNaN(body.drawersCount)) {
        body.drawersCount = 0;
      }
      const $buttons = $('#storage-form button').prop('disabled', true);
      $('#storage-form-msg').text('Saving…');
      BrickTools.api(originalId ? 'PUT' : 'POST',
          originalId ? '/part-storage/' + encodeURIComponent(originalId) : '/part-storage', body)
        .done(function () {
          closeStorageForm();
          refreshAfterChange();
        })
        .fail(function (xhr) {
          $('#storage-form-msg').text(BrickTools.errorOf(xhr));
        })
        .always(function () {
          $buttons.prop('disabled', false);
        });
    });

    // Drawers
    $('#drawers-filter').on('input', function () {
      drawersFilter = this.value;
      renderDrawers();
    });

    $('#drawer-cards, #collection-drawers').on('click', '.drawer-set-active', function () {
      const card = findDrawer($(this).attr('data-storage-id'), $(this).attr('data-drawer'));
      if (card) {
        setActiveDrawer(card);
        if ($(this).closest('#collection-drawers').length) {
          BrickTools.PartsCollectionShared.report('#collection-msg',
            'Active container set to storage ' + card.storageId
              + ', drawer ' + (card.drawer || '—') + '.');
        }
      }
    });

    $('#drawer-cards, #collection-drawers').on('click', '.drawer-add-content', function () {
      const card = findDrawer($(this).attr('data-storage-id'), $(this).attr('data-drawer'));
      openRuleForm(null, card);
    });

    $('#drawer-cards, #collection-drawers').on('click', '.drawer-rule-edit', function () {
      const card = findDrawer($(this).attr('data-storage-id'), $(this).attr('data-drawer'));
      if (!card) {
        return;
      }
      const index = parseInt($(this).attr('data-index'), 10);
      const row = (card.rows || []).find(function (item) { return Number(item.index) === index; });
      if (row) {
        openRuleForm(row, card);
      }
    });

    $('#drawer-cards, #collection-drawers').on('click', '.drawer-rule-delete', function () {
      const index = parseInt($(this).attr('data-index'), 10);
      if (isNaN(index) || !window.confirm('Delete this drawer content rule?')) {
        return;
      }
      const message = $(this).closest('#collection-drawers').length
        ? '#collection-msg' : '#drawers-msg';
      BrickTools.api('DELETE', '/part-collection/' + index)
        .done(refreshAfterChange)
        .fail(function (xhr) {
          BrickTools.PartsCollectionShared.report(message, BrickTools.errorOf(xhr));
        });
    });

    // Collection search
    $('#collection-search').on('input', function () {
      const value = this.value;
      if (collectionTimer) {
        clearTimeout(collectionTimer);
      }
      collectionTimer = setTimeout(function () {
        collectionTimer = null;
        searchCollection(value);
      }, 250);
    }).on('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (collectionTimer) {
          clearTimeout(collectionTimer);
          collectionTimer = null;
        }
        searchCollection(this.value);
      }
    });

    // Drawer content form
    $('#collection-rule-cancel').on('click', closeRuleForm);

    $('#collection-rule-form').on('submit', function (event) {
      event.preventDefault();
      const index = String($('#collection-rule-index').val() || '');
      const body = {
        parts: String($('#collection-rule-parts').val() || '').trim(),
        colors: String($('#collection-rule-colors').val() || '').trim(),
        storageId: String($('#collection-rule-storage').val() || ''),
        drawer: String($('#collection-rule-drawer').val() || '').trim(),
        amount: String($('#collection-rule-amount').val() || '').trim()
      };
      const $buttons = $('#collection-rule-form button').prop('disabled', true);
      $('#collection-rule-form-msg').text('Saving…');
      BrickTools.api(index ? 'PUT' : 'POST',
          index ? '/part-collection/' + encodeURIComponent(index) : '/part-collection', body)
        .done(function () {
          closeRuleForm();
          refreshAfterChange();
        })
        .fail(function (xhr) {
          $('#collection-rule-form-msg').text(BrickTools.errorOf(xhr));
        })
        .always(function () {
          $buttons.prop('disabled', false);
        });
    });

    // Modal closing
    $('#storage-modal').on('click', function (event) {
      if (event.target === this) {
        closeStorageForm();
      }
    });
    $('#collection-rule-modal').on('click', function (event) {
      if (event.target === this) {
        closeRuleForm();
      }
    });
    $(document).on('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (!$('#storage-modal').prop('hidden')) {
        closeStorageForm();
      }
      if (!$('#collection-rule-modal').prop('hidden')) {
        closeRuleForm();
      }
    });

    // The active drawer can be changed from the header navigation.
    $(document).on('bricktools:active-container-changed', function () {
      renderStorages();
      renderDrawers();
      rerunCollectionSearch();
    });

    // Parts can be added from other tabs or pages; refresh the contents.
    $(document).on('bricktools:container-parts-added', function () {
      if (storagesLoaded) {
        loadStorages();
      }
      if (drawersLoaded) {
        loadDrawers();
      }
      rerunCollectionSearch();
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PartsCollectionStorage = {
    init: init,
    isStoragesLoaded: isStoragesLoaded,
    isDrawersLoaded: isDrawersLoaded,
    loadStorages: loadStorages,
    loadDrawers: loadDrawers,
    searchCollection: searchCollection,
    renderStorages: renderStorages,
    renderDrawers: renderDrawers,
    getStorages: function () { return storages; },
    getDrawerCards: getDrawerCards
  };
})();
