(function (window, $) {
  'use strict';

  const api = window.BrickTools.api;
  const errorOf = window.BrickTools.errorOf;
  const fmt = window.BrickTools.fmt;
  const today = window.BrickTools.today;
  const rememberedOption = window.BrickTools.rememberedOption;
  const setCookie = window.BrickTools.setCookie;
  const readableText = window.BrickTools.readableText;

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
      id: 'brickonomics',
      label: 'Brickonomics',
      image: 'img/sites/brickonomics.png',
      url: 'https://brickonomics.net/set/$SetNumber-1'
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

  function themeBadge(theme, imageUrl, color) {
    const label = String(theme || '').trim() || 'Unknown theme';
    const $chip = $('<span class="theme-chip"></span>').attr('title', label);
    if (color) {
      $chip.css({ 'background-color': color, color: readableText(color) });
    }
    if (imageUrl) {
      $chip.append($('<img loading="lazy">')
        .attr('src', imageUrl)
        .attr('alt', label)
        .on('error', function () {
          $(this).remove();
        }));
    } else {
      $chip.text(label);
    }
    return $chip;
  }

  let $siteModal = null;
  let siteContext = null;
  let siteRequest = 0;

  function siteUrl(site, setNumber) {
    return site.url.split('$SetNumber').join(encodeURIComponent(setNumber));
  }

  function closeSetSites() {
    if ($siteModal) {
      $siteModal.prop('hidden', true);
    }
  }

  function navigateSet(direction) {
    if (!siteContext || !siteContext.setNumber) {
      return;
    }
    // Check if we're on the newsets page with filtered sets
    if (typeof BrickTools.NewSetsShared !== 'undefined') {
      const filteredSets = BrickTools.NewSetsShared.getFilteredSetRows();
      if (filteredSets && filteredSets.length > 0) {
        const currentIndex = filteredSets.findIndex(function(set) {
          return String(set.setNumber) === String(siteContext.setNumber);
        });
        if (currentIndex !== -1) {
          const nextIndex = currentIndex + direction;
          if (nextIndex >= 0 && nextIndex < filteredSets.length) {
            const nextSet = filteredSets[nextIndex];
            openSetSites(nextSet.setNumber, nextSet);
          }
        }
        return;
      }
    }
    // Fallback for other contexts (if not on newsets page)
    // This would require a different approach for other pages
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
          '<div class="set-sites-detail">' +
            '<div id="set-sites-image" class="set-sites-image"></div>' +
            '<div id="set-sites-theme" class="set-sites-theme"></div>' +
            '<p id="set-sites-meta" class="set-sites-meta"></p>' +
            '<div class="set-sites-links">' +
              '<a id="set-sites-inventory-link" class="btn secondary" href="purchases.html#set-inventory">Open in Set Inventory</a>' +
            '</div>' +
            '<div id="set-sites-actions" class="set-sites-actions"></div>' +
            '<p id="set-sites-action-msg" class="set-sites-action-msg message"></p>' +
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
      if (!$siteModal || $siteModal.prop('hidden')) {
        return;
      }
      if (e.key === 'Escape') {
        closeSetSites();
      } else if (e.key === 'ArrowLeft') {
        navigateSet(-1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        navigateSet(1);
        e.preventDefault();
      }
    });
    $('body').append($siteModal);
    return $siteModal;
  }

  function renderSiteLinks(setNumber) {
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
          .attr('href', siteUrl(site, setNumber))
          .attr('target', '_blank')
          .attr('rel', 'noopener noreferrer')
          .attr('title', site.label + ' (opens in a new tab)')
          .append($('<span class="site-logo"></span>').append($image))
          .append($('<span class="site-label"></span>').text(site.label))
      );
    });
  }

  function renderSetDetails(details, setNumber) {
    const data = details || {};
    const name = String(data.name || '').trim();
    $('#set-sites-title').text(name || ('Set ' + setNumber));

    const $image = $('#set-sites-image').empty();
    if (data.imageUrl) {
      $image.append($('<img loading="lazy">')
        .attr('src', data.imageUrl)
        .attr('alt', name || ('Set ' + setNumber)));
    } else {
      $image.append($('<span class="set-card-noimg"></span>').text('No image'));
    }

    $('#set-sites-theme').empty().append(themeBadge(data.theme, data.themeImageUrl, data.themeColor));
    if (data.themeImageUrl) {
      $('#set-sites-theme').append($('<span class="set-sites-theme-name"></span>')
        .text(String(data.theme || '').trim() || 'Unknown theme'));
    }

    const meta = ['#' + setNumber];
    if (data.numParts != null) {
      meta.push(fmt.number(data.numParts) + ' parts');
    }
    if (data.officialPrice != null) {
      meta.push(fmt.money(data.officialPrice));
    }
    if (data.year != null) {
      meta.push(data.year);
    }
    $('#set-sites-meta').text(meta.join(' · '));
    $('#set-sites-inventory-link')
      .attr('data-set-number', setNumber)
      .attr('href', 'purchases.html?set=' + encodeURIComponent(setNumber) + '#set-inventory');
  }

  function renderSetAction() {
    const $actions = $('#set-sites-actions').empty();
    if (!siteContext) {
      return;
    }
    const $button = $('<button type="button" class="btn"></button>')
      .text(siteContext.entry ? 'Buy' : 'Save to wishlist');
    $button.on('click', siteContext.entry ? buySet : saveSetToWishlist);
    $actions.append($button);
  }

  function saveSetToWishlist() {
    const context = siteContext;
    if (!context) {
      return;
    }
    const $button = $('#set-sites-actions .btn').prop('disabled', true);
    const $message = $('#set-sites-action-msg').text('Saving to wishlist…');
    api('GET', '/wishlist/options')
      .done(function (options) {
        const members = (options && options.members) || [];
        const priorities = (options && options.priorities) || [];
        const member = rememberedOption('wishlistMember', members, members[0] || '');
        const priority = rememberedOption('wishlistPriority', priorities,
          priorities.indexOf('Medium') === -1 ? (priorities[0] || '') : 'Medium');
        const buyer = rememberedOption('wishlistBuyer', members, '');
        if (!member) {
          $message.text('No family member is available. Add people to data/other/people/people.csv first.');
          $button.prop('disabled', false);
          return;
        }
        const body = {
          setNumber: context.setNumber,
          wishlistDate: today(),
          member: member,
          priority: priority,
          buyer: buyer
        };
        api('POST', '/wishlist', body)
          .done(function (result) {
            setCookie('wishlistMember', member);
            setCookie('wishlistPriority', priority);
            setCookie('wishlistBuyer', buyer);
            context.entry = Object.assign({}, context.details, {
              id: result.id,
              setNumber: context.setNumber,
              member: member,
              priority: priority,
              buyer: buyer,
              wishlistDate: body.wishlistDate
            });
            renderSetAction();
            $('#set-sites-action-msg').text('Saved to wishlist for ' + member + '.');
            $(document).trigger('bricktools:wishlist-changed');
          })
          .fail(function (xhr) {
            $message.text(errorOf(xhr));
            $button.prop('disabled', false);
          });
      })
      .fail(function (xhr) {
        $message.text(errorOf(xhr));
        $button.prop('disabled', false);
      });
  }

  function buySet() {
    const context = siteContext;
    if (!context || !context.entry || context.entry.id == null) {
      return;
    }
    const entry = context.entry;
    const data = Object.assign({}, entry, context.details || {});
    const label = data.name || ('Set ' + context.setNumber);
    const price = data.officialPrice == null ? null : data.officialPrice;
    const message = 'Buy ' + label + ' (' + (price == null ? 'no official price' : fmt.money(price)) + ')?\n\n'
      + 'This records the purchase and removes the set from the wishlist.';
    if (!window.confirm(message)) {
      return;
    }
    const $button = $('#set-sites-actions .btn').prop('disabled', true);
    const $message = $('#set-sites-action-msg').text('Recording purchase…');
    api('POST', '/purchases', {
      setNumber: context.setNumber,
      purchasePrice: price,
      purchaseDate: today(),
      vendor: '',
      broughtBy: '',
      owner: entry.member || '',
      partMissings: 0,
      owned: true,
      reason: ''
    }).done(function () {
      $(document).trigger('bricktools:wishlist-changed');
      api('DELETE', '/wishlist/' + encodeURIComponent(entry.id))
        .always(function () { window.location.href = 'purchases.html#list'; });
    }).fail(function (xhr) {
      $message.text(errorOf(xhr));
      $button.prop('disabled', false);
    });
  }

  function openSetSites(setNumber, details) {
    const value = $.trim(setNumber == null ? '' : String(setNumber));
    if (!value) {
      return;
    }
    const $modal = ensureSiteModal();
    const request = ++siteRequest;
    $modal.attr('data-set-number', value);
    siteContext = { setNumber: value, details: details || {}, entry: null };
    renderSetDetails(details, value);
    renderSiteLinks(value);
    $('#set-sites-actions').empty();
    $('#set-sites-action-msg').text('Loading wishlist status…');

    $modal.prop('hidden', false);
    $modal.find('.modal-close').trigger('focus');

    api('GET', '/wishlist')
      .done(function (entries) {
        if (request !== siteRequest) {
          return;
        }
        const entry = (entries || []).find(row => String(row.setNumber) === value) || null;
        siteContext.entry = entry;
        if (!details && entry) {
          siteContext.details = entry;
          renderSetDetails(entry, value);
        }
        $('#set-sites-action-msg').text('');
        renderSetAction();
      })
      .fail(function (xhr) {
        if (request !== siteRequest) {
          return;
        }
        $('#set-sites-action-msg').text(errorOf(xhr));
        renderSetAction();
      });
  }

  const PRICE_SOURCES = [
    {
      id: 'brickonomics',
      label: 'Brickonomics',
      fetch: function (setNumber) {
        return api('POST', '/brickonomics/sets/' + encodeURIComponent(setNumber) + '/price');
      }
    }
  ];

  const SYNC_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M13.5 6A5.5 5.5 0 0 0 3.2 4.6L2 6"></path><path d="M2 2.5V6h3.5"></path>' +
    '<path d="M2.5 10A5.5 5.5 0 0 0 12.8 11.4L14 10"></path><path d="M14 13.5V10h-3.5"></path></svg>';

  let $priceModal = null;

  function closePriceSources() {
    if ($priceModal) {
      $priceModal.prop('hidden', true);
    }
  }

  function ensurePriceModal() {
    if ($priceModal) {
      return $priceModal;
    }
    $priceModal = $(
      '<div id="price-sources-modal" class="modal" hidden>' +
        '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="price-sources-title">' +
          '<div class="modal-head">' +
            '<h2 id="price-sources-title">Official price</h2>' +
            '<button type="button" class="modal-close" aria-label="Close">&times;</button>' +
          '</div>' +
          '<p class="modal-sub">Choose a website to fetch the official Lego price from.</p>' +
          '<div id="price-sources-list"></div>' +
          '<p id="price-sources-msg" class="message"></p>' +
        '</div>' +
      '</div>'
    );
    $priceModal.on('click', function (e) {
      if (e.target === this) {
        closePriceSources();
      }
    });
    $priceModal.on('click', '.modal-close', closePriceSources);
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && $priceModal && !$priceModal.prop('hidden')) {
        closePriceSources();
      }
    });
    $('body').append($priceModal);
    return $priceModal;
  }

  function openPriceSources(setNumber, onFetched) {
    const value = $.trim(setNumber == null ? '' : String(setNumber));
    if (!value) {
      return;
    }
    const $modal = ensurePriceModal();
    $('#price-sources-title').text('Official price of set ' + value);
    $('#price-sources-msg').text('');

    const $list = $('#price-sources-list').empty();
    PRICE_SOURCES.forEach(function (source) {
      $list.append($('<button type="button" class="btn"></button>')
        .text('Fetch price with ' + source.label)
        .on('click', function () {
          const $buttons = $list.find('button').prop('disabled', true);
          $('#price-sources-msg').text('Fetching price with ' + source.label + '...');
          source.fetch(value)
            .done(function (result) {
              closePriceSources();
              if (onFetched) {
                onFetched(result);
              }
            })
            .fail(function (xhr) {
              $('#price-sources-msg').text(errorOf(xhr));
              $buttons.prop('disabled', false);
            });
        }));
    });

    $modal.prop('hidden', false);
    $modal.find('.modal-close').trigger('focus');
  }

  function priceButton(setNumber, onFetched) {
    return $('<button type="button" class="btn secondary icon-btn"></button>')
      .attr('title', 'Fetch official price')
      .attr('aria-label', 'Fetch official price')
      .html(SYNC_ICON)
      .on('click', function () { openPriceSources(setNumber, onFetched); });
  }

  window.BrickSets = {
    closeSetSites, openSetSites, openPriceSources, priceButton
  };
})(window, jQuery);
