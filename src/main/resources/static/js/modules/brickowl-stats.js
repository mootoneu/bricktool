/**
 * BrickOwl - Statistics Module
 * Handles statistics display and chart rendering
 */
(function () {
  'use strict';

  // ============================================================================
  // Public API methods
  // ============================================================================

  /**
   * Load statistics from API
   * @returns {jQuery} Promise
   */
  function loadStats() {
    return BrickTools.api('GET', '/brickowl/stats')
      .done(renderStats)
      .fail(function(xhr) { BrickTools.BrickOwlShared.report('#bo-stats-msg', BrickTools.errorOf(xhr)); });
  }

  /**
   * Render statistics
   * @param {Object} stats - Statistics data
   */
  function renderStats(stats) {
    const fmt = BrickTools.BrickOwlShared.fmt;
    const esc = BrickTools.BrickOwlShared.esc;
    const METRICS = BrickTools.BrickOwlShared.METRICS;
    
    BrickTools.BrickOwlShared.report('#bo-stats-msg', '');
    const t = stats.totals;

    const totals = [
      ['Total amount', fmt.money(t.amount)],
      ['Pieces', fmt.number(t.pieces)],
      ['Minifigs', fmt.number(t.minifigs)],
      ['Sets', fmt.number(t.sets)],
      ['Orders', fmt.number(t.orders)]
    ];
    $('#bo-totals').html(totals.map(function(pair) {
      return '<div class="stat"><h3>' + esc(pair[0]) + '</h3><div class="value">' + esc(pair[1]) + '</div></div>';
    }).join(''));

    const rows = METRICS.map(function(m) {
      const avg = stats.averages[m.key];
      return '<tr><th>' + esc(m.label) + '</th><td>' + esc(m.format(avg.mean)) + '</td><td>' +
        esc(m.format(avg.median)) + '</td></tr>';
    }).join('');
    $('#bo-averages').html(
      '<section class="card"><h2>Averages per order</h2><div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Metric</th><th>Mean</th><th>Median</th></tr></thead><tbody>' + rows +
      '</tbody></table></div></section>'
    );

    // Render histograms
    const storeRows = stats.byStoreYear.map(function(d) { 
      return { store: d.store || 'Unknown store', year: String(d.year), 
               amount: d.amount || 0, pieces: d.pieces || 0, pricePerPiece: d.pricePerPiece || 0, 
               pricePerKg: d.pricePerKg || 0, minifigs: d.minifigs || 0, sets: d.sets || 0 };
    });
    const stores = Array.from(new Set(storeRows.map(function(d) { return d.store; }))).sort(function(a, b) { 
      return a.localeCompare(b); 
    });
    const years = Array.from(new Set(storeRows.map(function(d) { return d.year; }))).sort(function(a, b) { 
      return a.localeCompare(b); 
    });
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(stores);
    const byKey = new Map(storeRows.map(function(d) { return [d.store + '\u0000' + d.year, d]; }));

    const $legend = $('<div class="legend"></div>');
    stores.forEach(function(s) { 
      $legend.append($('<span class="legend-item"></span>')
        .append($('<span class="legend-swatch"></span>').css('background-color', color(s)))
        .append(document.createTextNode(' ' + s)));
    });

    const $card = $('<section class="card"></section>')
      .append($('<h2>Histograms by year</h2>'))
      .append($legend);
    const $grid = $('<div class="grid"></div>').appendTo($card);
    METRICS.forEach(function(m) { 
      BrickTools.BrickOwlStats.drawBars($('<div></div>').appendTo($grid)[0], storeRows, byKey, years, stores, color, m); 
    });
    $('#bo-histograms').empty().append($card);
  }

  /**
   * Draw histogram bars
   * @param {HTMLElement} el - DOM element to render into
   * @param {Array} rows - Data rows
   * @param {Map} byKey - Map of data by store+year key
   * @param {Array} years - Array of years
   * @param {Array} stores - Array of store names
   * @param {Function} color - Color scale function
   * @param {Object} metric - Metric configuration
   */
  function drawBars(el, rows, byKey, years, stores, color, metric) {
    const width = 320, height = 180;
    const margin = { top: 24, right: 8, bottom: 28, left: 56 };
    const valueOf = function(store, year) {
      const d = byKey.get(store + '\u0000' + year);
      return d ? d[metric.key] || 0 : 0;
    };
    const groups = years.map(function(year) ({
      year: year,
      bars: stores.map(function(store) { 
        return { store: store, year: year, value: valueOf(store, year) }; 
      })
    }));

    const x = d3.scaleBand()
      .domain(years)
      .range([margin.left, width - margin.right])
      .padding(0.2);
    const x1 = d3.scaleBand()
      .domain(stores)
      .range([0, x.bandwidth()])
      .padding(0.1);
    const y = d3.scaleLinear()
      .domain([0, d3.max(rows, function(d) { return d[metric.key] || 0; }) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3.select(el).append('svg')
      .attr('class', 'chart')
      .attr('viewBox', '0 0 ' + width + ' ' + height);

    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', margin.left)
      .attr('y', 14)
      .text(metric.label);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + (height - margin.bottom) + ')')
      .call(d3.axisBottom(x));

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(4));

    svg.selectAll('g.group')
      .data(groups)
      .join('g')
      .attr('class', 'group')
      .attr('transform', function(d) { return 'translate(' + x(d.year) + ',0)'; })
      .selectAll('rect')
      .data(function(d) { return d.bars; })
      .join('rect')
      .attr('x', function(d) { return x1(d.store); })
      .attr('width', x1.bandwidth())
      .attr('y', function(d) { return y(d.value); })
      .attr('height', function(d) { return y(0) - y(d.value); })
      .attr('fill', function(d) { return color(d.store); })
      .append('title')
      .text(function(d) { return d.store + ' ' + d.year + ': ' + metric.format(d.value); });
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the statistics module
   */
  function init() {
    // Nothing to initialize for stats module
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.BrickOwlStats = {
    init: init,
    loadStats: loadStats,
    renderStats: renderStats,
    drawBars: drawBars
  };
})();
