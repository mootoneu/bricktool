/**
 * Purchases - Shared Utilities Module
 * Common functions and constants used across all purchases modules
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
   * Table columns configuration
   */
  const COLUMNS = [
    { key: 'imageUrl', label: 'Image', image: true, width: 5 },
    { key: 'id', label: 'Purchase Id', width: 3 },
    { key: 'setNumber', label: 'Set Number', width: 5.5 },
    { key: 'name', label: 'Name', width: 6 },
    { key: 'numParts', label: 'Total parts', fmt: fmt.number, width: 5 },
    { key: 'year', label: 'Year', width: 3 },
    { key: 'theme', label: 'Theme', theme: true, width: 5.5 },
    { key: 'officialPrice', label: 'Official Price', fmt: fmt.money, priceFetch: true, width: 5.5 },
    { key: 'price', label: 'Price', fmt: fmt.money, width: 5.5 },
    { key: 'promo', label: 'Promo', fmt: fmt.percent, width: 4 },
    { key: 'purchaseDate', label: 'Date', width: 7 },
    { key: 'vendor', label: 'Vendor', logo: true, width: 5.5 },
    { key: 'broughtBy', label: 'Buyer', avatar: true, width: 5 },
    { key: 'owner', label: 'Owner', avatar: true, width: 5 },
    { key: 'partsMissing', label: 'Parts missing', fmt: fmt.number, width: 5 },
    { key: 'complete', label: 'Complete', fmt: fmt.percent, width: 4 },
    { key: 'owned', label: 'Owned ?', width: 3.5 },
    { key: 'reason', label: 'Reason', width: 3 },
    { key: 'links', label: 'Sites', links: true, width: 5 }
  ];

  /**
   * Option lists configuration
   */
  const OPTION_LISTS = [
    { list: 'vendor-options', key: 'vendors' },
    { list: 'buyer-options', key: 'buyers' },
    { list: 'owner-options', key: 'owners' }
  ];

  /**
   * Filter selectors
   */
  const FILTERS = {
    name: '#filter-name',
    number: '#filter-number',
    reason: '#filter-reason',
    yearMin: '#filter-year-min',
    yearMax: '#filter-year-max',
    dateMin: '#filter-date-min',
    dateMax: '#filter-date-max',
    partsMin: '#filter-parts-min',
    partsMax: '#filter-parts-max',
    theme: '#filter-theme',
    vendor: '#filter-vendor',
    buyer: '#filter-buyer',
    owner: '#filter-owner',
    owned: '#filter-owned'
  };

  /**
   * Chart colors
   */
  const CHART_COLORS = [
    '#1e40af', '#0e7490', '#047857', '#b45309',
    '#be123c', '#7c3aed', '#db2777', '#64748b'
  ];
  const MAX_THEME_SLICES = 8;

  // ============================================================================
  // State variables
  // ============================================================================

  let purchases = [];
  let sortKey = 'purchaseDate';
  let sortDir = -1;

  let setInventory = [];
  let setInventorySet = '';
  let setInventoryLoadedSet = '';
  let setInventoryRequest = 0;
  let setInventorySearch = '';
  let setInventoryHideComplete = false;
  let setInventoryBusy = false;
  let setInventorySortKey = 'partName';
  let setInventorySortDir = 1;
  let pendingSetInventory = $.trim(
    new URLSearchParams(window.location.search).get('set') || '');

  // ============================================================================
  // Utility functions
  // ============================================================================

  /**
   * Get filter value
   * @param {string} key - Filter key
   * @returns {*} Filter value
   */
  function filterValue(key) {
    const $el = $(FILTERS[key]);
    return $el.is(':checkbox') ? $el.is(':checked') : $.trim($el.val() || '');
  }

  /**
   * Normalize date string
   * @param {string} value - Date string
   * @returns {string} Normalized date
   */
  function normalizeDate(value) {
    return value.replace(/-/g, '/');
  }

  /**
   * Get distinct values for a key from purchases or provided rows
   * @param {string} key - Property key
   * @param {Array} [rows] - Optional rows to use instead of purchases
   * @returns {Array} Sorted distinct values
   */
  function distinct(key, rows) {
    const values = new Set();
    (rows || purchases).forEach(function(p) {
      if (p[key] != null && p[key] !== '') {
        values.add(p[key]);
      }
    });
    return Array.from(values).sort(function(a, b) { 
      return String(a).localeCompare(String(b), undefined, { numeric: true }); 
    });
  }

  /**
   * Apply all filters to purchases
   * @returns {Array} Filtered purchases
   */
  function applyFilters() {
    const name = filterValue('name').toLowerCase();
    const number = filterValue('number').toLowerCase();
    const reason = filterValue('reason').toLowerCase();
    const yearMin = filterValue('yearMin') === '' ? null : Number(filterValue('yearMin'));
    const yearMax = filterValue('yearMax') === '' ? null : Number(filterValue('yearMax'));
    const dateMin = normalizeDate(filterValue('dateMin'));
    const dateMax = normalizeDate(filterValue('dateMax'));
    const partsMin = filterValue('partsMin') === '' ? null : Number(filterValue('partsMin'));
    const partsMax = filterValue('partsMax') === '' ? null : Number(filterValue('partsMax'));
    const theme = filterValue('theme');
    const vendor = filterValue('vendor');
    const buyer = filterValue('buyer');
    const owner = filterValue('owner');
    const ownedOnly = filterValue('owned');

    return purchases.filter(function(p) {
      if (name && !String(p.name || '').toLowerCase().includes(name)) return false;
      if (number && !String(p.setNumber || '').toLowerCase().includes(number)) return false;
      if (reason && !String(p.reason || '').toLowerCase().includes(reason)) return false;
      if (yearMin != null && (p.year == null || p.year < yearMin)) return false;
      if (yearMax != null && (p.year == null || p.year > yearMax)) return false;
      if (dateMin || dateMax) {
        const date = normalizeDate(String(p.purchaseDate || ''));
        if (!date) return false;
        if (dateMin && date < dateMin) return false;
        if (dateMax && date > dateMax) return false;
      }
      if (partsMin != null && (p.numParts == null || p.numParts < partsMin)) return false;
      if (partsMax != null && (p.numParts == null || p.numParts > partsMax)) return false;
      if (theme && p.theme !== theme) return false;
      if (vendor && p.vendor !== vendor) return false;
      if (buyer && p.broughtBy !== buyer) return false;
      if (owner && p.owner !== owner) return false;
      if (ownedOnly && !p.owned) return false;
      return true;
    });
  }

  /**
   * Fill a select element with distinct values
   * @param {string} selector - Select element selector
   * @param {string} key - Property key
   * @param {Array} [rows] - Optional rows to use
   */
  function fillSelect(selector, key, rows) {
    const $select = $(selector);
    const current = $select.val() || '';
    const values = distinct(key, rows);
    $select.find('option:not(:first)').remove();
    values.forEach(function(v) { 
      $select.append($('<option></option>').val(v).text(v)); 
    });
    if (current && values.includes(current)) {
      $select.val(current);
    }
  }

  /**
   * Populate filter option dropdowns
   */
  function populateFilterOptions() {
    fillSelect('#filter-theme', 'theme');
    fillSelect('#filter-vendor', 'vendor');
    fillSelect('#filter-buyer', 'broughtBy');
    fillSelect('#filter-owner', 'owner');

    const owned = purchases.filter(function(p) { return p.owned; });
    fillSelect('#stat-theme', 'theme', owned);
    fillSelect('#stat-buyer', 'broughtBy', owned);
    fillSelect('#stat-owner', 'owner', owned);
  }

  /**
   * Calculate total of a property across rows
   * @param {Array} rows - Array of objects
   * @param {string} key - Property key
   * @returns {number} Total sum
   */
  function totalOf(rows, key) {
    return rows.reduce(function(sum, p) { 
      return sum + (Number(p[key]) || 0); 
    }, 0);
  }

  /**
   * Calculate theme entries for chart
   * @param {Array} rows - Array of objects
   * @param {Function} valueOf - Function to extract value
   * @returns {Array} Theme entries sorted by value
   */
  function themeEntries(rows, valueOf) {
    const values = new Map();
    rows.forEach(function(p) {
      const theme = p.theme == null || p.theme === '' ? 'Unknown' : p.theme;
      const value = Number(valueOf(p)) || 0;
      if (value > 0) {
        values.set(theme, (values.get(theme) || 0) + value);
      }
    });
    const entries = Array.from(values, function([name, value]) { 
      return { name: name, value: value }; 
    }).sort(function(a, b) { return b.value - a.value; });
    if (entries.length > MAX_THEME_SLICES) {
      const rest = entries.splice(MAX_THEME_SLICES - 1);
      entries.push({
        name: 'Other themes',
        value: rest.reduce(function(sum, e) { return sum + e.value; }, 0)
      });
    }
    return entries;
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

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PurchasesShared = {
    // Constants
    COLUMNS: COLUMNS,
    OPTION_LISTS: OPTION_LISTS,
    FILTERS: FILTERS,
    CHART_COLORS: CHART_COLORS,
    MAX_THEME_SLICES: MAX_THEME_SLICES,
    fmt: fmt,
    
    // State accessors
    getPurchases: function() { return purchases; },
    setPurchases: function(data) { purchases = data; },
    getSortKey: function() { return sortKey; },
    setSortKey: function(key) { sortKey = key; },
    getSortDir: function() { return sortDir; },
    setSortDir: function(dir) { sortDir = dir; },
    getSetInventory: function() { return setInventory; },
    setSetInventory: function(data) { setInventory = data; },
    getSetInventorySet: function() { return setInventorySet; },
    setSetInventorySet: function(set) { setInventorySet = set; },
    getSetInventoryLoadedSet: function() { return setInventoryLoadedSet; },
    setSetInventoryLoadedSet: function(set) { setInventoryLoadedSet = set; },
    getSetInventoryRequest: function() { return setInventoryRequest; },
    setSetInventoryRequest: function(req) { setInventoryRequest = req; },
    getSetInventorySearch: function() { return setInventorySearch; },
    setSetInventorySearch: function(search) { setInventorySearch = search; },
    getSetInventoryHideComplete: function() { return setInventoryHideComplete; },
    setSetInventoryHideComplete: function(value) { setInventoryHideComplete = value; },
    getSetInventoryBusy: function() { return setInventoryBusy; },
    setSetInventoryBusy: function(value) { setInventoryBusy = value; },
    getSetInventorySortKey: function() { return setInventorySortKey; },
    setSetInventorySortKey: function(key) { setInventorySortKey = key; },
    getSetInventorySortDir: function() { return setInventorySortDir; },
    setSetInventorySortDir: function(dir) { setInventorySortDir = dir; },
    getPendingSetInventory: function() { return pendingSetInventory; },
    setPendingSetInventory: function(value) { pendingSetInventory = value; },
    
    // Utility functions
    filterValue: filterValue,
    normalizeDate: normalizeDate,
    distinct: distinct,
    applyFilters: applyFilters,
    fillSelect: fillSelect,
    populateFilterOptions: populateFilterOptions,
    totalOf: totalOf,
    themeEntries: themeEntries,
    today: today
  };
})();
