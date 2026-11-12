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

  // ============================================================================
  // Icons
  // ============================================================================

  // Inline, stroke-based icons. Keeping them in one place avoids an icon
  // dependency and lets static markup and dynamic rows share the same shapes.
  const ICONS = {
    add: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    delete: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    view: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    active: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>',
    buy: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11.2L21 7H6"/>',
    inventory: '<path d="M4 5h16v4H4z"/><path d="M6 9v10h12V9"/><path d="M10 13h4"/>',
    parts: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    sync: '<path d="M20 7A8 8 0 0 0 6 5.5L4 8"/><path d="M4 3v5h5"/><path d="M4 17a8 8 0 0 0 14 1.5L20 16"/><path d="M20 21v-5h-5"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1.5 6"/><path d="M4 5v5h5"/>',
    download: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 16l-5-5L6 20"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/>',
    generate: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    selectAll: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>',
    clear: '<path d="M4 6h16"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10l4 6M14 10l-4 6"/>',
    check: '<path d="M5 12l4.5 4.5L19 7"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    price: '<path d="M20 12l-8 8-8-8V4h8z"/><circle cx="8" cy="8" r="1.4"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>'
  };

  /**
   * Returns the inline SVG markup of an icon, or an empty string when the name
   * is unknown.
   */
  function icon(name) {
    const paths = ICONS[name];
    if (!paths) {
      return '';
    }
    return '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }

  /**
   * Builds an icon-only button with a tooltip and an accessible label.
   */
  function iconButton(name, label, extraClass) {
    return $('<button type="button"></button>')
      .addClass('btn icon-btn ' + (extraClass || 'secondary'))
      .attr('title', label)
      .attr('aria-label', label)
      .html(icon(name));
  }

  /**
   * Adds icons to elements marked with `data-icon`. Icon-only elements receive
   * the icon as their content; other elements get it before their label.
   * Calling this again is harmless, so dynamically inserted markup can use it.
   */
  function decorateIcons(root) {
    $(root || document).find('[data-icon]').each(function () {
      const $el = $(this);
      if ($el.children('svg.icon').length) {
        return;
      }
      const markup = icon($el.attr('data-icon'));
      if (!markup) {
        return;
      }
      if ($el.hasClass('icon-only')) {
        $el.html(markup);
        if (!$el.attr('aria-label') && $el.attr('title')) {
          $el.attr('aria-label', $el.attr('title'));
        }
      } else {
        $el.prepend(markup + ' ');
      }
    });
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
        return (container.storageId || '');
      case 'drawer':
        return (container.storageId || '') + '·'
          + (container.drawer === '' || container.drawer == null ? '—' : container.drawer);
      case 'pab':
        return 'PaB' + (container.purchaseId == null ? '' : container.purchaseId);
      case 'brickowl':
        return 'BO' + (container.orderId || '');
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
        .html(icon('chevronLeft')));
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
        .html(icon('chevronRight')));
    }
    $host.append($('<button type="button" class="active-container-clear"></button>')
      .attr('title', 'Clear active container')
      .attr('aria-label', 'Clear active container')
      .html(icon('close')));
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
      '<a class="brand" href="index.html?home=1">' +
      '<span class="brand-mark" aria-hidden="true"></span>Brick Tools</a>' +
      '<nav>' + links + '</nav>' +
      '<div class="active-container" id="active-container"></div>' +
      '<div class="notifications">' +
      '<button type="button" class="bell" title="Notifications" aria-label="Notifications">' +
      icon('bell') + '<span class="badge" hidden></span></button>' +
      '<div class="dropdown" hidden></div>' +
      '</div>'
    );

    // On narrow screens the navigation scrolls horizontally. Keep the active
    // page visible instead of leaving it outside the initial viewport.
    const $activeLink = $('#app-header nav a.active');
    if ($activeLink.length) {
      const nav = $activeLink[0].parentElement;
      const navRect = nav.getBoundingClientRect();
      const linkRect = $activeLink[0].getBoundingClientRect();
      nav.scrollLeft = Math.max(0,
        nav.scrollLeft + linkRect.left - navRect.left - (nav.clientWidth - linkRect.width) / 2);
    }

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

  $(function () {
    decorateIcons(document);
  });

  window.BrickTools = {
    api, errorOf, esc, fmt, tag, initHeader, initTabs,
    getCookie, setCookie, rememberedOption, today, readableText, getPartNameFromBOName,
    partImageCell, firstCommaValue, itemImageUrls, partImageUrls,
    getActiveContainer, setActiveContainer, addToActiveContainer, activeContainerLabel,
    icon, iconButton, decorateIcons
  };
})(window, jQuery);
