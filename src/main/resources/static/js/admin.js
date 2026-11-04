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

  $('#bw-brickonomics').on('click', function () {
    const setNumber = $.trim($('#bw-set').val());
    if (!setNumber) {
      $('#bw-result').text('Enter a set number first.');
      return;
    }
    $('#bw-result').text('Fetching price from brickonomics...');
    BrickTools.api('POST', '/brickonomics/sets/' + encodeURIComponent(setNumber) + '/price')
      .done(function (r) {
        $('#bw-result').text(r.setNumber + ': ' + BrickTools.fmt.money(r.legoPrice) + ' (fetched from brickonomics and saved)');
      })
      .fail(function (xhr) { $('#bw-result').text(BrickTools.errorOf(xhr)); });
  });

  function renderBackfill(p) {
    let text = 'No purchased sets to check';
    if (p.total) {
      const state = p.running ? 'Running: ' + p.processed + ' of ' + p.total + ' sets checked' : 'Finished';
      text = state + ' - ' + p.downloaded + ' downloaded, ' + p.skipped + ' already stored, ' +
        p.noImage + ' without picture, ' + p.failed + ' failed' +
        (p.lastError ? ' (last error: ' + p.lastError + ')' : '');
    }
    $('#img-status').text(text);
    $('#img-backfill').prop('disabled', p.running);
    if (p.running) {
      setTimeout(pollBackfill, 2000);
    }
  }

  function pollBackfill() {
    BrickTools.api('GET', '/setimg/backfill').done(renderBackfill);
  }

  $('#img-backfill').on('click', function () {
    BrickTools.api('POST', '/setimg/backfill')
      .done(renderBackfill)
      .fail(function (xhr) {
        if (xhr.responseJSON && 'running' in xhr.responseJSON) {
          renderBackfill(xhr.responseJSON);
        } else {
          $('#img-status').text(BrickTools.errorOf(xhr));
        }
      });
  });

  function renderBackups(list) {
    const $list = $('#backup-list').empty();
    if (list.length === 0) {
      $list.append('<li>No backup yet</li>');
      return;
    }
    list.forEach(function (b) {
      $list.append($('<li></li>').text(b.name + ' (' + BrickTools.fmt.number(Math.round(b.size / 1024)) + ' KB)'));
    });
  }

  function refreshBackups() {
    return BrickTools.api('GET', '/backups').done(renderBackups);
  }

  $('#backup-create').on('click', function () {
    const $button = $(this).prop('disabled', true);
    $('#backup-msg').text('Creating backup...');
    BrickTools.api('POST', '/backups')
      .done(function (r) { $('#backup-msg').text('Backup created: ' + r.name + ' (' + r.files.length + ' files).'); })
      .fail(function (xhr) { $('#backup-msg').text(BrickTools.errorOf(xhr)); })
      .always(function () {
        $button.prop('disabled', false);
        refreshBackups();
      });
  });

  refreshRebrickable().fail(function (xhr) {
    $('#rb-msg').text(BrickTools.errorOf(xhr));
  });
  refreshBackups();
  pollBackfill();
});
