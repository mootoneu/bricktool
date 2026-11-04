$(function () {
  'use strict';

  BrickTools.initHeader('newsets');

  const fmt = BrickTools.fmt;
  const PRIORITY_RANK = { Favorite: 1, High: 2, Medium: 3, Low: 4 };
  const SET_PAGE_SIZE = 48;

  // Sets matching any of these rules are hidden from the Sets tab by default.
  // Add more rules to this list to exclude other families of sets.
  const DEFAULT_SET_EXCLUSIONS = [
    {
      id: 'l-number',
      description: 'Set numbers starting with L',
      excludes: set => /^l/i.test(String(set.setNumber || ''))
    }
  ];

  function isExcludedByDefault(set) {
    return DEFAULT_SET_EXCLUSIONS.some(rule => rule.excludes(set));
  }

  function applyDefaultExclusions(data) {
    const source = data || {};
    const sets = (source.sets || []).filter(set => !isExcludedByDefault(set));
    const themeNames = new Set(sets.map(set => set.theme).filter(Boolean));
    const themes = (source.themes || []).filter(theme => themeNames.has(theme.name));
    return Object.assign({}, source, { sets: sets, themes: themes });
  }

  let catalog = { fromYear: null, toYear: null, sets: [], themes: [] };
  let wishlist = [];
  let wishlistBySet = new Map();
  let options = { members: [], priorities: [] };
  let wishlistSortKey = 'priorityRank';
  let wishlistSortDir = 1;
  let filteredSetRows = [];
  let renderedSetCount = 0;
  let setObserver = null;
  let forceSetReset = false;
  let rootFilter = '';

  function report(selector, text) {
    $(selector).text(text || '');
  }

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  function today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
  }

  function textValue(selector) {
    return $.trim($(selector).val() || '');
  }

  function numberValue(selector) {
    const value = textValue(selector);
    return value === '' ? null : Number(value);
  }

  function readableText(color) {
    const hex = String(color || '#e5e7eb').replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex.slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(full)) {
      return '#111827';
    }
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111827' : '#ffffff';
  }

  function fillSelect(selector, values, preserve) {
    const $select = $(selector);
    const current = preserve ? ($select.val() || '') : '';
    $select.find('option:not(:first)').remove();
    values.forEach(function (value) {
      $select.append($('<option></option>').val(value).text(value));
    });
    $select.val(current && values.includes(current) ? current : '');
  }

  function themeNames(includeWishlist) {
    const names = new Set(catalog.themes.map(t => t.name));
    if (includeWishlist) {
      wishlist.forEach(entry => {
        if (entry.theme) {
          names.add(entry.theme);
        }
      });
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function themeChip(theme, imageUrl, color) {
    const background = color || '#e5e7eb';
    const $chip = $('<span class="theme-chip"></span>')
      .css({ 'background-color': background, color: readableText(background) });
    if (imageUrl) {
      $chip.append($('<img loading="lazy">')
        .attr('src', imageUrl)
        .attr('alt', theme || '')
        .on('error', function () {
          $(this).remove();
          $chip.text(theme || 'Unknown theme');
        }));
    } else {
      $chip.text(theme || 'Unknown theme');
    }
    $chip.attr('title', theme || 'Unknown theme');
    return $chip;
  }

  function loadAll() {
    return $.when(
      BrickTools.api('GET', '/newsets'),
      BrickTools.api('GET', '/wishlist'),
      BrickTools.api('GET', '/wishlist/options')
    ).done(function (catalogResponse, wishlistResponse, optionsResponse) {
      catalog = applyDefaultExclusions(catalogResponse[0] || catalog);
      wishlist = wishlistResponse[0] || [];
      options = optionsResponse[0] || options;
      indexWishlist();
      renderWindow();
      renderThemeFilters();
      renderThemes();
      renderSets();
      renderWishlist();
      report('#newsets-msg', '');
    }).fail(function (xhr) {
      report('#newsets-msg', BrickTools.errorOf(xhr));
    });
  }

  function reloadWishlist() {
    return BrickTools.api('GET', '/wishlist')
      .done(function (entries) {
        wishlist = entries || [];
        indexWishlist();
        renderThemeFilters();
        renderSets(true);
        renderWishlist();
      })
      .fail(function (xhr) { report('#newsets-msg', BrickTools.errorOf(xhr)); });
  }

  function indexWishlist() {
    wishlistBySet = new Map();
    wishlist.forEach(function (entry) {
      entry.priorityRank = PRIORITY_RANK[entry.priority] || 99;
      wishlistBySet.set(entry.setNumber, entry);
    });
  }

  function renderWindow() {
    if (catalog.fromYear == null) {
      report('#newsets-window', '');
      return;
    }
    const years = catalog.fromYear === catalog.toYear
      ? String(catalog.toYear)
      : catalog.fromYear + '–' + catalog.toYear;
    report('#newsets-window', 'Sets released in ' + years);
  }

  function renderThemeFilters() {
    fillSelect('#ns-theme', themeNames(false), true);
    fillSelect('#wl-theme', themeNames(true), true);
  }

  function renderThemes() {
    const $host = $('#theme-cards').empty();
    const grouped = $('#theme-root-group').is(':checked');
    const themes = grouped ? catalog.rootThemes : catalog.themes;
    if (themes.length === 0) {
      $host.append('<p class="muted">No new sets found for this period.</p>');
      return;
    }
    const fragment = document.createDocumentFragment();
    themes.forEach(function (theme) {
      const color = theme.color || '#e5e7eb';
      const $card = $('<button type="button" class="theme-card"></button>')
        .css({ 'background-color': color, color: readableText(color) })
        .attr('title', theme.name);
      if (theme.imageUrl) {
        $card.append($('<img loading="lazy">').attr('src', theme.imageUrl).attr('alt', theme.name));
      }
      $card.append($('<span class="theme-card-name"></span>').text(theme.name));
      $card.on('click', function () {
        rootFilter = grouped ? theme.name : '';
        $('#ns-theme').val(grouped ? '' : theme.name);
        forceSetReset = true;
        $('[data-tab="sets"]').trigger('click');
      });
      fragment.appendChild($card[0]);
    });
    $host.append(fragment);
  }

  function priceMatches(value, min, max) {
    if (min == null && max == null) {
      return true;
    }
    if (value == null) {
      return false;
    }
    if (min != null && value < min) {
      return false;
    }
    return max == null || value <= max;
  }

  function filteredSets() {
    const name = textValue('#ns-name').toLowerCase();
    const theme = textValue('#ns-theme');
    const min = numberValue('#ns-price-min');
    const max = numberValue('#ns-price-max');
    const wishlistedOnly = $('#ns-wishlisted').is(':checked');

    return catalog.sets.filter(function (set) {
      if (name && String(set.name || '').toLowerCase().indexOf(name) === -1) {
        return false;
      }
      if (theme && set.theme !== theme) {
        return false;
      }
      if (rootFilter && set.rootTheme !== rootFilter) {
        return false;
      }
      if (!priceMatches(set.officialPrice, min, max)) {
        return false;
      }
      return !wishlistedOnly || wishlistBySet.has(set.setNumber);
    });
  }

  function updateSetSummary() {
    const total = filteredSetRows.length;
    const catalogTotal = catalog.sets.length;
    const label = total === catalogTotal ? 'sets' : (total === 1 ? 'matching set' : 'matching sets');
    const suffix = total === catalogTotal ? '' : ' (' + catalogTotal + ' in catalogue)';
    const root = rootFilter ? 'Root theme ' + rootFilter + ': ' : '';
    report('#set-summary', root + 'Showing ' + renderedSetCount + ' of ' + total + ' ' + label + suffix);
  }

  function updateSetLoader() {
    $('#set-loader').prop('hidden', renderedSetCount >= filteredSetRows.length);
  }

  function setCard(set) {
    const entry = wishlistBySet.get(set.setNumber);
    const $card = $('<article class="set-card"></article>').attr('data-set-number', set.setNumber);

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
      $facts.append(' ').append(BrickTools.priceButton(set.setNumber, function (result) {
        set.officialPrice = result.legoPrice;
        reloadWishlist();
      }));
    }
    $body.append($facts);

    const $footer = $('<div class="set-card-footer"></div>');
    $footer.append(themeChip(set.theme, set.themeImageUrl, set.themeColor));
    $footer.append($('<button type="button" class="btn wishlist-toggle"></button>')
      .addClass(entry ? 'secondary' : '')
      .attr('data-set-number', set.setNumber)
      .attr('data-set-name', set.name || set.setNumber)
      .text(entry ? 'Remove from wishlist' : 'Save to wishlist'));
    $body.append($footer);

    $card.append($body);
    return $card;
  }

  function appendSetCards(count) {
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
    updateSetSummary();
    updateSetLoader();
  }

  function loadMoreSets() {
    appendSetCards(SET_PAGE_SIZE);
  }

  function renderSets(preserve) {
    const target = preserve ? renderedSetCount : 0;
    filteredSetRows = filteredSets();
    renderedSetCount = 0;
    $('#set-cards').empty();

    if (filteredSetRows.length === 0) {
      $('#set-cards').append('<p class="muted">No sets match the filters.</p>');
      updateSetSummary();
      updateSetLoader();
      return;
    }
    appendSetCards(Math.max(SET_PAGE_SIZE, target));
  }

  function setupSetObserver() {
    const sentinel = document.querySelector('#set-loader');
    if (!sentinel) {
      return;
    }
    if ('IntersectionObserver' in window) {
      setObserver = new IntersectionObserver(function (entries) {
        if (entries.some(entry => entry.isIntersecting)) {
          loadMoreSets();
        }
      }, { rootMargin: '400px 0px' });
      setObserver.observe(sentinel);
      return;
    }
    $(window).on('scroll', function () {
      if ($(window).scrollTop() + $(window).height() + 400 >= $('#set-loader').offset().top) {
        loadMoreSets();
      }
    });
  }

  function fillWishlistFilterOptions() {
    fillSelect('#wl-member-filter', options.members || [], true);
    fillSelect('#wl-priority-filter', options.priorities || [], true);
  }

  function filteredWishlist() {
    const name = textValue('#wl-name').toLowerCase();
    const theme = textValue('#wl-theme');
    const member = textValue('#wl-member-filter');
    const priority = textValue('#wl-priority-filter');
    const min = numberValue('#wl-price-min');
    const max = numberValue('#wl-price-max');

    return wishlist.filter(function (entry) {
      if (name && String(entry.name || '').toLowerCase().indexOf(name) === -1) {
        return false;
      }
      if (theme && entry.theme !== theme) {
        return false;
      }
      if (member && entry.member !== member) {
        return false;
      }
      if (priority && entry.priority !== priority) {
        return false;
      }
      return priceMatches(entry.officialPrice, min, max);
    });
  }

  function compareWishlist(a, b) {
    const x = a[wishlistSortKey];
    const y = b[wishlistSortKey];
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * wishlistSortDir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * wishlistSortDir;
  }

  function renderWishlist() {
    fillWishlistFilterOptions();
    const rows = filteredWishlist().sort(compareWishlist);
    report('#wishlist-summary', rows.length + ' of ' + wishlist.length + ' wishlisted sets');

    $('#wishlist thead th[data-key]').removeClass('sort-asc sort-desc')
      .filter('[data-key="' + wishlistSortKey + '"]')
      .addClass(wishlistSortDir > 0 ? 'sort-asc' : 'sort-desc');

    const $tbody = $('#wishlist tbody').empty();
    if (rows.length === 0) {
      $tbody.append('<tr><td colspan="11" class="muted">No wishlisted sets match the filters.</td></tr>');
      return;
    }

    rows.forEach(function (entry) {
      const $tr = $('<tr></tr>');

      const $imageCell = $('<td></td>');
      if (entry.imageUrl) {
        $imageCell.append($('<img class="wishlist-img" loading="lazy">')
          .attr('src', entry.imageUrl).attr('alt', entry.name || entry.setNumber));
      }
      $tr.append($imageCell);

      $tr.append($('<td></td>').text(entry.setNumber || ''));
      $tr.append($('<td></td>').text(entry.name || ''));
      $tr.append($('<td></td>').text(entry.year == null ? '' : entry.year));
      $tr.append($('<td></td>').text(entry.numParts == null ? '' : fmt.number(entry.numParts)));
      $tr.append($('<td></td>').append(themeChip(entry.theme, entry.themeImageUrl, entry.themeColor)));
      $tr.append($('<td></td>').text(entry.officialPrice == null ? '' : fmt.money(entry.officialPrice)));
      $tr.append($('<td></td>').text(entry.member || ''));
      $tr.append($('<td></td>').append(
        $('<span class="priority"></span>')
          .addClass('priority-' + String(entry.priority || '').toLowerCase())
          .text(entry.priority || '')));
      $tr.append($('<td></td>').text(entry.wishlistDate || ''));

      const $actions = $('<td class="row-actions"></td>');
      $actions.append($('<button type="button" class="btn wishlist-buy">Buy</button>')
        .attr('data-wishlist-id', entry.id));
      $actions.append($('<button type="button" class="btn secondary wishlist-edit">Edit</button>')
        .attr('data-wishlist-id', entry.id));
      $actions.append($('<button type="button" class="btn danger wishlist-delete">Delete</button>')
        .attr('data-wishlist-id', entry.id));
      $tr.append($actions);

      $tbody.append($tr);
    });
  }

  function findSet(setNumber) {
    return catalog.sets.find(set => set.setNumber === setNumber);
  }

  function findWishlistEntry(id) {
    return wishlist.find(entry => String(entry.id) === String(id));
  }

  function openWishlistForm(entry, set) {
    report('#wishlist-form-msg', '');
    const setNumber = entry ? entry.setNumber : set.setNumber;
    const name = entry ? entry.name : set.name;
    const numParts = entry ? entry.numParts : set.numParts;
    const facts = ['#' + setNumber];
    if (name) facts.push(name);
    if (numParts != null) facts.push(fmt.number(numParts) + ' parts');

    $('#wishlist-id').val(entry ? entry.id : '');
    $('#wishlist-set-number').val(setNumber);
    $('#wishlist-set').text(facts.join(' · '));
    $('#wishlist-title').text(entry ? 'Edit wishlist entry' : 'Add to wishlist');
    fillSelect('#wishlist-member', options.members || [], false);
    fillSelect('#wishlist-priority', options.priorities || [], false);
    $('#wishlist-member').val(entry ? entry.member : (options.members || [])[0] || '');
    $('#wishlist-priority').val(entry ? entry.priority : 'Medium');
    $('#wishlist-date').val(entry ? entry.wishlistDate : today());

    const hasMember = (options.members || []).length > 0;
    $('#wishlist-form button[type="submit"]').prop('disabled', !hasMember);
    if (!hasMember) {
      report('#wishlist-form-msg', 'No family member is available. Add people to data/other/people/people.csv first.');
    }
    $('#wishlist-modal').prop('hidden', false);
  }

  function closeWishlistForm() {
    $('#wishlist-modal').prop('hidden', true);
  }

  $('#set-filters').on('input', 'input[type="search"]', debounce(function () { renderSets(); }, 250));
  $('#set-filters').on('change', 'select, input[type="number"], input[type="checkbox"]', function () { renderSets(); });
  $('#ns-theme').on('change', function () { rootFilter = ''; });
  $('#ns-reset').on('click', function () {
    $('#set-filters').find('input[type="search"], input[type="number"]').val('');
    $('#ns-theme').val('');
    $('#ns-wishlisted').prop('checked', false);
    rootFilter = '';
    renderSets();
  });
  $('#theme-root-group').on('change', renderThemes);

  $('#set-cards').on('click', '.set-card', function (e) {
    if ($(e.target).closest('button, a, input, select, label, textarea').length) {
      return;
    }
    BrickTools.openSetSites($(this).attr('data-set-number'));
  });

  $('#set-cards').on('click', '.wishlist-toggle', function () {
    const setNumber = $(this).attr('data-set-number');
    const entry = wishlistBySet.get(setNumber);
    if (entry) {
      if (!window.confirm('Remove ' + (entry.name || setNumber) + ' from the wishlist?')) {
        return;
      }
      BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
        .done(reloadWishlist)
        .fail(function (xhr) { report('#newsets-msg', BrickTools.errorOf(xhr)); });
      return;
    }
    const set = findSet(setNumber);
    if (set) {
      openWishlistForm(null, set);
    }
  });

  $('#wishlist-filters').on('input', 'input[type="search"]', debounce(renderWishlist, 200));
  $('#wishlist-filters').on('change', 'select, input[type="number"]', renderWishlist);
  $('#wl-reset').on('click', function () {
    $('#wishlist-filters').find('input[type="search"], input[type="number"]').val('');
    $('#wishlist-filters').find('select').val('');
    renderWishlist();
  });

  $('#wishlist thead').on('click', 'th[data-key]', function () {
    const key = $(this).attr('data-key');
    wishlistSortDir = wishlistSortKey === key ? -wishlistSortDir : 1;
    wishlistSortKey = key;
    renderWishlist();
  });

  function buyWishlistEntry(entry, $button) {
    const label = entry.name || entry.setNumber;
    const price = entry.officialPrice == null ? null : entry.officialPrice;
    const priceText = price == null ? 'no official price' : fmt.money(price);
    const message = 'Buy ' + label + ' (' + priceText + ')?\n\n'
      + 'This records the purchase and removes the set from the wishlist.';
    if (!window.confirm(message)) {
      return;
    }
    $button.prop('disabled', true);
    BrickTools.api('POST', '/purchases', {
      setNumber: entry.setNumber,
      purchasePrice: price,
      purchaseDate: today(),
      vendor: '',
      broughtBy: '',
      owner: entry.member || '',
      partMissings: 0,
      owned: true,
      reason: ''
    }).done(function () {
      const redirect = function () { window.location.href = 'purchases.html#list'; };
      if (entry.id == null) {
        redirect();
        return;
      }
      BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
        .always(redirect);
    }).fail(function (xhr) {
      $button.prop('disabled', false);
      report('#newsets-msg', BrickTools.errorOf(xhr));
    });
  }

  $('#wishlist tbody').on('click', '.wishlist-buy', function () {
    const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
    if (entry) {
      buyWishlistEntry(entry, $(this));
    }
  });

  $('#wishlist tbody').on('click', '.wishlist-edit', function () {
    const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
    if (entry) {
      openWishlistForm(entry, null);
    }
  });

  $('#wishlist tbody').on('click', '.wishlist-delete', function () {
    const entry = findWishlistEntry($(this).attr('data-wishlist-id'));
    if (!entry || !window.confirm('Delete ' + (entry.name || entry.setNumber) + ' from the wishlist?')) {
      return;
    }
    BrickTools.api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
      .done(reloadWishlist)
      .fail(function (xhr) { report('#newsets-msg', BrickTools.errorOf(xhr)); });
  });

  $('#wishlist-cancel').on('click', closeWishlistForm);

  $('#wishlist-form').on('submit', function (event) {
    event.preventDefault();
    const id = $('#wishlist-id').val();
    const body = {
      setNumber: $.trim($('#wishlist-set-number').val()),
      wishlistDate: $.trim($('#wishlist-date').val()),
      member: $('#wishlist-member').val() || '',
      priority: $('#wishlist-priority').val() || ''
    };
    const request = id
      ? BrickTools.api('PUT', '/wishlist/' + encodeURIComponent(id), body)
      : BrickTools.api('POST', '/wishlist', body);
    request
      .done(function () {
        closeWishlistForm();
        reloadWishlist();
      })
      .fail(function (xhr) { report('#wishlist-form-msg', BrickTools.errorOf(xhr)); });
  });

  BrickTools.initTabs('main', function (name) {
    if (name === 'sets') {
      renderSets(!forceSetReset);
      forceSetReset = false;
    } else if (name === 'wishlist') {
      renderWishlist();
    } else if (name === 'themes') {
      renderThemes();
    }
  });

  setupSetObserver();
  loadAll();
});
