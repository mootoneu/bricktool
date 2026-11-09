/**
 * New Sets Page
 * Main controller that coordinates all new sets modules
 */
$(function () {
  'use strict';

  BrickTools.initHeader('newsets');

  // Initialize all modules
  BrickTools.NewSetsCatalogue.init();
  BrickTools.NewSetsWishlist.init();

  // Set up tab switching
  BrickTools.initTabs('main', function (name) {
    if (name === 'sets') {
      BrickTools.NewSetsCatalogue.renderSets(!BrickTools.NewSetsShared.getForceSetReset());
      BrickTools.NewSetsShared.setForceSetReset(false);
    } else if (name === 'wishlist') {
      BrickTools.NewSetsWishlist.renderWishlistFilterOptions();
      BrickTools.NewSetsWishlist.renderWishlist();
    } else if (name === 'themes') {
      BrickTools.NewSetsCatalogue.renderThemes();
    }
  });

  // Set up IntersectionObserver for infinite scroll
  function setupSetObserver() {
    const observer = BrickTools.NewSetsShared.getSetObserver();
    if (!observer && 'IntersectionObserver' in window) {
      const newObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            BrickTools.NewSetsCatalogue.loadMoreSets();
          }
        });
      }, { threshold: 0.1 });
      BrickTools.NewSetsShared.setSetObserver(newObserver);
      newObserver.observe(document.getElementById('set-loader'));
    }
  }

  setupSetObserver();
  BrickTools.NewSetsCatalogue.loadAll();
});
