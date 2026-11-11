/**
 * Parts Collection Page
 * Main controller that coordinates all parts collection modules
 */
$(function () {
  'use strict';

  BrickTools.initHeader('partscollection');

  // Initialize all modules
  BrickTools.PartInfo.init();
  BrickTools.PartsCollectionBrickOwl.init();
  BrickTools.PartsCollectionPab.init();
  BrickTools.PartsCollectionExplorer.init();
  BrickTools.PartsCollectionStorage.init();

  // Tab initialization
  BrickTools.initTabs('main', function (name) {
    if (name === 'brickowl') {
      BrickTools.PartsCollectionBrickOwl.refresh();
    }
    if (name === 'explorer' && !BrickTools.PartsCollectionExplorer.isCategoriesLoaded()) {
      BrickTools.PartsCollectionExplorer.loadPartCategories();
    }
    if (name === 'storage' && !BrickTools.PartsCollectionStorage.isStoragesLoaded()) {
      BrickTools.PartsCollectionStorage.loadStorages();
    }
    if (name === 'drawers') {
      if (!BrickTools.PartsCollectionStorage.isStoragesLoaded()) {
        BrickTools.PartsCollectionStorage.loadStorages();
      }
      if (!BrickTools.PartsCollectionStorage.isDrawersLoaded()) {
        BrickTools.PartsCollectionStorage.loadDrawers();
      }
    }
    if (name === 'pab-purchases' && !BrickTools.PartsCollectionPab.isPabLoaded()) {
      BrickTools.PartsCollectionPab.loadPabPurchases();
    }
    if (name === 'pab-parts') {
      if (BrickTools.PartsCollectionPab.isPabLoaded()) {
        BrickTools.PartsCollectionPab.populatePabPurchaseSelect();
        BrickTools.PartsCollectionPab.loadPabParts();
      } else {
        BrickTools.PartsCollectionPab.loadPabPurchases(function () {
          BrickTools.PartsCollectionPab.populatePabPurchaseSelect();
          BrickTools.PartsCollectionPab.loadPabParts();
        });
      }
    }
  });

  // Open a category (and part) when navigating from the part information modal.
  const params = new URLSearchParams(window.location.search);
  const explorerCategory = params.get('explorerCategory');
  if (explorerCategory) {
    const explorerPart = params.get('explorerPart') || '';
    params.delete('explorerCategory');
    params.delete('explorerPart');
    const query = params.toString();
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '',
        window.location.pathname + (query ? '?' + query : '') + '#explorer');
    }
    $('[data-tab="explorer"]').trigger('click');
    BrickTools.PartsCollectionExplorer.showPart(explorerCategory, explorerPart);
  }

  // Initial load for default tab
  if (!BrickTools.PartsCollectionBrickOwl.isLoaded()) {
    BrickTools.PartsCollectionBrickOwl.refresh();
  }
});
