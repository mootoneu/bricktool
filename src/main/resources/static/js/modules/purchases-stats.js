/**
 * Purchases - Statistics Module
 * Handles statistics display and chart rendering
 */
(function () {
  'use strict';

  // ============================================================================
  // Chart rendering functions
  // ============================================================================

  /**
   * Render a donut chart
   * @param {string} selector - CSS selector for the chart container
   * @param {Array} entries - Chart data entries with name and value
   * @param {Function} format - Function to format values
   */
  function renderDonut(selector, entries, format) {
    const host = d3.select(selector);
    host.html('');
    if (entries.length === 0) {
      host.append('p').attr('class', 'muted').text('No data');
      return;
    }

    const CHART_COLORS = BrickTools.PurchasesShared.CHART_COLORS;
    const total = d3.sum(entries, function(e) { return e.value; });
    const color = d3.scaleOrdinal()
      .domain(entries.map(function(e) { return e.name; }))
      .range(CHART_COLORS);
    const width = 170;
    const height = 170;
    const radius = Math.min(width, height) / 2;
    const arcs = d3.pie().value(function(e) { return e.value; }).sort(null)(entries);
    const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius - 2);

    const wrap = host.append('div').attr('class', 'donut-wrap');
    const svg = wrap.append('svg')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('class', 'donut-svg')
      .attr('role', 'img');
    const plot = svg.append('g').attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');

    plot.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc)
      .attr('fill', function(d) { return color(d.data.name); })
      .append('title')
      .text(function(d) { 
        return d.data.name + ': ' + format(d.data.value) + ' (' + (d.data.value / total * 100).toFixed(1) + ' %)'; 
      });

    plot.append('text')
      .attr('class', 'donut-total')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(format(total));

    const legend = wrap.append('ul').attr('class', 'donut-legend');
    const items = legend.selectAll('li').data(entries).join('li');
    items.append('span').attr('class', 'swatch').style('background', function(d) { return color(d.name); });
    items.append('span').attr('class', 'legend-label').text(function(d) { return d.name; });
    items.append('span').attr('class', 'legend-value').text(function(d) { return format(d.value); });
  }

  /**
   * Draw year bars chart
   * @param {HTMLElement} el - DOM element to render into
   * @param {Array} data - Chart data
   * @param {Object} metric - Metric configuration
   * @param {boolean} showXAxis - Whether to show X axis
   */
  function drawYearBars(el, data, metric, showXAxis) {
    // Match the SVG coordinate system to the available card width so labels
    // keep a readable size on phones instead of being scaled down from 960px.
    const width = Math.max(320, Math.floor(el.clientWidth || 960));
    const height = 170;
    const compact = width < 560;
    const margin = { top: 26, right: compact ? 10 : 16, bottom: showXAxis ? 34 : 12, left: compact ? 46 : 74 };
    const value = function(d) { return Number(d[metric.key]) || 0; };
    const x = d3.scaleBand()
      .domain(data.map(function(d) { return d.year; }))
      .range([margin.left, width - margin.right])
      .padding(0.25);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, value) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3.select(el).append('svg')
      .attr('class', 'chart')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('role', 'img');
    const band = x.bandwidth();
    const barWidth = Math.min(band, 72);
    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', margin.left)
      .attr('y', 16)
      .text(metric.label);

    const xAxis = d3.axisBottom(x).tickSizeOuter(0);
    if (!showXAxis) {
      xAxis.tickFormat('').tickSize(0);
    }
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + (height - margin.bottom) + ')')
      .call(xAxis);
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + margin.left + ',0)')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')));

    svg.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', function(d) { return x(d.year) + (band - barWidth) / 2; })
      .attr('width', barWidth)
      .attr('y', function(d) { return y(value(d)); })
      .attr('height', function(d) { return y(0) - y(value(d)); })
      .attr('rx', 2)
      .attr('fill', metric.color)
      .append('title')
      .text(function(d) { return d.year + ': ' + metric.format(d[metric.key]); });
  }

  /**
   * Render year chart with multiple metrics
   */
  function renderYearChart() {
    const theme = $('#stat-theme').val() || '';
    const buyer = $('#stat-buyer').val() || '';
    const owner = $('#stat-owner').val() || '';
    const purchases = BrickTools.PurchasesShared.getPurchases();
    const rows = purchases.filter(function(p) { 
      return p.owned
        && (!theme || p.theme === theme)
        && (!buyer || p.broughtBy === buyer)
        && (!owner || p.owner === owner);
    });

    const byYear = new Map();
    rows.forEach(function(p) {
      const year = String(p.purchaseDate || '').slice(0, 4);
      if (!/^\d{4}$/.test(year)) return;
      const entry = byYear.get(year) || { year: year, count: 0, price: 0, parts: 0 };
      entry.count += 1;
      entry.price += Number(p.price) || 0;
      entry.parts += Number(p.numParts) || 0;
      byYear.set(year, entry);
    });
    const data = Array.from(byYear.values()).sort(function(a, b) { 
      return a.year.localeCompare(b.year); 
    });

    const host = d3.select('#stat-year');
    host.html('');
    if (data.length === 0) {
      host.append('p').attr('class', 'muted').text('No owned purchases match these filters.');
      return;
    }

    const metrics = [
      { key: 'count', label: 'Sets', color: '#2563eb', format: BrickTools.fmt.number },
      { key: 'price', label: 'Price', color: '#059669', format: BrickTools.fmt.money },
      { key: 'parts', label: 'Total parts', color: '#d97706', format: BrickTools.fmt.number }
    ];
    metrics.forEach(function(metric, index) {
      const el = host.append('div').attr('class', 'year-chart').node();
      drawYearBars(el, data, metric, index === metrics.length - 1);
    });
  }

  /**
   * Render all statistics
   */
  function renderStatistics() {
    const purchases = BrickTools.PurchasesShared.getPurchases();
    const owned = purchases.filter(function(p) { return p.owned; });
    const notOwned = purchases.filter(function(p) { return !p.owned; });

    $('#stat-count').text(BrickTools.fmt.number(owned.length));
    $('#stat-price').text(BrickTools.fmt.money(BrickTools.PurchasesShared.totalOf(owned, 'price')));
    $('#stat-parts').text(BrickTools.fmt.number(BrickTools.PurchasesShared.totalOf(owned, 'numParts')));
    $('#stat-not-owned-count').text(BrickTools.fmt.number(notOwned.length));
    $('#stat-not-owned-price').text(BrickTools.fmt.money(BrickTools.PurchasesShared.totalOf(notOwned, 'price')));

    if (typeof d3 === 'undefined') {
      $('.stats-charts, #stat-year').html('<p class="muted">Charts are unavailable.</p>');
      return;
    }

    renderDonut('#stat-theme-count', BrickTools.PurchasesShared.themeEntries(owned, function() { return 1; }), BrickTools.fmt.number);
    renderDonut('#stat-theme-price', BrickTools.PurchasesShared.themeEntries(owned, function(p) { return p.price; }), BrickTools.fmt.money);
    renderDonut('#stat-theme-parts', BrickTools.PurchasesShared.themeEntries(owned, function(p) { return p.numParts; }), BrickTools.fmt.number);
    renderYearChart();
  }

  // ============================================================================
  // Module initialization
  // ============================================================================

  /**
   * Initialize the statistics module
   */
  function init() {
    // Statistic filters
    $('#stat-filters').on('change', 'select', renderYearChart);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  BrickTools.PurchasesStats = {
    init: init,
    renderDonut: renderDonut,
    drawYearBars: drawYearBars,
    renderYearChart: renderYearChart,
    renderStatistics: renderStatistics
  };
})();
