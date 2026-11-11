(function (window, $) {
  'use strict';

  const NAV = [
    { id: 'purchases', label: 'Sets Purchase', href: 'purchases.html' },
    { id: 'brickowl', label: 'BrickOwl', href: 'brickowl.html' },
    { id: 'partscollection', label: 'Parts Collection', href: 'partscollection.html' },
    { id: 'newsets', label: 'New Sets', href: 'newsets.html' },
    { id: 'admin', label: 'Administration', href: 'admin.html' }
  ];

  const LAST_PAGE_KEY = 'bricktools.lastPage';
  const TAB_KEY_PREFIX = 'bricktools.tab.';
  const ACTIVE_CONTAINER_KEY = 'bricktools.activeContainer';

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // Storage may be unavailable (for example in private mode); persistence is optional.
    }
  }

  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

  const fmt = {
    money: v => (v == null || v === '') ? '' : euro.format(Number(v)),
    number: v => (v == null || v === '') ? '' : number.format(Number(v)),
    percent: v => (v == null || v === '') ? '' : number.format(Number(v)) + ' %'
  };

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

  function today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
  }

  function esc(value) {
    return $('<span>').text(value == null ? '' : String(value)).html();
  }

  function hue(value) {
    let hash = 0;
    for (const ch of value) {
      hash = (hash * 31 + ch.codePointAt(0)) % 360;
    }
    return hash;
  }

  function tag(value) {
    if (!value) {
      return null;
    }
    const h = hue(value);
    return $('<span class="tag"></span>').text(value).css({
      background: 'hsl(' + h + ' 75% 88%)',
      color: 'hsl(' + h + ' 60% 25%)'
    });
  }

  function errorOf(xhr) {
    return (xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText || 'Request failed';
  }

  function api(method, url, body) {
    const settings = {
      url: '/api' + url,
      method: method,
      dataType: 'json',
      contentType: body ? 'application/json' : undefined,
      data: body ? JSON.stringify(body) : undefined
    };
    if (method === 'GET') {
      // Always read fresh data; the browser otherwise reuses cached API responses.
      settings.cache = false;
    }
    return $.ajax(settings);
  }

  function loadNotifications() {
    api('GET', '/notifications').done(function (items) {
      $('#app-header .badge').text(items.length).prop('hidden', items.length === 0);
      const $list = $('#app-header .dropdown').empty();
      if (items.length === 0) {
        $list.append($('<p class="muted"></p>').text('No notifications'));
      }
      items.forEach(function (n) {
        $list.append($('<a class="notification"></a>').attr('href', n.link).text(n.message));
      });
    });
  }

  // ============================================================================
  // Active container
  // ============================================================================

  function getActiveContainer() {
    const raw = storageGet(ACTIVE_CONTAINER_KEY);
    if (!raw) {
      return null;
    }
    try {
      const container = JSON.parse(raw);
      return container && container.type ? container : null;
    } catch (e) {
      return null;
    }
  }

  function activeContainerLabel(container) {
    if (!container) {
      return '';
    }
    switch (container.type) {
      case 'storage':
        return 'Storage ' + (container.storageId || '');
      case 'drawer':
        return 'Storage ' + (container.storageId || '') + ' · Drawer '
          + (container.drawer === '' || container.drawer == null ? '—' : container.drawer);
      case 'pab':
        return 'PaB purchase #' + (container.purchaseId == null ? '' : container.purchaseId);
      case 'brickowl':
        return 'BrickOwl order ' + (container.orderId || '');
      default:
        return container.label || container.type;
    }
  }

  function activeContainerDetail(container) {
    if (!container) {
      return '';
    }
    if (container.type === 'drawer' || container.type === 'storage') {
      return [container.storageModel, container.storageLocation].filter(Boolean).join(' · ');
    }
    return container.detail || '';
  }

  function drawerListOf(container) {
    return container && Array.isArray(container.drawers) ? container.drawers : [];
  }

  function stepActiveDrawer(direction) {
    const container = getActiveContainer();
    if (!container || container.type !== 'drawer') {
      return;
    }
    const drawers = drawerListOf(container);
    const index = drawers.findIndex(function (drawer) {
      return String(drawer.storageId) === String(container.storageId)
        && String(drawer.drawer) === String(container.drawer);
    });
    const next = index + direction;
    if (index < 0 || next < 0 || next >= drawers.length) {
      return;
    }
    const target = drawers[next];
    setActiveContainer({
      type: 'drawer',
      storageId: target.storageId,
      storageModel: target.storageModel,
      storageLocation: target.storageLocation,
      drawer: target.drawer,
      drawers: drawers
    });
  }

  function renderActiveContainer() {
    const $host = $('#app-header .active-container');
    if (!$host.length) {
      return;
    }
    const container = getActiveContainer();
    $host.empty();
    if (!container) {
      $host.append($('<span class="active-container-empty"></span>')
        .text('No active container'));
      return;
    }
    const drawers = drawerListOf(container);
    const index = drawers.findIndex(function (drawer) {
      return String(drawer.storageId) === String(container.storageId)
        && String(drawer.drawer) === String(container.drawer);
    });
    const label = activeContainerLabel(container);
    const detail = activeContainerDetail(container);

    if (container.type === 'drawer' && drawers.length > 1) {
      $host.append($('<button type="button" class="active-container-nav active-container-prev"></button>')
        .attr('title', 'Previous drawer')
        .attr('aria-label', 'Previous drawer')
        .prop('disabled', index <= 0)
        .html('&#8249;'));
    }
    const $label = $('<span class="active-container-label"></span>')
      .text(label)
      .attr('title', [label, detail].filter(Boolean).join(' — '));
    $host.append($label);
    if (container.type === 'drawer' && drawers.length > 1) {
      $host.append($('<button type="button" class="active-container-nav active-container-next"></button>')
        .attr('title', 'Next drawer')
        .attr('aria-label', 'Next drawer')
        .prop('disabled', index < 0 || index >= drawers.length - 1)
        .html('&#8250;'));
    }
    $host.append($('<button type="button" class="active-container-clear"></button>')
      .attr('title', 'Clear active container')
      .attr('aria-label', 'Clear active container')
      .html('&times;'));
  }

  function setActiveContainer(container) {
    if (container) {
      storageSet(ACTIVE_CONTAINER_KEY, JSON.stringify(container));
    } else {
      storageSet(ACTIVE_CONTAINER_KEY, '');
    }
    renderActiveContainer();
    $(document).trigger('bricktools:active-container-changed', [container || null]);
  }

  function addToActiveContainer(partNumbers) {
    const container = getActiveContainer();
    const numbers = (partNumbers || []).filter(function (partNumber) {
      return String(partNumber == null ? '' : partNumber).trim() !== '';
    });
    if (!container) {
      return $.Deferred().reject({
        responseJSON: { error: 'No active container. Set one from the Parts Collection page.' }
      }).promise();
    }
    if (numbers.length === 0) {
      return $.Deferred().reject({
        responseJSON: { error: 'No part selected.' }
      }).promise();
    }
    return api('POST', '/part-collection/add', {
      type: container.type,
      storageId: container.storageId,
      drawer: container.drawer,
      purchaseId: container.purchaseId,
      orderId: container.orderId,
      partNumbers: numbers
    }).done(function (result) {
      $(document).trigger('bricktools:container-parts-added', [container, result]);
    });
  }

  function initHeader(activeId) {
    if (activeId) {
      const page = NAV.find(n => n.id === activeId);
      if (page) {
        storageSet(LAST_PAGE_KEY, page.href);
      }
    } else if (!new URLSearchParams(window.location.search).has('home')) {
      const lastPage = storageGet(LAST_PAGE_KEY);
      if (lastPage && NAV.some(n => n.href === lastPage)) {
        window.location.replace(lastPage);
        return;
      }
    }

    const links = NAV.map(n =>
      '<a href="' + n.href + '"' + (n.id === activeId ? ' class="active"' : '') + '>' + n.label + '</a>'
    ).join('');

    $('#app-header').html(
      '<a class="brand" href="index.html?home=1">Brick Tools</a>' +
      '<nav>' + links + '</nav>' +
      '<div class="active-container" id="active-container"></div>' +
      '<div class="notifications">' +
      '<button type="button" class="bell" title="Notifications">&#128276;<span class="badge" hidden></span></button>' +
      '<div class="dropdown" hidden></div>' +
      '</div>'
    );

    $('#app-header').on('click', '.active-container-prev', function () {
      stepActiveDrawer(-1);
    });
    $('#app-header').on('click', '.active-container-next', function () {
      stepActiveDrawer(1);
    });
    $('#app-header').on('click', '.active-container-clear', function () {
      setActiveContainer(null);
    });

    $('#app-header .bell').on('click', function (e) {
      e.stopPropagation();
      $('#app-header .dropdown').prop('hidden', function (i, hidden) { return !hidden; });
    });
    $(document).on('click', function () {
      $('#app-header .dropdown').prop('hidden', true);
    });

    renderActiveContainer();
    loadNotifications();
    setInterval(loadNotifications, 5 * 60 * 1000);
  }

  function initTabs(container, onChange) {
    const $root = $(container);
    const tabKey = TAB_KEY_PREFIX + window.location.pathname;

    function activate($tab) {
      const name = String($tab.data('tab'));
      $root.find('[data-tab]').removeClass('active');
      $tab.addClass('active');
      $root.find('[data-panel]').prop('hidden', true);
      $root.find('[data-panel="' + name + '"]').prop('hidden', false);
      storageSet(tabKey, name);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '',
          window.location.pathname + window.location.search + '#' + name);
      }
      if (onChange) {
        onChange(name);
      }
    }

    $root.find('[data-tab]').on('click', function () {
      activate($(this));
    });

    const hash = String(window.location.hash || '').replace(/^#/, '');
    const wanted = hash || storageGet(tabKey);
    if (!wanted) {
      return;
    }
    const $tab = $root.find('[data-tab]').filter(function () {
      return String($(this).data('tab')) === wanted;
    }).first();
    if (!$tab.length) {
      return;
    }
    if ($tab.hasClass('active')) {
      // The page already initializes its default tab.
      storageSet(tabKey, wanted);
      return;
    }
    activate($tab);
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function rememberedOption(name, choices, fallback) {
    const value = getCookie(name);
    return choices.indexOf(value) === -1 ? fallback : value;
  }

  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  /**
   * Returns a cleaned name with the following transformations:
   * - remove `LEGO` at the start of the name
   * - remove the color name (column ColorName)
   * - remove the part numbers inside the last parenthesis at the end
   */
  function getPartNameFromBOName(name, colorName = null) {
    let result = name;

    // Remove "LEGO" from start (with optional whitespace after it)
    result = result.replace(/^LEGO\s*/, '');

    // Remove the color name if provided via ColorName column
    if (colorName && typeof colorName === 'string' && colorName.trim()) {
      const cleanColorName = colorName.trim();
      // Case-insensitive match of standalone color word followed by whitespace or end of string
      result = result.replace(new RegExp(`\\b${cleanColorName}\\s*`, 'i'), '');
    }

    // Remove parentheses with numbers at the end (e.g., (7538), (4175 / 31593))
    result = result.replace(/\(\d+(?:\s*\/\s*\d+)?\)\s*$/, '');

    return result.trim();
  }

  /**
   * Builds a table cell with a lazy-loaded part image. The first source is shown and, when it
   * fails, the next one is tried; the image is hidden when no source can be loaded. When a part
   * number is given, clicking the image opens the part information modal.
   */
  function partImageCell(sources, label, partNumber) {
    const $cell = $('<td class="part-image"></td>');
    const urls = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
    if (urls.length === 0) {
      return $cell;
    }
    let next = 1;
    const $img = $('<img class="part-img" loading="lazy" alt="">')
      .attr('alt', label || '')
      .attr('title', label || '')
      .on('error', function () {
        if (next < urls.length) {
          this.src = urls[next++];
        } else {
          $(this).prop('hidden', true);
        }
      })
      .attr('src', urls[0]);
    if (partNumber) {
      $img.attr('data-part-number', partNumber)
        .attr('tabindex', '0')
        .attr('role', 'button')
        .attr('aria-label', 'Part information for ' + (label || partNumber));
    }
    $cell.append($img);
    return $cell;
  }

  /**
   * Returns the first non-empty value of a comma-separated list.
   */
  function firstCommaValue(value) {
    return String(value || '').split(',')
      .map(function (item) { return item.trim(); })
      .filter(Boolean)[0] || '';
  }

  function itemImageUrls(itemNumbers) {
    const seen = new Set();
    return String(itemNumbers || '').split(',')
      .map(function (value) { return value.trim(); })
      .filter(function (value) {
        if (!value || seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      })
      .map(function (value) {
        return '/api/parts/items/' + encodeURIComponent(value) + '/image';
      });
  }

  /**
   * Returns the image sources of a BrickOwl item: the exact part/color images of its item numbers
   * first, then a generic image of its first design id.
   */
  function partImageUrls(itemNumbers, designIds) {
    const urls = itemImageUrls(itemNumbers);
    const designId = String(designIds || '').split(',')
      .map(function (value) { return value.trim(); })
      .filter(Boolean)[0];
    if (designId) {
      urls.push('/api/parts/' + encodeURIComponent(designId) + '/image');
    }
    return urls;
  }

  window.BrickTools = {
    api, errorOf, esc, fmt, tag, initHeader, initTabs,
    getCookie, setCookie, rememberedOption, today, readableText, getPartNameFromBOName,
    partImageCell, firstCommaValue, itemImageUrls, partImageUrls,
    getActiveContainer, setActiveContainer, addToActiveContainer, activeContainerLabel
  };
})(window, jQuery);
