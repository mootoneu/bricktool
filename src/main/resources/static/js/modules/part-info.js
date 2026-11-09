/**
 * Part Information Module
 * Shows the details, colors and default image of a part in a modal. It is shared by the pages
 * that display part images: Parts Collection and BrickOwl order items.
 */
(function () {
  'use strict';

  let $modal = null;
  let info = null;
  let request = 0;

  function readableText(hex) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
      return '#111827';
    }
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111827' : '#ffffff';
  }

  function colorHex(rgb) {
    const value = String(rgb || '').replace('#', '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(value)) {
      return '#' + value;
    }
    if (/^[0-9a-fA-F]{3}$/.test(value)) {
      return '#' + value.split('').map(function (c) { return c + c; }).join('');
    }
    return '';
  }

  function imageUrl(partNumber, colorId) {
    return '/api/parts/' + encodeURIComponent(partNumber) + '/image' +
      (colorId == null || colorId === '' ? '' : '?colorId=' + encodeURIComponent(colorId));
  }

  function close() {
    if ($modal) {
      $modal.prop('hidden', true);
    }
  }

  function ensureModal() {
    if ($modal) {
      return $modal;
    }
    $modal = $(
      '<div id="part-info-modal" class="modal" hidden>' +
        '<div class="modal-dialog part-info-dialog" role="dialog" aria-modal="true" ' +
          'aria-labelledby="part-info-title">' +
          '<div class="modal-head">' +
            '<h2 id="part-info-title">Part</h2>' +
            '<button type="button" class="modal-close" aria-label="Close">&times;</button>' +
          '</div>' +
          '<p id="part-info-sub" class="modal-sub"></p>' +
          '<div class="part-info-top">' +
            '<div id="part-info-image" class="part-info-image"></div>' +
            '<div class="part-info-details">' +
              '<div id="part-info-stars" class="part-info-stars"></div>' +
              '<div>' +
                '<button type="button" id="part-info-add" class="btn">Add to collection</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<section class="part-info-colors">' +
            '<h3>Available colors</h3>' +
            '<div id="part-info-color-list" class="part-info-color-list"></div>' +
          '</section>' +
          '<p id="part-info-msg" class="message"></p>' +
        '</div>' +
      '</div>'
    );
    $modal.on('click', function (event) {
      if (event.target === this) {
        close();
      }
    });
    $modal.on('click', '.modal-close', close);
    $(document).on('keydown', function (event) {
      if (event.key === 'Escape' && $modal && !$modal.prop('hidden')) {
        close();
      }
    });
    $('body').append($modal);
    return $modal;
  }

  function renderImage() {
    const $image = $('#part-info-image').empty();
    if (!info) {
      return;
    }
    $image.append($('<img loading="lazy" alt="">')
      .attr('src', imageUrl(info.partNumber, info.defaultColorId))
      .attr('alt', info.name || info.partNumber));
  }

  function renderStars() {
    const $host = $('#part-info-stars').empty();
    if (!info) {
      return;
    }
    $host.append($('<span class="muted"></span>').text('Stars'));
    const value = Number(info.stars || 0);
    const editable = Boolean(info.inMainParts);
    const $stars = $('<span class="stars"></span>');

    const zero = editable
      ? $('<button type="button" class="star star-zero"></button>')
      : $('<span class="star star-zero readonly"></span>');
    zero.toggleClass('on', value === 0)
      .attr('data-stars', 0)
      .attr('aria-label', 'Set 0 stars (hidden)')
      .attr('title', 'Set 0 stars (hidden)')
      .append('<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
        + '<path d="M2 2l20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M9.9 5.1A10.3 10.3 0 0 1 12 5c5.5 0 9.5 4.5 10 7-.2 1-1 2.4-2.2 3.6M6.6 6.6C4.3 8 2.7 10 2 12c.5 2.5 4.5 7 10 7 1.7 0 3.3-.4 4.7-1.1"'
        + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        + '</svg>');
    if (editable) {
      zero.on('click', function () { saveStars(0); });
    }
    $stars.append(zero);

    for (let n = 1; n <= 5; n++) {
      const $star = editable
        ? $('<button type="button" class="star"></button>')
        : $('<span class="star readonly"></span>');
      $star.toggleClass('on', value >= n)
        .attr('data-stars', n)
        .attr('aria-label', n + (n === 1 ? ' star' : ' stars'))
        .attr('title', editable ? 'Set ' + n + (n === 1 ? ' star' : ' stars')
          : n + (n === 1 ? ' star' : ' stars'))
        .text('★');
      if (editable) {
        $star.on('click', function () { saveStars(n); });
      }
      $stars.append($star);
    }
    $host.append($stars);
    if (!editable) {
      $host.append($('<span class="muted"></span>').text('(not a main part)'));
    }
  }

  function renderColors() {
    const $list = $('#part-info-color-list').empty();
    if (!info) {
      return;
    }
    const colors = Array.isArray(info.colors) ? info.colors : [];
    if (colors.length === 0) {
      $list.append($('<p class="muted"></p>').text('No color is available for this part.'));
      return;
    }
    colors.forEach(function (color) {
      const label = color.name || ('Color ' + color.colorId);
      const hex = colorHex(color.rgb);
      const selected = String(color.colorId) === String(info.defaultColorId);
      const $chip = $('<button type="button" class="part-color-chip"></button>')
        .attr('data-color-id', color.colorId)
        .attr('title', label + (selected ? ' (default image)' : ''))
        .toggleClass('selected', selected)
        .text(label);
      if (hex) {
        $chip.css({ 'background-color': hex, color: readableText(hex) });
      }
      if (selected) {
        $chip.append($('<span class="part-color-check" aria-hidden="true">✓</span>'));
      }
      $chip.on('click', function () { selectColor(color.colorId); });
      $list.append($chip);
    });
  }

  function render() {
    if (!info) {
      return;
    }
    $('#part-info-title').text(info.name || ('Part ' + info.partNumber));
    const meta = ['#' + info.partNumber,
      'Has alternates: ' + (info.hasAlternates ? 'Yes' : 'No'),
      'Material: ' + (info.material || '—')];
    $('#part-info-sub').text(meta.join(' · '));
    renderImage();
    renderStars();
    renderColors();
    $('#part-info-msg').text('');
  }

  function updateTableImages() {
    const partNumber = String(info.partNumber);
    $('img.part-img[data-part-number]').each(function () {
      if (String($(this).attr('data-part-number')) !== partNumber) {
        return;
      }
      const src = String($(this).attr('src') || '');
      if (src.indexOf('colorId=') === -1) {
        $(this).attr('src', imageUrl(partNumber, info.defaultColorId));
      }
    });
  }

  function selectColor(colorId) {
    if (!info || String(info.defaultColorId) === String(colorId)) {
      return;
    }
    const partNumber = info.partNumber;
    $('#part-info-color-list .part-color-chip').prop('disabled', true);
    $('#part-info-msg').text('Saving default color…');
    BrickTools.api('PUT', '/parts/' + encodeURIComponent(partNumber) + '/default-color',
      { colorId: colorId })
      .done(function () {
        info.defaultColorId = colorId;
        renderImage();
        renderColors();
        updateTableImages();
        $('#part-info-msg').text('Default color updated.');
      })
      .fail(function (xhr) {
        $('#part-info-msg').text(BrickTools.errorOf(xhr));
      })
      .always(function () {
        $('#part-info-color-list .part-color-chip').prop('disabled', false);
      });
  }

  function saveStars(stars) {
    if (!info || !info.inMainParts) {
      return;
    }
    const partNumber = info.partNumber;
    $('#part-info-stars .star').prop('disabled', true);
    BrickTools.api('PUT', '/parts/main-parts/' + encodeURIComponent(partNumber) + '/stars',
      { stars: stars })
      .done(function () {
        info.stars = stars;
        renderStars();
        if (BrickTools.PartsCollectionExplorer && $('#main-parts').length) {
          BrickTools.PartsCollectionExplorer.loadMainParts();
        }
      })
      .fail(function (xhr) {
        $('#part-info-msg').text(BrickTools.errorOf(xhr));
        $('#part-info-stars .star').prop('disabled', false);
      });
  }

  function open(partNumber) {
    const value = String(partNumber == null ? '' : partNumber).trim();
    if (!value) {
      return;
    }
    const current = ++request;
    info = null;
    const $dialog = ensureModal();
    $('#part-info-title').text('Part ' + value);
    $('#part-info-sub').text('');
    $('#part-info-stars').empty();
    $('#part-info-color-list').empty();
    $('#part-info-msg').text('');
    $('#part-info-image').empty().append($('<span class="muted"></span>').text('Loading…'));
    $dialog.prop('hidden', false);
    $dialog.find('.modal-close').trigger('focus');

    BrickTools.api('GET', '/parts/' + encodeURIComponent(value) + '/info')
      .done(function (result) {
        if (current !== request) {
          return;
        }
        info = result;
        render();
      })
      .fail(function (xhr) {
        if (current !== request) {
          return;
        }
        $('#part-info-title').text('Part ' + value);
        $('#part-info-image').empty();
        $('#part-info-msg').text(BrickTools.errorOf(xhr));
      });
  }

  function init() {
    $(document).on('click', 'img.part-img[data-part-number]', function (event) {
      event.preventDefault();
      event.stopPropagation();
      open($(this).attr('data-part-number'));
    });
    $(document).on('keydown', 'img.part-img[data-part-number]', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open($(this).attr('data-part-number'));
      }
    });
  }

  BrickTools.PartInfo = {
    init: init,
    open: open,
    close: close
  };
})();
