/**
 * BrickOwl Page
 * Main controller that coordinates all BrickOwl modules
 */
$(function () {
  'use strict';

  BrickTools.initHeader('brickowl');

  // Initialize all modules
  BrickTools.PartInfo.init();
  BrickTools.BrickOwlStats.init();
  BrickTools.BrickOwlOrders.init();

  // Tab initialization
  BrickTools.initTabs('main', function(name) {
    if (name === 'stats') {
      BrickTools.BrickOwlStats.loadStats();
    } else if (name === 'orders') {
      BrickTools.BrickOwlOrders.loadOrders();
    } else if (name === 'items') {
      BrickTools.BrickOwlOrders.loadOrders().done(function() {
        const orders = BrickTools.BrickOwlShared.getOrders();
        if (!$('#bo-order-select').val() && orders.length) {
          $('#bo-order-select').val(orders[0].Id);
        }
        BrickTools.BrickOwlOrders.loadItems($('#bo-order-select').val());
      });
    }
  });

  // Load initial data
  BrickTools.BrickOwlStats.loadStats();
});
