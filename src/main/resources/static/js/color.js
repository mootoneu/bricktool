(function (window, $) {
  'use strict';

  const api = window.BrickTools.api;
  const errorOf = window.BrickTools.errorOf;
  const fmt = window.BrickTools.fmt;
  const readableText = window.BrickTools.readableText;

  const COLOR_SYSTEMS = [
    { id: 'LE', label: 'Lego' },
    { id: 'BO', label: 'BrickOwl' },
    { id: 'BL', label: 'BrickLink' },
    { id: 'LD', label: 'LDraw' }
  ];

  let colorCache = null;
  let colorMappingCache = null;

  function normalizeColor(row) {
    return {
      id: row.id,
      name: row.name || ('Color ' + row.id),
      rgb: row.rgb || '',
      isTrans: !!row.isTrans,
      numParts: row.numParts,
      numSets: row.numSets,
      y1: row.y1,
      y2: row.y2
    };
  }

  function normalizeMapping(row) {
    return {
      id: row.id,
      extSystem: String(row.extSystem || '').toUpperCase(),
      extId: row.extId == null ? '' : String(row.extId),
      extNames: Array.isArray(row.extNames) ? row.extNames.slice() : [],
      extDescr: row.extDescr || ''
    };
  }

  function retryable(promise, reset) {
    return promise.then(null, function (xhr) {
      reset();
      return $.Deferred().reject(xhr).promise();
    });
  }

  function loadColors() {
    if (!colorCache) {
      const cached = api('GET', '/colors').then(function (rows) {
        return (rows || []).map(normalizeColor);
      });
      colorCache = retryable(cached, function () { colorCache = null; });
    }
    return colorCache;
  }

  function loadColorMappings() {
    if (!colorMappingCache) {
      const cached = api('GET', '/color-mappings').then(function (rows) {
        const mappings = (rows || []).map(normalizeMapping);
        const index = {};
        mappings.forEach(function (mapping) {
          const key = mapping.extSystem + ':' + mapping.extId;
          if (!Object.prototype.hasOwnProperty.call(index, key)) {
            index[key] = mapping.id;
          }
        });
        return { mappings: mappings, index: index };
      });
      colorMappingCache = retryable(cached, function () { colorMappingCache = null; });
    }
    return colorMappingCache;
  }

  /**
   * Returns a promise resolving to the color object of data/re/colors.csv with the given id.
   */
  function getColor(color_id) {
    return loadColors().then(function (colors) {
      const wanted = String(color_id);
      return colors.find(color => String(color.id) === wanted) || null;
    });
  }

  /**
   * Returns a promise resolving to the Lego color id matching an external system identifier,
   * or null when data/re/color_mappings.csv has no matching row.
   */
  function getLegoColorId(ext_system, ext_id) {
    return loadColorMappings().then(function (data) {
      const key = String(ext_system == null ? '' : ext_system).trim().toUpperCase()
        + ':' + String(ext_id == null ? '' : ext_id).trim();
      return Object.prototype.hasOwnProperty.call(data.index, key) ? data.index[key] : null;
    });
  }

  function colorHex(color) {
    const rgb = String((color && color.rgb) || '').replace('#', '').trim();
    return /^[0-9a-fA-F]{6}$/.test(rgb) ? '#' + rgb : '#e5e7eb';
  }

  function colorChip(color, large) {
    const hex = colorHex(color);
    const name = (color && color.name) || 'Unknown color';
    return $('<span class="color-chip"></span>')
      .toggleClass('color-chip-lg', !!large)
      .css({ 'background-color': hex, color: readableText(hex) })
      .attr('title', name)
      .text(name);
  }

  function colorFacts(color) {
    const facts = [];
    if (color.id != null) {
      facts.push('Id ' + color.id);
    }
    if (color.rgb) {
      facts.push('#' + String(color.rgb).replace('#', '').toUpperCase());
    }
    facts.push(color.isTrans ? 'Transparent' : 'Opaque');
    if (color.numParts != null) {
      facts.push(fmt.number(color.numParts) + ' parts');
    }
    if (color.numSets != null) {
      facts.push(fmt.number(color.numSets) + ' sets');
    }
    const years = [color.y1, color.y2].filter(value => value != null);
    if (years.length) {
      facts.push(years.join('–'));
    }
    return facts.join(' · ');
  }

  function renderColorSummary($container, color) {
    $container.append($('<div class="color-summary"></div>')
      .append(colorChip(color, true))
      .append($('<p class="color-summary-meta"></p>').text(colorFacts(color))));
  }

  let $colorInfoModal = null;
  let colorInfoRequest = 0;

  function closeColorInfo() {
    if ($colorInfoModal) {
      $colorInfoModal.prop('hidden', true);
    }
  }

  function ensureColorInfoModal() {
    if ($colorInfoModal) {
      return $colorInfoModal;
    }
    $colorInfoModal = $(
      '<div id="color-info-modal" class="modal" hidden>' +
        '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="color-info-title">' +
          '<div class="modal-head">' +
            '<h2 id="color-info-title">Color</h2>' +
            '<button type="button" class="modal-close icon-only" aria-label="Close">' + window.BrickTools.icon('close') + '</button>' +
          '</div>' +
          '<div id="color-info-content" class="color-modal-content"></div>' +
        '</div>' +
      '</div>'
    );
    $colorInfoModal.on('click', function (e) {
      if (e.target === this) {
        closeColorInfo();
      }
    });
    $colorInfoModal.on('click', '.modal-close', closeColorInfo);
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && !$colorInfoModal.prop('hidden')) {
        closeColorInfo();
      }
    });
    $('body').append($colorInfoModal);
    return $colorInfoModal;
  }

  function colorSystemRows(mappings, colorId) {
    const wanted = String(colorId);
    const rows = mappings.filter(row => String(row.id) === wanted);
    return COLOR_SYSTEMS.map(function (system) {
      return {
        system: system,
        mappings: rows.filter(row => row.extSystem === system.id)
      };
    });
  }

  function renderColorInfo(color, mappings) {
    const $content = $('#color-info-content').empty();
    renderColorSummary($content, color);

    const $table = $('<table class="color-info-table"></table>');
    $table.append('<thead><tr><th>System</th><th>Id</th><th>Name</th></tr></thead>');
    const $body = $('<tbody></tbody>');
    colorSystemRows(mappings, color.id).forEach(function (group) {
      if (group.mappings.length === 0) {
        $body.append($('<tr></tr>')
          .append($('<td></td>').text(group.system.label))
          .append($('<td colspan="2" class="muted"></td>').text('—')));
        return;
      }
      group.mappings.forEach(function (mapping) {
        const name = mapping.extNames.length ? mapping.extNames.join(' / ') : color.name;
        $body.append($('<tr></tr>')
          .append($('<td></td>').text(group.system.label))
          .append($('<td></td>').text(mapping.extId || '—'))
          .append($('<td></td>').text(name)));
      });
    });
    $table.append($body);
    $content.append($table);
  }

  function openColorInfo(color_id) {
    const value = color_id == null ? '' : String(color_id);
    if (!value) {
      return;
    }
    const $modal = ensureColorInfoModal();
    const request = ++colorInfoRequest;
    $('#color-info-title').text('Color ' + value);
    $('#color-info-content').html('<p class="muted">Loading color information…</p>');
    $modal.prop('hidden', false);
    $modal.find('.modal-close').trigger('focus');

    $.when(getColor(value), loadColorMappings()).done(function (color, data) {
      if (request !== colorInfoRequest) {
        return;
      }
      if (!color) {
        $('#color-info-content').html('<p class="muted">Unknown color.</p>');
        return;
      }
      $('#color-info-title').text(color.name);
      renderColorInfo(color, data.mappings);
    }).fail(function (xhr) {
      if (request !== colorInfoRequest) {
        return;
      }
      $('#color-info-content').empty()
        .append($('<p class="message"></p>').text(errorOf(xhr || {})));
    });
  }

  let $colorPickerModal = null;
  let colorPickerState = null;

  function closeColorPicker() {
    if ($colorPickerModal) {
      $colorPickerModal.prop('hidden', true);
    }
    colorPickerState = null;
  }

  function ensureColorPickerModal() {
    if ($colorPickerModal) {
      return $colorPickerModal;
    }
    $colorPickerModal = $(
      '<div id="color-picker-modal" class="modal" hidden>' +
        '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="color-picker-title">' +
          '<div class="modal-head">' +
            '<h2 id="color-picker-title">Select a color</h2>' +
            '<button type="button" class="modal-close icon-only" aria-label="Close">' + window.BrickTools.icon('close') + '</button>' +
          '</div>' +
          '<p class="modal-sub">Pick the color to use.</p>' +
          '<div id="color-picker-current" class="color-picker-current"></div>' +
          '<input id="color-picker-search" class="color-picker-search" type="search" ' +
            'placeholder="Search by name or id">' +
          '<div id="color-picker-list" class="color-picker-list"></div>' +
          '<p id="color-picker-msg" class="message"></p>' +
          '<div class="color-modal-actions">' +
            '<button type="button" id="color-picker-cancel" class="btn secondary">' +
              window.BrickTools.icon('close') + ' Cancel</button>' +
            '<button type="button" id="color-picker-select" class="btn" disabled>' +
              window.BrickTools.icon('check') + ' Select</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    $colorPickerModal.on('click', function (e) {
      if (e.target === this) {
        closeColorPicker();
      }
    });
    $colorPickerModal.on('click', '.modal-close', closeColorPicker);
    $colorPickerModal.on('click', '#color-picker-cancel', closeColorPicker);
    $colorPickerModal.on('click', '#color-picker-select', function () {
      const state = colorPickerState;
      if (!state || !state.selected) {
        return;
      }
      const color = state.colors.find(row => String(row.id) === state.selected);
      if (!color) {
        return;
      }
      const callback = state.onSelect;
      closeColorPicker();
      if (callback) {
        callback(color);
      }
    });
    $colorPickerModal.on('input', '#color-picker-search', renderColorPickerList);
    $colorPickerModal.on('click', '.color-option', function () {
      if (!colorPickerState) {
        return;
      }
      colorPickerState.selected = String($(this).attr('data-color-id'));
      updateColorPickerSelection();
    });
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && !$colorPickerModal.prop('hidden')) {
        closeColorPicker();
      }
    });
    $('body').append($colorPickerModal);
    return $colorPickerModal;
  }

  function updateColorPickerSelection() {
    const state = colorPickerState;
    if (!state) {
      return;
    }
    $('#color-picker-list .color-option').each(function () {
      $(this).toggleClass('selected', String($(this).attr('data-color-id')) === state.selected);
    });
    const color = state.colors.find(row => String(row.id) === state.selected);
    const $current = $('#color-picker-current').empty();
    if (color) {
      renderColorSummary($current, color);
    } else {
      $current.append($('<p class="muted"></p>').text('No color selected.'));
    }
    $('#color-picker-select').prop('disabled', !color);
  }

  function renderColorPickerList() {
    const state = colorPickerState;
    if (!state) {
      return;
    }
    const search = String($('#color-picker-search').val() || '').trim().toLowerCase();
    const $list = $('#color-picker-list').empty();
    const colors = state.colors
      .filter(function (color) {
        if (!search) {
          return true;
        }
        return color.name.toLowerCase().indexOf(search) !== -1
          || String(color.id).indexOf(search) !== -1;
      })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (colors.length === 0) {
      $list.append($('<p class="muted"></p>').text('No matching color.'));
      return;
    }
    colors.forEach(function (color) {
      $list.append($('<button type="button" class="color-option"></button>')
        .attr('data-color-id', color.id)
        .attr('title', color.name)
        .append(colorChip(color)));
    });
    updateColorPickerSelection();
  }

  /**
   * Opens the color picker with the current color selected. The optional callback receives
   * the chosen color object when the user confirms the selection.
   */
  function openColorPicker(current_color_id, onSelect) {
    const $modal = ensureColorPickerModal();
    colorPickerState = {
      selected: current_color_id == null ? '' : String(current_color_id),
      colors: [],
      onSelect: typeof onSelect === 'function' ? onSelect : null
    };
    $('#color-picker-title').text('Select a color');
    $('#color-picker-search').val('');
    $('#color-picker-list').empty();
    $('#color-picker-current').html('<p class="muted">Loading colors…</p>');
    $('#color-picker-select').prop('disabled', true);
    $('#color-picker-msg').text('');
    $modal.prop('hidden', false);
    $modal.find('.modal-close').trigger('focus');

    loadColors().done(function (colors) {
      if (!colorPickerState) {
        return;
      }
      colorPickerState.colors = colors || [];
      renderColorPickerList();
    }).fail(function (xhr) {
      if (!colorPickerState) {
        return;
      }
      $('#color-picker-current').empty();
      $('#color-picker-msg').text(errorOf(xhr || {}));
    });
  }

  window.BrickColor = {
    getColor, getLegoColorId, loadColors, openColorInfo, openColorPicker
  };
})(window, jQuery);
