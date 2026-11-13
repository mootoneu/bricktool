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
  let storageSort = { key: 'order', dir: 1 };
  let storageFilter = '';

  let drawerCards = [];
  let drawersLoading = false;
  let drawersLoaded = false;
  let drawersFilter = '';
  let drawersStorageId = '';

  let collectionRequest = 0;
  let collectionTimer = null;
  let collectionCards = [];

  let partSearchRequest = 0;
  let partSearchTimer = null;
  let partSearchResults = [];
  let partSearchActive = -1;
  let partNameCache = {};
  let partValidation = {};

  let categoryGroups = null;
  let categoriesLoading = false;
  let categoryCallbacks = [];

  let ruleColors = null;
  let ruleColorsLoading = false;
  let ruleColorCallbacks = [];

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
        populateDrawersStorageSelect();
        if (drawersLoaded) {
          renderDrawers();
        }
        BrickTools.PartsCollectionShared.report('#storage-msg',
          storages.length === 0 ? 'No part storage stored yet.' : '');
      })
      .fail(function (xhr) {
        storages = [];
        storagesLoaded = true;
        renderStorages();
        populateStorageSelect();
        populateDrawersStorageSelect();
        if (drawersLoaded) {
          renderDrawers();
        }
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
      $tbody.append('<tr><td colspan="8" class="muted">' +
        (storages.length === 0 ? 'No part storage yet.' : 'No storage matches the filter.') +
        '</td></tr>');
      return;
    }

    visible.forEach(function (storage) {
      const isActive = active && active.type === 'storage'
        && String(active.storageId) === String(storage.id);
      const $row = $('<tr></tr>').toggleClass('selected', Boolean(isActive));
      $row.append($('<td></td>').text(fmt.number(storage.order != null ? storage.order : 0)));
      $row.append($('<td class="storage-id"></td>').text(storage.id || ''));
      $row.append($('<td></td>').text(storage.model || ''));
      $row.append($('<td></td>').text(fmt.number(storage.drawersCount || 0)));
      $row.append($('<td></td>').text(storage.location || ''));
      $row.append($('<td></td>').text(storage.description || ''));
      $row.append($('<td></td>').text(fmt.number(storage.rowCount || 0)));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append(BrickTools.iconButton('view', 'View storage ' + (storage.id || ''), 'secondary storage-view')
        .attr('data-storage-id', storage.id));
      $actions.append(BrickTools.iconButton('edit', 'Edit storage ' + (storage.id || ''), 'secondary storage-edit')
        .attr('data-storage-id', storage.id));
      $actions.append(BrickTools.iconButton('active', 'Set storage ' + (storage.id || '') + ' as active', 'secondary storage-set-active')
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
    $('#storage-order').val(storage && storage.order != null ? storage.order : 0);
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

  function showStorageDrawers(storageId) {
    drawersStorageId = String(storageId || '');
    const open = function () {
      populateDrawersStorageSelect();
      renderDrawers();
      $('[data-tab="drawers"]').trigger('click');
    };
    if (storagesLoaded) {
      open();
    } else {
      loadStorages(open);
    }
  }

  // ============================================================================
  // Drawers
  // ============================================================================

  function renderDrawers() {
    const selectedId = String(drawersStorageId || $('#drawers-storage').val() || '');
    const storageCards = selectedId ? drawerCards.filter(function (card) {
      return String(card.storageId) === selectedId;
    }) : [];
    const filter = drawersFilter.trim().toLowerCase();
    const cards = storageCards.filter(function (card) {
      if (!filter) {
        return true;
      }
      return [card.storageId, card.storageModel, card.storageLocation, card.drawer]
        .some(function (value) {
          return String(value || '').toLowerCase().indexOf(filter) !== -1;
        });
    });
    $('#drawers-count').text(storageCards.length === 0 ? '' :
      BrickTools.fmt.number(cards.length) + ' of ' + BrickTools.fmt.number(storageCards.length)
        + ' drawer(s)');
    renderDrawerCards($('#drawer-cards'), cards, false);
    if (storages.length === 0) {
      BrickTools.PartsCollectionShared.report('#drawers-msg',
        'No drawer yet. Add a part storage first.');
    } else if (!selectedId) {
      BrickTools.PartsCollectionShared.report('#drawers-msg', 'Select a storage.');
    } else if (cards.length === 0 && storageCards.length > 0) {
      BrickTools.PartsCollectionShared.report('#drawers-msg', 'No drawer matches the filter.');
    } else if (storageCards.length === 0) {
      BrickTools.PartsCollectionShared.report('#drawers-msg', 'No drawer for this storage.');
    } else {
      BrickTools.PartsCollectionShared.report('#drawers-msg', '');
    }
  }

  function populateDrawersStorageSelect() {
    const $select = $('#drawers-storage');
    const current = String(drawersStorageId || $select.val() || '');
    $select.empty();
    if (storages.length === 0) {
      drawersStorageId = '';
      $select.append($('<option></option>').attr('value', '').text('No storage'));
      $select.prop('disabled', true);
      return;
    }
    $select.prop('disabled', false);
    storages.forEach(function (storage) {
      const label = storage.model ? storage.id + ' (' + storage.model + ')' : storage.id;
      $select.append($('<option></option>').attr('value', storage.id).text(label));
    });
    const selected = storages.find(function (storage) {
      return String(storage.id) === current;
    });
    drawersStorageId = selected ? String(selected.id) : String(storages[0].id);
    $select.val(drawersStorageId);
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
        (card.storageId || '') + ' · ' + (card.drawer || '—')));
      const sub = [card.storageModel, card.storageLocation].filter(Boolean).join(' · ');
      if (sub) {
        $titles.append($('<p class="drawer-card-sub"></p>').text(sub));
      }
      $head.append($titles);

      const $actions = $('<div class="drawer-card-actions"></div>');
      $actions.append(BrickTools.iconButton('add', 'Add content to drawer ' + (card.drawer || ''), 'secondary drawer-add-content')
        .attr('data-storage-id', card.storageId)
        .attr('data-drawer', card.drawer));
      $actions.append(BrickTools.iconButton('active', 'Set drawer ' + (card.drawer || '') + ' as active', 'secondary drawer-set-active')
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
    $actions.append(BrickTools.iconButton('edit', 'Edit content rule', 'secondary drawer-rule-edit')
      .attr('data-index', row.index)
      .attr('data-storage-id', card.storageId)
      .attr('data-drawer', card.drawer));
    $actions.append(BrickTools.iconButton('delete', 'Delete content rule', 'danger drawer-rule-delete')
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

  const COLLECTION_PROMPT = 'Type a part number, name, color, or category to search drawers, ' +
    'BrickOwl parts, and PaB parts.';

  function collectionTokens(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .split(/\s+/)
      .filter(function (token) { return token.length > 0; });
  }

  function matchesCollectionQuery(values, tokens) {
    const haystack = values
      .map(function (value) { return String(value == null ? '' : value); })
      .join(' ')
      .toLowerCase();
    return tokens.every(function (token) { return haystack.indexOf(token) !== -1; });
  }

  function brickOwlMatches(part, tokens) {
    return matchesCollectionQuery([
      part.name,
      part.boid,
      part.type,
      part.colorName,
      part.colorId,
      part.condition,
      part.designIds,
      part.itemNumbers,
      BrickTools.getPartNameFromBOName(part.name || '', part.colorName || '')
    ], tokens);
  }

  function pabMatches(part, tokens) {
    return matchesCollectionQuery([
      part.partNumber,
      part.partName,
      part.partCategory,
      part.colorName,
      part.partColorId
    ], tokens);
  }

  function brickOwlName(part) {
    return BrickTools.getPartNameFromBOName(part.name || '', part.colorName || '');
  }

  function sortedBrickOwlParts(list) {
    const shared = BrickTools.PartsCollectionShared;
    return list.slice().sort(function (a, b) {
      return shared.compareValues(brickOwlName(a), brickOwlName(b), 1)
        || shared.compareValues(a.colorName, b.colorName, 1);
    });
  }

  function collapsePabParts(list) {
    const byPart = new Map();
    list.forEach(function (part) {
      const key = String(part.partNumber == null ? '' : part.partNumber) + '\u0000'
        + String(part.partColorId == null ? '' : part.partColorId);
      const existing = byPart.get(key);
      if (!existing) {
        byPart.set(key, Object.assign({}, part));
        return;
      }
      existing.quantity = (Number(existing.quantity) || 0) + (Number(part.quantity) || 0);
    });
    return Array.from(byPart.values());
  }

  function sortedPabParts(list) {
    const shared = BrickTools.PartsCollectionShared;
    return collapsePabParts(list).sort(function (a, b) {
      return shared.compareValues(a.partName, b.partName, 1)
        || shared.compareValues(a.partNumber, b.partNumber, 1)
        || shared.compareValues(a.colorName, b.colorName, 1);
    });
  }

  function resetCollectionResults() {
    $('#collection-drawers').empty();
    collectionCards = [];
    $('#collection-count').text('');
    ['#collection-brickowl', '#collection-pab'].forEach(function (selector) {
      $(selector).prop('hidden', true);
    });
    ['#collection-brickowl-parts', '#collection-pab-parts'].forEach(function (selector) {
      $(selector + ' tbody').empty();
    });
    ['#collection-brickowl-count', '#collection-pab-count',
      '#collection-brickowl-msg', '#collection-pab-msg'].forEach(function (selector) {
      $(selector).text('');
    });
  }

  function fillCollectionTable(section, table, count, list, rowBuilder) {
    const $tbody = $(table + ' tbody').empty();
    $(section).prop('hidden', list.length === 0);
    $(count).text(list.length === 0 ? '' : BrickTools.fmt.number(list.length) + ' part(s)');
    list.forEach(function (row) {
      $tbody.append(rowBuilder(row));
    });
  }

  function searchCollection(query) {
    const value = String(query == null ? '' : query).trim();
    const request = ++collectionRequest;
    resetCollectionResults();
    if (!value) {
      BrickTools.PartsCollectionShared.report('#collection-msg', COLLECTION_PROMPT);
      return;
    }
    BrickTools.PartsCollectionShared.report('#collection-msg', 'Searching the part collection…');

    const tokens = collectionTokens(value);
    const drawers = BrickTools.api(
      'GET', '/part-collection/drawers?query=' + encodeURIComponent(value));
    const brickOwl = BrickTools.api('GET', '/brickowl/parts');
    const pab = BrickTools.api('GET', '/pab/parts');

    Promise.allSettled([drawers, brickOwl, pab]).then(function (results) {
      if (request !== collectionRequest) {
        return;
      }

      const drawerResult = results[0];
      const brickOwlResult = results[1];
      const pabResult = results[2];

      let drawerCount = 0;
      if (drawerResult.status === 'fulfilled') {
        const cards = Array.isArray(drawerResult.value) ? drawerResult.value : [];
        collectionCards = cards;
        drawerCount = cards.length;
        renderDrawerCards($('#collection-drawers'), cards, true);
      }

      let brickOwlCount = 0;
      if (brickOwlResult.status === 'fulfilled') {
        const list = Array.isArray(brickOwlResult.value) ? brickOwlResult.value : [];
        const matches = sortedBrickOwlParts(list.filter(function (part) {
          return brickOwlMatches(part, tokens);
        }));
        brickOwlCount = matches.length;
        fillCollectionTable('#collection-brickowl', '#collection-brickowl-parts',
          '#collection-brickowl-count', matches,
          function (part) { return BrickTools.PartsCollectionBrickOwl.partRow(part); });
      } else {
        $('#collection-brickowl').prop('hidden', false);
        BrickTools.PartsCollectionShared.report('#collection-brickowl-msg',
          'Unable to load BrickOwl parts.');
      }

      let pabCount = 0;
      if (pabResult.status === 'fulfilled') {
        const list = Array.isArray(pabResult.value) ? pabResult.value : [];
        const matches = sortedPabParts(list.filter(function (part) {
          return pabMatches(part, tokens);
        }));
        pabCount = matches.length;
        fillCollectionTable('#collection-pab', '#collection-pab-parts',
          '#collection-pab-count', matches,
          function (part) { return BrickTools.PartsCollectionPab.partRow(part, false); });
      } else {
        $('#collection-pab').prop('hidden', false);
        BrickTools.PartsCollectionShared.report('#collection-pab-msg',
          'Unable to load PaB parts.');
      }

      const counts = [BrickTools.fmt.number(drawerCount) + ' drawer(s)'];
      if (brickOwlCount > 0) {
        counts.push(BrickTools.fmt.number(brickOwlCount) + ' BrickOwl part(s)');
      }
      if (pabCount > 0) {
        counts.push(BrickTools.fmt.number(pabCount) + ' PaB part(s)');
      }
      $('#collection-count').text(counts.join(' · '));

      const failed = drawerResult.status !== 'fulfilled'
        || brickOwlResult.status !== 'fulfilled'
        || pabResult.status !== 'fulfilled';
      if (drawerCount + brickOwlCount + pabCount === 0) {
        BrickTools.PartsCollectionShared.report('#collection-msg', failed
          ? 'The collection could not be fully searched.'
          : 'No drawer, BrickOwl part, or PaB part matches "' + value + '".');
      } else {
        BrickTools.PartsCollectionShared.report('#collection-msg', '');
      }
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

  // ============================================================================
  // Drawer content helpers
  // ============================================================================

  function splitRuleTokens(value) {
    return String(value == null ? '' : value)
      .split(';')
      .map(function (token) { return token.trim(); })
      .filter(function (token) { return token.length > 0; });
  }

  function tokenKey(token) {
    return String(token == null ? '' : token).toLowerCase();
  }

  function canonicalColorToken(token) {
    const lower = String(token || '').toLowerCase();
    if (lower === 'any') {
      return 'Any';
    }
    if (lower === 'other') {
      return 'Other';
    }
    if (lower === 'decorated') {
      return 'Decorated';
    }
    return String(token || '').trim();
  }

  function uniqueRuleTokens(value, canonicalize) {
    const seen = {};
    const result = [];
    splitRuleTokens(value).forEach(function (token) {
      const normalized = canonicalize ? canonicalize(token) : token;
      const key = tokenKey(normalized);
      if (!normalized || seen[key]) {
        return;
      }
      seen[key] = true;
      result.push(normalized);
    });
    return result;
  }

  function getRulePartTokens() {
    return splitRuleTokens($('#collection-rule-parts').val());
  }

  function setRulePartTokens(tokens) {
    $('#collection-rule-parts').val(tokens.join(';'));
    renderRulePartTokens();
  }

  function addRulePartToken(token) {
    const value = String(token || '').trim();
    if (!value) {
      return;
    }
    const tokens = getRulePartTokens();
    const exists = tokens.some(function (existing) {
      return tokenKey(existing) === tokenKey(value);
    });
    if (!exists) {
      tokens.push(value);
      setRulePartTokens(tokens);
    }
  }

  function removeRulePartToken(index) {
    const tokens = getRulePartTokens();
    if (index < 0 || index >= tokens.length) {
      return;
    }
    tokens.splice(index, 1);
    setRulePartTokens(tokens);
  }

  function getRuleColorTokens() {
    return splitRuleTokens($('#collection-rule-colors').val());
  }

  function setRuleColorTokens(tokens) {
    $('#collection-rule-colors').val(tokens.join(';'));
    renderRuleColorTokens();
  }

  function addRuleColorToken(token) {
    const value = canonicalColorToken(token);
    if (!value) {
      return;
    }
    const tokens = getRuleColorTokens();
    const exists = tokens.some(function (existing) {
      return tokenKey(canonicalColorToken(existing)) === tokenKey(value);
    });
    if (!exists) {
      tokens.push(value);
      setRuleColorTokens(tokens);
    }
  }

  function removeRuleColorToken(index) {
    const tokens = getRuleColorTokens();
    if (index < 0 || index >= tokens.length) {
      return;
    }
    tokens.splice(index, 1);
    setRuleColorTokens(tokens);
  }

  function categoryLookup() {
    const byId = {};
    const byName = {};
    (categoryGroups || []).forEach(function (group) {
      (group.categories || []).forEach(function (category) {
        const id = String(category.id);
        const name = category.name || ('Category ' + id);
        byId[id] = name;
        byName[tokenKey(name)] = name;
      });
    });
    return { byId: byId, byName: byName };
  }

  function findRuleColor(id) {
    const wanted = String(id);
    return (ruleColors || []).find(function (color) {
      return String(color.id) === wanted;
    }) || null;
  }

  function ruleTokenRemoveButton(kind, index) {
    return $('<button type="button" class="rule-token-remove"></button>')
      .attr('data-token-kind', kind)
      .attr('data-token-index', index)
      .attr('aria-label', 'Remove')
      .html(BrickTools.icon('close'));
  }

  function renderRulePartTokens() {
    const $host = $('#collection-rule-part-tokens').empty();
    const tokens = getRulePartTokens();
    if (tokens.length === 0) {
      $host.append($('<span class="rule-tokens-empty"></span>')
        .text('No part, category, or tag yet.'));
      updateRuleWarnings();
      return;
    }
    const categories = categoryLookup();
    tokens.forEach(function (token, index) {
      const $chip = $('<span class="rule-token"></span>');
      if (token.charAt(0) === '§') {
        $chip.addClass('category');
        const value = token.substring(1).trim();
        const name = categories.byId[value] || categories.byName[tokenKey(value)] || value;
        $chip.append($('<span></span>').text('§ ' + name));
        $chip.attr('title', 'Category ' + value);
      } else if (token.charAt(0) === '#') {
        $chip.addClass('tag');
        $chip.append($('<span></span>').text(token));
        $chip.attr('title', 'Name contains "' + token.substring(1) + '"');
      } else {
        const name = partNameCache[tokenKey(token)];
        $chip.append($('<span></span>').text(token));
        $chip.attr('title', name ? token + ' · ' + name : 'Part ' + token);
      }
      $chip.append(ruleTokenRemoveButton('part', index));
      $host.append($chip);
    });
    updateRuleWarnings();
  }

  function renderRuleColorTokens() {
    const $host = $('#collection-rule-color-tokens').empty();
    const tokens = getRuleColorTokens();
    if (tokens.length === 0) {
      $host.append($('<span class="rule-tokens-empty"></span>').text('No color yet.'));
      updateRuleWarnings();
      return;
    }
    tokens.forEach(function (token, index) {
      const $chip = $('<span class="rule-token"></span>');
      const keyword = canonicalColorToken(token);
      if (keyword === 'Any' || keyword === 'Other' || keyword === 'Decorated') {
        $chip.addClass('keyword').append($('<span></span>').text(keyword));
        $chip.attr('title', keyword === 'Any' ? 'Matches every color'
          : keyword === 'Other' ? 'Matches colors not explicitly listed'
            : 'Matches decorated parts');
      } else {
        const color = findRuleColor(token);
        if (color) {
          const hex = BrickTools.PartsCollectionShared.colorHex({ rgb: color.rgb });
          if (hex) {
            $chip.append($('<span class="rule-token-swatch"></span>')
              .css('background-color', hex));
          }
          $chip.append($('<span></span>').text(color.name));
          $chip.attr('title', 'Color ' + color.id + (color.rgb ? ' · #' + color.rgb : ''));
        } else {
          $chip.append($('<span></span>').text('Color ' + token));
        }
      }
      $chip.append(ruleTokenRemoveButton('color', index));
      $host.append($chip);
    });
    updateRuleWarnings();
  }

  function updateRuleWarnings() {
    const warnings = [];
    const categories = categoryLookup();
    const categoriesLoaded = Array.isArray(categoryGroups) && categoryGroups.length > 0;
    getRulePartTokens().forEach(function (token) {
      if (token.charAt(0) === '§') {
        const value = token.substring(1).trim();
        if (categoriesLoaded && value && !categories.byId[value]
            && !categories.byName[tokenKey(value)]) {
          warnings.push('Unknown category "' + value + '".');
        }
        return;
      }
      if (token.charAt(0) === '#') {
        return;
      }
      if (partValidation[tokenKey(token)] === 'unknown') {
        warnings.push('Unknown part number "' + token + '".');
      }
    });

    let concreteColors = 0;
    let hasAny = false;
    getRuleColorTokens().forEach(function (token) {
      const keyword = canonicalColorToken(token);
      if (keyword === 'Any' || keyword === 'Other' || keyword === 'Decorated') {
        hasAny = hasAny || keyword === 'Any';
        return;
      }
      concreteColors += 1;
      if (ruleColors && !findRuleColor(token)) {
        warnings.push('Unknown color id "' + token + '".');
      }
    });
    if (hasAny && concreteColors > 0) {
      warnings.push('Any already matches every color; the specific color ids are redundant.');
    }
    $('#collection-rule-helper-msg').text(warnings.join(' '));
  }

  function validateRuleParts() {
    getRulePartTokens().forEach(function (token) {
      if (token.charAt(0) === '§' || token.charAt(0) === '#') {
        return;
      }
      const key = tokenKey(token);
      if (partValidation[key]) {
        return;
      }
      partValidation[key] = 'checking';
      BrickTools.api('GET', '/parts/' + encodeURIComponent(token) + '/info')
        .done(function (info) {
          partValidation[key] = 'known';
          if (info && info.name) {
            partNameCache[key] = info.name;
          }
        })
        .fail(function (xhr) {
          partValidation[key] = xhr && xhr.status === 404 ? 'unknown' : 'error';
        })
        .always(function () {
          renderRulePartTokens();
        });
    });
  }

  function hideRulePartResults() {
    partSearchRequest += 1;
    partSearchResults = [];
    partSearchActive = -1;
    $('#collection-rule-part-results').prop('hidden', true).empty();
  }

  function renderRulePartResults(result, query) {
    const $host = $('#collection-rule-part-results').empty();
    partSearchResults = [];
    partSearchActive = -1;
    const parts = result && Array.isArray(result.parts) ? result.parts : [];
    parts.slice(0, 8).forEach(function (part) {
      const partNumber = String(part.partNumber || '');
      if (!partNumber) {
        return;
      }
      partNameCache[tokenKey(partNumber)] = part.name || '';
      partSearchResults.push({ type: 'part', partNumber: partNumber });
      const $button = $('<button type="button" class="rule-suggestion"></button>')
        .attr('data-part-number', partNumber);
      $button.append($('<img alt="">')
        .attr('src', '/api/parts/' + encodeURIComponent(partNumber) + '/image')
        .on('error', function () { $(this).remove(); }));
      const $text = $('<span class="rule-suggestion-text"></span>');
      $text.append($('<span class="rule-suggestion-number"></span>').text('#' + partNumber));
      const meta = [part.name, part.categoryName].filter(Boolean).join(' · ');
      if (meta) {
        $text.append($('<span class="rule-suggestion-meta"></span>').text(meta));
      }
      $button.append($text);
      $host.append($button);
    });

    const trimmed = String(query || '').trim();
    if (trimmed && /^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(trimmed)) {
      const exists = parts.some(function (part) {
        return tokenKey(part.partNumber) === tokenKey(trimmed);
      });
      if (!exists) {
        partSearchResults.push({ type: 'number', partNumber: trimmed });
        $host.append($('<button type="button" class="rule-suggestion rule-suggestion-fallback"></button>')
          .attr('data-part-number', trimmed)
          .append($('<span class="rule-suggestion-text"></span>')
            .append($('<span class="rule-suggestion-number"></span>')
              .text('Use part number ' + trimmed))));
      }
    }

    if (partSearchResults.length === 0) {
      $host.append($('<p class="rule-suggestion-empty muted"></p>')
        .text('No matching part. Type a full part number to use it.'));
    }
    $host.prop('hidden', false);
  }

  function searchRuleParts(query) {
    const value = String(query || '').trim();
    const request = ++partSearchRequest;
    if (!value) {
      hideRulePartResults();
      return;
    }
    BrickTools.api('GET', '/parts/main-parts/search?query=' + encodeURIComponent(value))
      .done(function (result) {
        if (request !== partSearchRequest) {
          return;
        }
        renderRulePartResults(result, value);
      })
      .fail(function (xhr) {
        if (request !== partSearchRequest) {
          return;
        }
        partSearchResults = [];
        partSearchActive = -1;
        const $host = $('#collection-rule-part-results').empty();
        $host.append($('<p class="rule-suggestion-empty"></p>')
          .text(BrickTools.errorOf(xhr)));
        $host.prop('hidden', false);
      });
  }

  function setRulePartActive(index) {
    const $items = $('#collection-rule-part-results .rule-suggestion');
    if ($items.length === 0) {
      return;
    }
    partSearchActive = index < 0 ? $items.length - 1 : index % $items.length;
    $items.removeClass('active').eq(partSearchActive).addClass('active');
    const node = $items.get(partSearchActive);
    if (node && node.scrollIntoView) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }

  function chooseRulePart(partNumber) {
    const value = String(partNumber || '').trim();
    if (!value) {
      return;
    }
    partValidation[tokenKey(value)] = 'known';
    addRulePartToken(value);
    $('#collection-rule-part-search').val('');
    hideRulePartResults();
  }

  function useRulePartNumber(partNumber) {
    const value = String(partNumber || '').trim();
    if (!value) {
      return;
    }
    const key = tokenKey(value);
    partValidation[key] = 'checking';
    BrickTools.api('GET', '/parts/' + encodeURIComponent(value) + '/info')
      .done(function (info) {
        partValidation[key] = 'known';
        if (info && info.name) {
          partNameCache[key] = info.name;
        }
        addRulePartToken(value);
        $('#collection-rule-part-search').val('');
        hideRulePartResults();
      })
      .fail(function (xhr) {
        partValidation[key] = xhr && xhr.status === 404 ? 'unknown' : 'error';
        renderRulePartTokens();
      });
  }

  function populateRuleCategorySelect() {
    const $select = $('#collection-rule-category');
    const current = $select.val();
    $select.empty();
    $select.append($('<option></option>').attr('value', '').text('Select a category…'));
    if (!Array.isArray(categoryGroups) || categoryGroups.length === 0) {
      $select.prop('disabled', true);
      return;
    }
    $select.prop('disabled', false);
    categoryGroups.forEach(function (group) {
      const $optgroup = $('<optgroup></optgroup>').attr('label', group.group || 'Other');
      (group.categories || []).forEach(function (category) {
        const id = String(category.id);
        const label = category.name ? category.name + ' (' + id + ')' : 'Category ' + id;
        $optgroup.append($('<option></option>').attr('value', id).text(label));
      });
      if ($optgroup.children().length > 0) {
        $select.append($optgroup);
      }
    });
    if (current) {
      $select.val(current);
    }
  }

  function loadRuleCategories(callback) {
    if (typeof callback === 'function') {
      categoryCallbacks.push(callback);
    }
    if (Array.isArray(categoryGroups)) {
      populateRuleCategorySelect();
      renderRulePartTokens();
      flushRuleCategoryCallbacks();
      return;
    }
    if (categoriesLoading) {
      return;
    }
    categoriesLoading = true;
    BrickTools.api('GET', '/parts/categories')
      .done(function (list) {
        categoryGroups = Array.isArray(list) ? list : [];
        populateRuleCategorySelect();
        renderRulePartTokens();
      })
      .fail(function () {
        categoryGroups = null;
        populateRuleCategorySelect();
        renderRulePartTokens();
      })
      .always(function () {
        categoriesLoading = false;
        flushRuleCategoryCallbacks();
      });
  }

  function flushRuleCategoryCallbacks() {
    const callbacks = categoryCallbacks.slice();
    categoryCallbacks = [];
    callbacks.forEach(function (callback) { callback(); });
  }

  function loadRuleColors(callback) {
    if (typeof callback === 'function') {
      ruleColorCallbacks.push(callback);
    }
    if (Array.isArray(ruleColors)) {
      renderRuleColorTokens();
      flushRuleColorCallbacks();
      return;
    }
    if (ruleColorsLoading) {
      return;
    }
    ruleColorsLoading = true;
    BrickColor.loadColors()
      .done(function (colors) {
        ruleColors = Array.isArray(colors) ? colors : [];
      })
      .fail(function () {
        ruleColors = null;
      })
      .always(function () {
        ruleColorsLoading = false;
        renderRuleColorTokens();
        flushRuleColorCallbacks();
      });
  }

  function flushRuleColorCallbacks() {
    const callbacks = ruleColorCallbacks.slice();
    ruleColorCallbacks = [];
    callbacks.forEach(function (callback) { callback(); });
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
    $('#collection-rule-part-search').val('');
    $('#collection-rule-helper-msg').text('');
    partValidation = {};
    hideRulePartResults();
    renderRulePartTokens();
    renderRuleColorTokens();
    loadRuleCategories();
    loadRuleColors();
    validateRuleParts();
    $('#collection-rule-modal').prop('hidden', false);
    $('#collection-rule-parts').trigger('focus');
  }

  function closeRuleForm() {
    if (partSearchTimer) {
      clearTimeout(partSearchTimer);
      partSearchTimer = null;
    }
    hideRulePartResults();
    $('#collection-rule-helper-msg').text('');
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

    $('#part-storage').on('click', '.storage-view', function () {
      showStorageDrawers($(this).attr('data-storage-id'));
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
        description: String($('#storage-description').val() || '').trim(),
        order: parseInt($('#storage-order').val(), 10)
      };
      if (isNaN(body.drawersCount)) {
        body.drawersCount = 0;
      }
      if (isNaN(body.order)) {
        body.order = 0;
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
    $('#drawers-storage').on('change', function () {
      drawersStorageId = String($(this).val() || '');
      renderDrawers();
    });

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

    $('#collection-rule-parts').on('input', function () {
      renderRulePartTokens();
    }).on('change', validateRuleParts);

    $('#collection-rule-part-search').on('input', function () {
      const value = this.value;
      if (partSearchTimer) {
        clearTimeout(partSearchTimer);
      }
      partSearchTimer = setTimeout(function () {
        partSearchTimer = null;
        searchRuleParts(value);
      }, 250);
    }).on('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setRulePartActive(partSearchActive + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setRulePartActive(partSearchActive - 1);
      } else if (event.key === 'Enter') {
        if (partSearchResults.length > 0) {
          event.preventDefault();
          const index = partSearchActive >= 0 ? partSearchActive : 0;
          const item = partSearchResults[index];
          if (item.type === 'number') {
            useRulePartNumber(item.partNumber);
          } else {
            chooseRulePart(item.partNumber);
          }
        }
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        hideRulePartResults();
      }
    }).on('blur', function () {
      setTimeout(hideRulePartResults, 150);
    });

    $('#collection-rule-part-results').on('click', '.rule-suggestion', function () {
      const partNumber = $(this).attr('data-part-number');
      if ($(this).hasClass('rule-suggestion-fallback')) {
        useRulePartNumber(partNumber);
      } else {
        chooseRulePart(partNumber);
      }
    });

    $('#collection-rule-add-category').on('click', function () {
      const categoryId = String($('#collection-rule-category').val() || '');
      if (!categoryId) {
        $('#collection-rule-helper-msg').text('Select a category first.');
        return;
      }
      addRulePartToken('§' + categoryId);
    });

    $('#collection-rule-part-tokens').on('click', '.rule-token-remove', function () {
      removeRulePartToken(Number($(this).attr('data-token-index')));
    });

    $('#collection-rule-colors').on('input', function () {
      renderRuleColorTokens();
    });

    $('#collection-rule-modal').on('click', '.rule-color-keyword', function () {
      addRuleColorToken($(this).attr('data-color-keyword'));
    });

    $('#collection-rule-add-color').on('click', function () {
      if (!window.BrickColor) {
        return;
      }
      BrickColor.openColorPicker(null, function (color) {
        addRuleColorToken(color.id);
      });
    });

    $('#collection-rule-color-tokens').on('click', '.rule-token-remove', function () {
      removeRuleColorToken(Number($(this).attr('data-token-index')));
    });

    $('#collection-rule-form').on('submit', function (event) {
      event.preventDefault();
      const index = String($('#collection-rule-index').val() || '');
      const parts = uniqueRuleTokens($('#collection-rule-parts').val());
      const colors = uniqueRuleTokens($('#collection-rule-colors').val(), canonicalColorToken);
      if (parts.length === 0) {
        $('#collection-rule-form-msg').text('Add at least one part, category, or tag.');
        return;
      }
      if (colors.length === 0) {
        $('#collection-rule-form-msg').text('Add at least one color.');
        return;
      }
      $('#collection-rule-parts').val(parts.join(';'));
      $('#collection-rule-colors').val(colors.join(';'));
      renderRulePartTokens();
      renderRuleColorTokens();
      const body = {
        parts: parts.join(';'),
        colors: colors.join(';'),
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
      const $picker = $('#color-picker-modal');
      if ($picker.length && !$picker.prop('hidden')) {
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
