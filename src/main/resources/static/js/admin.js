$(function () {
  'use strict';

  BrickTools.initHeader('admin');

  function refreshRebrickable() {
    return BrickTools.api('GET', '/rebrickable/status').done(function (s) {
      $('#rb-last').text(s.lastDownload || 'never');
      $('#rb-update')
        .prop('disabled', !s.canUpdate)
        .attr('title', s.canUpdate ? '' : 'Already downloaded today');
      $('#rb-stale').prop('hidden', !s.stale);
    });
  }

  $('#rb-update').on('click', function () {
    const $button = $(this).prop('disabled', true);
    $('#rb-msg').text('Downloading Rebrickable data, this may take a while...');
    BrickTools.api('POST', '/rebrickable/update')
      .done(function (r) { $('#rb-msg').text('Update completed on ' + r.lastDownload + '.'); })
      .fail(function (xhr) { $('#rb-msg').text(BrickTools.errorOf(xhr)); })
      .always(function () { refreshRebrickable(); });
  });

  $('#bw-form').on('submit', function (e) {
    e.preventDefault();
    const setNumber = $.trim($('#bw-set').val());
    $('#bw-result').text('Fetching price...');
    BrickTools.api('GET', '/brickwatch/sets/' + encodeURIComponent(setNumber) + '/price')
      .done(function (r) {
        const origin = r.source === 'stored' ? 'already stored' : 'fetched from BrickWatch';
        $('#bw-result').text(r.setNumber + ': ' + BrickTools.fmt.money(r.legoPrice) + ' (' + origin + ')');
      })
      .fail(function (xhr) { $('#bw-result').text(BrickTools.errorOf(xhr)); });
  });

  refreshRebrickable().fail(function (xhr) {
    $('#rb-msg').text(BrickTools.errorOf(xhr));
  });
});
