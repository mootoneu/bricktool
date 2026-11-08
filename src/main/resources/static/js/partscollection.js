/**
 * Parts Collection Page
 * Main controller that coordinates all parts collection modules
 */
$(function () {
  'use strict';

  BrickTools.initHeader('partscollection');

  // Initialize all modules
  BrickTools.PartsCollectionBrickOwl.init();
  BrickTools.PartsCollectionPab.init();
  BrickTools.PartsCollectionExplorer.init();

  // Tab initialization
  BrickTools.initTabs('main', function (name) {
    if (name === 'brickowl') {
      BrickTools.PartsCollectionBrickOwl.refresh();
    }
    if (name === 'explorer' && !BrickTools.PartsCollectionExplorer.isCategoriesLoaded()) {
      BrickTools.PartsCollectionExplorer.loadPartCategories();
    }
    if (name === 'pab-purchases' && !BrickTools.PartsCollectionPab.isPabLoaded()) {
      BrickTools.PartsCollectionPab.loadPabPurchases();
    }
    if (name === 'pab-parts') {
      if (BrickTools.PartsCollectionPab.isPabLoaded()) {
        BrickTools.PartsCollectionPab.loadPabParts();
      } else {
        BrickTools.PartsCollectionPab.loadPabPurchases(function () {
          BrickTools.PartsCollectionPab.loadPabParts();
        });
      }
    }
  });

  // Initial load for default tab
  if (!BrickTools.PartsCollectionBrickOwl.isLoaded()) {
    BrickTools.PartsCollectionBrickOwl.refresh();
  }
});
