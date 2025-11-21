(function(){
  'use strict';

  // Read API and token from globals (set during export)
  var API = (window.STATS_API || '/stats_track.php').replace(/\/+$/, '');
  var TOKEN = window.STATS_TOKEN || 'default';

  var sessionSent = false;

  // Generate / read anonymous ids
  function uuid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
        var r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8);
        return v.toString(16);
      });
  }
  function getUid() {
    try {
      var k = 'zb_uid_v1';
      var v = localStorage.getItem(k);
      if (!v) { v = uuid(); localStorage.setItem(k, v); }
      return v;
    } catch(e) {
      return ''; // no localStorage
    }
  }
  function getSid() {
    try {
      var k='zb_sid_v1';
      var v = sessionStorage.getItem(k);
      if (!v) { v = uuid(); sessionStorage.setItem(k, v); }
      return v;
    } catch(e) { return ''; }
  }

  function send(payload) {
    var fd = new FormData();
    fd.append('action', 'track');
    fd.append('token', TOKEN);
    for (var k in payload) { if (payload[k] != null) fd.append(k, String(payload[k])); }

    // Prefer beacon for reliability on navigation
    if (navigator.sendBeacon) {
      try {
        var u = API;
        var blob = new Blob([new URLSearchParams(Array.from(fd)).toString()], {type:'application/x-www-form-urlencoded'});
        navigator.sendBeacon(u, blob);
        return;
      } catch(e) {}
    }
    // Fallback
    try {
      fetch(API, { method:'POST', mode:'cors', credentials:'omit', body: fd });
    } catch(e) {}
  }

  function basePayload() {
    return {
      type: 'visit',
      domain: location.hostname.replace(/^www\./,''),
      url: location.href,
      referrer: document.referrer || '',
      uid: getUid(),
      sid: getSid(),
      user_agent: navigator.userAgent,
      page_title: document.title || ''
    };
  }

  function trackVisitOncePerSession() {
    if (!sessionSent) {
      var p = basePayload();
      p.type = 'visit';
      send(p);
      sessionSent = true;
    }
  }

  function trackFileButtons() {
    document.addEventListener('click', function(e){
      var a = e.target.closest('.el.filebtn a, .el.Filebtn a, .bf-filebtn');
      if (!a) return;
      var p = basePayload();
      p.type = 'download';
      p.file_name = a.getAttribute('download') || a.dataset.fileName || (a.href ? a.href.split('/').pop() : 'unknown');
      p.file_url = a.href || '';
      send(p);
    }, true);
  }

  function trackLinkButtons() {
    document.addEventListener('click', function(e){
      var a = e.target.closest('.el.linkbtn a, .el.Linkbtn a, .bl-linkbtn');
      if (!a) return;
      var p = basePayload();
      p.type = 'link';
      p.link_url = a.href || '';
      send(p);
    }, true);
  }

  // Probe settings (optional)
  fetch(API + '?action=getSettings', {mode:'cors', credentials:'omit'}).then(function(r){ return r.json(); })
    .then(function(cfg){
      // if server says disabled, abort
      if (cfg && cfg.settings && cfg.settings.enabled === false) return;
      trackVisitOncePerSession();
      trackFileButtons();
      trackLinkButtons();
    }).catch(function(){
      // Even if settings fetch fails, still try to track
      trackVisitOncePerSession();
      trackFileButtons();
      trackLinkButtons();
    });

})();