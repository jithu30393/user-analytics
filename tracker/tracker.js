/*!
 * CausalFunnel-style lightweight tracker
 * Usage:
 *   <script src="https://YOUR_API_HOST/tracker.js" data-endpoint="https://YOUR_API_HOST/api/events"></script>
 * If data-endpoint is omitted, it defaults to <script origin>/api/events.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var endpoint =
    (script && script.getAttribute('data-endpoint')) ||
    (script && script.src ? new URL(script.src).origin + '/api/events' : '/api/events');

  var STORAGE_KEY = 'cf_session';
  var COOKIE_KEY = 'cf_session_id';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // new session after 30 min of inactivity

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=1800; SameSite=Lax';
  }

  // Session id: localStorage first, cookie as fallback, in-memory as last resort.
  var memorySession = null;
  function getSessionId() {
    var now = Date.now();
    var session = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) session = JSON.parse(raw);
    } catch (e) {}
    if (!session) {
      var c = readCookie(COOKIE_KEY);
      if (c) session = { id: c, last: now };
    }
    if (!session && memorySession) session = memorySession;

    if (!session || now - session.last > SESSION_TIMEOUT_MS) {
      session = { id: uuid(), last: now };
    }
    session.last = now;
    memorySession = session;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) {}
    try { writeCookie(COOKIE_KEY, session.id); } catch (e) {}
    return session.id;
  }

  function docSize() {
    var d = document.documentElement, b = document.body || {};
    return {
      page_width: Math.max(d.scrollWidth, b.scrollWidth || 0, d.clientWidth),
      page_height: Math.max(d.scrollHeight, b.scrollHeight || 0, d.clientHeight)
    };
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function () {});
    } catch (e) {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        }
      } catch (e2) {}
    }
  }

  function track(type, extra) {
    var size = docSize();
    var event = {
      session_id: getSessionId(),
      type: type,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      page_width: size.page_width,
      page_height: size.page_height
    };
    if (extra) for (var k in extra) event[k] = extra[k];
    send(event);
  }

  // --- page_view (initial load + SPA navigation) ---
  function pageView() { track('page_view', { referrer: document.referrer || null, title: document.title }); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageView);
  } else {
    pageView();
  }

  var lastUrl = window.location.href;
  function onUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      pageView();
    }
  }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var res = orig.apply(this, arguments);
      setTimeout(onUrlChange, 0);
      return res;
    };
  });
  window.addEventListener('popstate', onUrlChange);

  // --- click ---
  document.addEventListener(
    'click',
    function (e) {
      track('click', {
        x: Math.round(e.pageX),          // coordinates relative to the full document
        y: Math.round(e.pageY),
        client_x: Math.round(e.clientX), // coordinates relative to the viewport
        client_y: Math.round(e.clientY),
        target: e.target && e.target.tagName ? e.target.tagName.toLowerCase() : null
      });
    },
    true
  );
})();
