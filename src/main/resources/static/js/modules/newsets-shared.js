/**
 * New Sets - Shared Utilities Module
 * Common functions and constants used across all new sets modules
 */
(function () {
  'use strict';

  // Initialize namespace
  if (typeof BrickTools === 'undefined') {
    window.BrickTools = {};
  }

  // ============================================================================
  // Constants
  // ============================================================================

  const fmt = BrickTools.fmt;

  /**
   * Priority ranks for sorting wishlist entries
   */
  const PRIORITY_RANK = { Favorite: 1, High: 2, Medium: 3, Low: 4 };

  /**
   * Number of sets to load at once
   */
  const SET_PAGE_SIZE = 48;

  /**
   * Default set exclusion rules
   * Sets matching any of these rules are hidden from the Sets tab by default.
   */
  const DEFAULT_SET_EXCLUSIONS = [
    {
      id: 'noparts',
      description: 'Set without parts',
      excludes: function(set) { return !set.numParts; }
    },
    {
      id: '666',
      description: 'Set numbers of length >= 7',
      excludes: function(set) { return set.setNumber.length >= 7; }
    },
    {
      id: 'minisets',
      description: 'Set numbers starting with L or 2D',
      excludes: function(set) { return /^l|2D/i.test(String(set.setNumber || '')); }
    }
  ];

  // ============================================================================
  // State variables (will be initialized by modules)
  // ============================================================================

  let catalog = { year: null, sets: [], themes: [] };
  let wishlist = [];
  let wishlistBySet = new Map();
  let options = { members: [], priorities: [] };
  let selectedYear = new Date().getFullYear();
  let wishlistSortKey = 'priorityRank';
  let wishlistSortDir = 1;
  let filteredSetRows = [];
  let renderedSetCount = 0;
  let setObserver = null;
  let forceSetReset = false;
  let rootFilter = '';

  // ============================================================================
  // Utility functions
  // ============================================================================

  /**
   * Check if a set is excluded by default
   * @param {Object} set - Set object
   * @returns {boolean} True if excluded
   */
  function isExcludedByDefault(set) {
    return DEFAULT_SET_EXCLUSIONS.some(function(rule) { return rule.excludes(set); });
  }

  /**
   * Apply default exclusions to catalog data
   * @param {Object} data - Catalog data
   * @returns {Object} Filtered catalog data
   */
  function applyDefaultExclusions(data) {
    const source = data || {};
    const sets = (source.sets || []).filter(function(set) { return !isExcludedByDefault(set); });
    const themeNames = new Set(sets.map(function(set) { return set.theme; }).filter(Boolean));
    const themes = (source.themes || []).filter(function(theme) { return themeNames.has(theme.name); });
    return Object.assign({}, source, { sets: sets, themes: themes });
  }

  /**
   * Display a report message
   * @param {string} selector - jQuery selector
   * @param {string} text - Text to display
   */
  function report(selector, text) {
    $(selector).text(text || '');
  }

  /**
   * Create a debounced function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay) {
    let timer = null;
    return function() {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(null, args); }, delay);
    };
  }

  /**
   * Get today's date in yyyy/mm/dd format
   * @returns {string} Today's date
   */
  function today() {
    const d = new Date();
    const pad = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
  }

  /**
   * Get text value from a selector
   * @param {string} selector - jQuery selector
   * @returns {string} Trimmed text value
   */
  function textValue(selector) {
    return $.trim($(selector).val() || '');
  }

  /**
   * Get numeric value from a selector
   * @param {string} selector - jQuery selector
   * @returns {number|null} Numeric value or null if empty
   */
  function numberValue(selector) {
    const value = textValue(selector);
    return value === '' ? null : Number(value);
  }

  /**
   * Determine readable text color based on background color
   * @param {string} color - Background color
   * @returns {string} Either '#111827' (dark) or '#ffffff' (white)
   */
  function readableText(color) {
    const hex = String(color || '#e5e7eb').replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(function(c) { return c + c; }).join('') : hex.slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(full)) {
      return '#111827';
    }
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111827' : '#ffffff';
  }

  /**
   * Fill a select element with options
   * @param {string} selector - Select element selector
   * @param {Array} values - Array of option values
   * @param {boolean} preserve - Whether to preserve current selection
   */
  function fillSelect(selector, values, preserve) {
    const $select = $(selector);
    const current = preserve ? ($select.val() || '') : '';
    $select.find('option:not(:first)').remove();
    values.forEach(function(value) {
      $select.append($('<option></option>').val(value).text(value));
    });
    $select.val(current && values.includes(current) ? current : '');
  }

  /**
   * Get theme names from catalog and optionally wishlist
   * @param {boolean} includeWishlist - Whether to include wishlist themes
   * @returns {Array} Sorted array of theme names
   */
  function themeNames(includeWishlist) {
    const names = new Set(catalog.themes.map(function(t) { return t.name; }));
    if (includeWishlist) {
      wishlist.forEach(function(entry) {
        if (entry.theme) {
          names.add(entry.theme);
        }
      });
    }
    return Array.from(names).sort(function(a, b) { 
      return a.localeCompare(b, undefined, { numeric: true }); 
    });
  }

  /**
   * Create a theme chip element
   * @param {string} theme - Theme name
   * @param {string} imageUrl - Theme image URL
   * @param {string} color - Theme background color
   * @returns {jQuery} Theme chip jQuery element
   */
  function themeChip(theme, imageUrl, color) {
    const background = color || '#e5e7eb';
    const $chip = $('<span class="theme-chip"></span>')
      .css({ 'background-color': background, color: readableText(background) });
    if (imageUrl) {
      $chip.append($('<img loading="lazy">')
        .attr('src', imageUrl)
        .attr('alt', theme || '')
        .on('error', function() {
          $(this).remove();
          $chip.text(theme || 'Unknown theme');
        }));
    } else {
      $chip.text(theme || 'Unknown theme');
    }
    $chip.attr('title', theme || 'Unknown theme');
    return $chip;
  }

  /**
   * Create a person cell with image or tag
   * @param {string} name - Person name
   * @param {string} imageUrl - Image URL
   * @param {string} color - Border color
   * @returns {jQuery} Person cell jQuery element
   */
  function personCell(name, imageUrl, color) {
    const $cell = $('<td></td>');
    if (imageUrl) {
      const $image = $('<img loading="lazy">')
        .addClass('person-img')
        .attr('src', imageUrl)
        .attr('alt', name || '')
        .attr('title', name || '');
      if (color) {
        $image.css('border-color', color);
      }
      $cell.append($image);
    } else {
      const $tag = BrickTools.tag(name);
      if (color && $tag) {
        $tag.css('border', '2px solid ' + color);
      }
      $cell.append($tag);
    }
    return $cell;
  }

  /**
   * Get the catalogue URL for the selected year
   * @returns {string} Catalogue URL
   */
  function catalogueUrl() {
    return '/newsets?year=' + encodeURIComponent(selectedYear);
  }

  /**
   * Check if price matches the given range
   * @param {number} value - Price value
   * @param {number|null} min - Minimum price
   * @param {number|null} max - Maximum price
   * @returns {boolean} True if price matches
   */
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

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.NewSetsShared = {
    // Constants
    PRIORITY_RANK: PRIORITY_RANK,
    SET_PAGE_SIZE: SET_PAGE_SIZE,
    DEFAULT_SET_EXCLUSIONS: DEFAULT_SET_EXCLUSIONS,
    
    // State accessors
    getCatalog: function() { return catalog; },
    setCatalog: function(data) { catalog = data; },
    getWishlist: function() { return wishlist; },
    setWishlist: function(data) { wishlist = data; },
    getWishlistBySet: function() { return wishlistBySet; },
    setWishlistBySet: function(data) { wishlistBySet = data; },
    getOptions: function() { return options; },
    setOptions: function(data) { options = data; },
    getSelectedYear: function() { return selectedYear; },
    setSelectedYear: function(year) { selectedYear = year; },
    getWishlistSortKey: function() { return wishlistSortKey; },
    setWishlistSortKey: function(key) { wishlistSortKey = key; },
    getWishlistSortDir: function() { return wishlistSortDir; },
    setWishlistSortDir: function(dir) { wishlistSortDir = dir; },
    getFilteredSetRows: function() { return filteredSetRows; },
    setFilteredSetRows: function(rows) { filteredSetRows = rows; },
    getRenderedSetCount: function() { return renderedSetCount; },
    setRenderedSetCount: function(count) { renderedSetCount = count; },
    getSetObserver: function() { return setObserver; },
    setSetObserver: function(observer) { setObserver = observer; },
    getForceSetReset: function() { return forceSetReset; },
    setForceSetReset: function(value) { forceSetReset = value; },
    getRootFilter: function() { return rootFilter; },
    setRootFilter: function(filter) { rootFilter = filter; },
    
    // Utility functions
    isExcludedByDefault: isExcludedByDefault,
    applyDefaultExclusions: applyDefaultExclusions,
    report: report,
    debounce: debounce,
    today: today,
    textValue: textValue,
    numberValue: numberValue,
    readableText: readableText,
    fillSelect: fillSelect,
    themeNames: themeNames,
    themeChip: themeChip,
    personCell: personCell,
    catalogueUrl: catalogueUrl,
    priceMatches: priceMatches
  };
})();
