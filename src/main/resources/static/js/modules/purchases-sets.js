/**
 * Purchases - Sets Module
 * Shows the purchased sets as cards, filtered by the purchase year
 */
(function () {
  'use strict';

  let selectedYear = new Date().getFullYear();

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Get the purchase year of a purchase
   * @param {Object} p - Purchase object
   * @returns {number|null} Purchase year or null when unknown
   */
  function purchaseYear(p) {
    const year = parseInt(String(p.purchaseDate || '').slice(0, 4), 10);
    return isNaN(year) ? null : year;
  }

  /**
   * Render the purchase year selector
   */
  function renderYearSelector() {
    const purchases = BrickTools.PurchasesShared.getPurchases();
    const years = purchases.map(purchaseYear).filter(function(y) { return y != null; });
    const currentYear = new Date().getFullYear();
    const newest = Math.max(currentYear, selectedYear, ...years);
    const oldest = Math.min(currentYear, selectedYear, ...years);
    const $select = $('#ps-year-value').empty();
    for (let year = newest; year >= oldest; year--) {
      $select.append($('<option></option>').val(year).text(year));
    }
    $select.val(String(selectedYear));
  }

  /**
   * Render the theme filter dropdown from the purchases of the selected year
   */
  function renderThemeFilter() {
    const names = new Set();
    yearPurchases().forEach(function(p) {
      if (p.theme) {
        names.add(p.theme);
      }
    });
    BrickTools.NewSetsShared.fillSelect('#ps-theme', Array.from(names).sort(function(a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    }), true);
  }

  /**
   * Get the purchases bought in the selected year
   * @returns {Array} Purchases of the selected year
   */
  function yearPurchases() {
    return BrickTools.PurchasesShared.getPurchases().filter(function(p) {
      return purchaseYear(p) === selectedYear;
    });
  }

  /**
   * Filter the purchases of the selected year using the filter inputs
   * @returns {Array} Filtered purchases, most recent first
   */
  function filteredPurchases() {
    const name = BrickTools.NewSetsShared.textValue('#ps-name').toLowerCase();
    const theme = BrickTools.NewSetsShared.textValue('#ps-theme');
    const min = BrickTools.NewSetsShared.numberValue('#ps-price-min');
    const max = BrickTools.NewSetsShared.numberValue('#ps-price-max');

    return yearPurchases().filter(function(p) {
      if (name && String(p.name || '').toLowerCase().indexOf(name) === -1) {
        return false;
      }
      if (theme && p.theme !== theme) {
        return false;
      }
      return BrickTools.NewSetsShared.priceMatches(p.officialPrice, min, max);
    }).sort(function(a, b) {
      const byDate = String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || ''));
      return byDate !== 0 ? byDate : String(a.setNumber).localeCompare(String(b.setNumber), undefined, { numeric: true });
    });
  }

  /**
   * Create a set card for a purchase
   * @param {Object} p - Purchase object
   * @returns {jQuery} Set card jQuery element
   */
  function setCard(p) {
    const fmt = BrickTools.fmt;
    const $card = $('<article class="set-card purchased"></article>').attr('data-set-number', p.setNumber);

    const $image = $('<div class="set-card-image"></div>');
    if (p.imageUrl) {
      $image.append($('<img loading="lazy">').attr('src', p.imageUrl).attr('alt', p.name || p.setNumber));
    } else {
      $image.append('<span class="set-card-noimg">No image</span>');
    }
    $card.append($image);

    const $body = $('<div class="set-card-body"></div>');
    $body.append($('<h3></h3>').attr('title', p.name || '').text(p.name || p.setNumber));
    $body.append($('<p class="set-card-sub"></p>')
      .text('#' + p.setNumber + (p.year ? ' · ' + p.year : '') + ' · bought ' + (p.purchaseDate || '—')));

    const facts = [];
    facts.push(p.numParts == null ? '— parts' : fmt.number(p.numParts) + ' parts');
    facts.push(p.officialPrice == null ? '—' : fmt.money(p.officialPrice));
    facts.push('paid ' + (p.price == null ? '—' : fmt.money(p.price)));
    const $facts = $('<p class="set-card-facts"></p>').text(facts.join(' · '));
    if (p.officialPrice == null) {
      $facts.append(' ').append(BrickSets.priceButton(p.setNumber, function() {
        BrickTools.PurchasesTable.load();
      }));
    }
    $body.append($facts);

    const $footer = $('<div class="set-card-footer"></div>');
    $footer.append(BrickTools.NewSetsShared.themeChip(p.theme, p.themeImageUrl, p.themeColor));
    if (p.broughtByImageUrl) {
      const $buyer = $('<img loading="lazy" class="person-img">')
        .attr('src', p.broughtByImageUrl)
        .attr('alt', p.broughtBy)
        .attr('title', p.broughtBy);
      if (p.broughtByColor) {
        $buyer.css('border-color', p.broughtByColor);
      }
      $footer.append($buyer);
    } else if (p.broughtBy) {
      $footer.append(BrickTools.tag(p.broughtBy));
    }
    $body.append($footer);

    $card.append($body);
    return $card;
  }

  /**
   * Render the purchased set cards and summary
   */
  function render() {
    renderYearSelector();
    renderThemeFilter();
    const rows = filteredPurchases();
    const total = yearPurchases().length;
    const $host = $('#ps-cards').empty();
    if (rows.length === 0) {
      $host.append('<p class="muted">No sets match the filters.</p>');
    } else {
      const fragment = document.createDocumentFragment();
      rows.forEach(function(p) {
        fragment.appendChild(setCard(p)[0]);
      });
      $host.append(fragment);
    }
    BrickTools.NewSetsShared.report('#ps-summary', 'Showing ' + rows.length + ' of ' + total
      + ' sets purchased in ' + selectedYear);
  }

  /**
   * Change the selected purchase year and re-render
   * @param {number} year - Year to show
   */
  function selectYear(year) {
    selectedYear = year;
    render();
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the sets module
   */
  function init() {
    $('#ps-year-prev').on('click', function() { selectYear(selectedYear - 1); });
    $('#ps-year-next').on('click', function() { selectYear(selectedYear + 1); });
    $('#ps-year-value').on('change', function() {
      const year = parseInt($(this).val(), 10);
      if (!isNaN(year)) {
        selectYear(year);
      }
    });

    $('#ps-filters').on('input change', 'input, select', render);

    $('#ps-reset').on('click', function() {
      $('#ps-name').val('');
      $('#ps-theme').val('');
      $('#ps-price-min').val('');
      $('#ps-price-max').val('');
      render();
    });

    $('#ps-cards').on('click', '.set-card', function() {
      const setNumber = $(this).attr('data-set-number');
      const purchase = BrickTools.PurchasesShared.getPurchases().find(function(p) {
        return String(p.setNumber) === String(setNumber);
      }) || null;
      BrickSets.openSetSites(setNumber, purchase);
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PurchasesSets = {
    init: init,
    render: render
  };
})();
