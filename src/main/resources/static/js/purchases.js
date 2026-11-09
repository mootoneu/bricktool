/**
 * Purchases Page
 * Main controller that coordinates all purchases modules
 */
$(function () {
  'use strict';

  BrickTools.initHeader('purchases');

  // Initialize all modules
  BrickTools.PartInfo.init();
  BrickTools.PurchasesTable.init();
  BrickTools.PurchasesStats.init();
  BrickTools.PurchasesInventory.init();

  // Tab initialization
  BrickTools.initTabs('main', function(name) {
    if (name === 'set-inventory') {
      BrickTools.PurchasesInventory.ensureSetInventoryLoaded();
    }
  });

  // Load initial data
  BrickTools.PurchasesTable.load();
  BrickTools.PurchasesTable.loadOptions();
});
