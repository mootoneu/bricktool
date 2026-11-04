(function (window, $) {
  'use strict';

  const NAV = [
    { id: 'admin', label: 'Administration', href: 'admin.html' },
    { id: 'brickowl', label: 'BrickOwl', href: 'brickowl.html' },
    { id: 'newsets', label: 'New Sets', href: 'newsets.html' },
    { id: 'purchases', label: 'Sets Purchase', href: 'purchases.html' }
  ];

  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

  // External websites that can show the details of a set. $SetNumber is replaced
  // by the set number and the image is shown as a clickable tile in the modal.
  const SET_SITES = [
    {
      id: 'lego',
      label: 'Lego',
      image: 'img/sites/lego.png',
      url: 'https://www.lego.com/fr-fr/product/$SetNumber'
    },
    {
      id: 'lego-instructions',
      label: 'Lego instructions',
      image: 'img/sites/lego.png',
      url: 'https://www.lego.com/fr-fr/service/building-instructions/$SetNumber'
    },
    {
      id: 'rebrickable',
      label: 'Rebrickable',
      image: 'img/sites/rebrickable.png',
      url: 'https://rebrickable.com/sets/$SetNumber'
    },
    {
      id: 'bricklink',
      label: 'BrickLink',
      image: 'img/sites/bricklink.png',
      url: 'https://www.bricklink.com/v2/catalog/catalogitem.page?S=$SetNumber'
    },
    {
      id: 'brickowl',
      label: 'BrickOwl',
      image: 'img/sites/brickowl.svg',
      url: 'https://www.brickowl.com/search/catalog?cat=3&query=$SetNumber'
    },
    {
      id: 'brickwatch',
      label: 'BrickWatch',
      image: 'img/sites/brickwatch.png',
      url: 'https://www.brickwatch.net/fr-FR/set/$SetNumber'
    },
    {
      id: 'amazon',
      label: 'Amazon',
      image: 'img/sites/amazon.svg',
      url: 'https://www.amazon.fr/s?k=Lego+$SetNumber'
    },
    {
      id: 'fnac',
      label: 'Fnac',
      image: 'img/sites/fnac.png',
      url: 'https://www.fnac.com/SearchResult/ResultList.aspx?Search=Lego+$SetNumber&sft=1&sa=0'
    },
    {
      id: 'cdiscount',
      label: 'CDiscount',
      image: 'img/sites/cdiscount.svg',
      url: 'https://www.cdiscount.com/search/10/Lego+$SetNumber.html'
    }
  ];

  const fmt = {
    money: v => (v == null || v === '') ? '' : euro.format(Number(v)),
    number: v => (v == null || v === '') ? '' : number.format(Number(v)),
    percent: v => (v == null || v === '') ? '' : number.format(Number(v)) + ' %'
  };

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

  function initHeader(activeId) {
    const links = NAV.map(n =>
      '<a href="' + n.href + '"' + (n.id === activeId ? ' class="active"' : '') + '>' + n.label + '</a>'
    ).join('');

    $('#app-header').html(
      '<a class="brand" href="index.html">Brick Tools</a>' +
      '<nav>' + links + '</nav>' +
      '<div class="notifications">' +
      '<button type="button" class="bell" title="Notifications">&#128276;<span class="badge" hidden></span></button>' +
      '<div class="dropdown" hidden></div>' +
      '</div>'
    );

    $('#app-header .bell').on('click', function (e) {
      e.stopPropagation();
      $('#app-header .dropdown').prop('hidden', function (i, hidden) { return !hidden; });
    });
    $(document).on('click', function () {
      $('#app-header .dropdown').prop('hidden', true);
    });

    loadNotifications();
    setInterval(loadNotifications, 5 * 60 * 1000);
  }

  function initTabs(container, onChange) {
    const $root = $(container);
    $root.find('[data-tab]').on('click', function () {
      const name = $(this).data('tab');
      $root.find('[data-tab]').removeClass('active');
      $(this).addClass('active');
      $root.find('[data-panel]').prop('hidden', true);
      $root.find('[data-panel="' + name + '"]').prop('hidden', false);
      if (onChange) {
        onChange(name);
      }
    });

    const initial = String(window.location.hash || '').replace(/^#/, '');
    if (initial) {
      const $tab = $root.find('[data-tab]').filter(function () {
        return String($(this).data('tab')) === initial;
      });
      if ($tab.length) {
        $tab.first().trigger('click');
      }
    }
  }

  let $siteModal = null;

  function siteUrl(site, setNumber) {
    return site.url.split('$SetNumber').join(encodeURIComponent(setNumber));
  }

  function closeSetSites() {
    if ($siteModal) {
      $siteModal.prop('hidden', true);
    }
  }

  function ensureSiteModal() {
    if ($siteModal) {
      return $siteModal;
    }
    $siteModal = $(
      '<div id="set-sites-modal" class="modal" hidden>' +
        '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="set-sites-title">' +
          '<div class="modal-head">' +
            '<h2 id="set-sites-title">Set</h2>' +
            '<button type="button" class="modal-close" aria-label="Close">&times;</button>' +
          '</div>' +
          '<p class="modal-sub">Open this set on an external website.</p>' +
          '<div id="set-sites-grid" class="site-grid"></div>' +
        '</div>' +
      '</div>'
    );
    $siteModal.on('click', function (e) {
      if (e.target === this) {
        closeSetSites();
      }
    });
    $siteModal.on('click', '.modal-close', closeSetSites);
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && !$siteModal.prop('hidden')) {
        closeSetSites();
      }
    });
    $('body').append($siteModal);
    return $siteModal;
  }

  function openSetSites(setNumber) {
    const value = $.trim(setNumber == null ? '' : String(setNumber));
    if (!value) {
      return;
    }
    const $modal = ensureSiteModal();
    $('#set-sites-title').text('Set ' + value);

    const $grid = $('#set-sites-grid').empty();
    SET_SITES.forEach(function (site) {
      const $image = $('<img loading="lazy">')
        .attr('src', site.image)
        .attr('alt', site.label);
      $image.on('error', function () {
        $(this).remove();
      });
      $grid.append(
        $('<a class="site-tile"></a>')
          .attr('data-site', site.id)
          .attr('href', siteUrl(site, value))
          .attr('target', '_blank')
          .attr('rel', 'noopener noreferrer')
          .attr('title', site.label + ' (opens in a new tab)')
          .append($('<span class="site-logo"></span>').append($image))
          .append($('<span class="site-label"></span>').text(site.label))
      );
    });

    $modal.prop('hidden', false);
    $modal.find('.modal-close').trigger('focus');
  }

  window.BrickTools = {
    api, errorOf, esc, fmt, tag, initHeader, initTabs, closeSetSites, openSetSites
  };
})(window, jQuery);
