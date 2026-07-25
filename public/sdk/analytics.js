/**
 * Standalone Client Analytics SDK (v1.0.0)
 * Lightweight (<1.5KB), zero-dependency tracker supporting multi-tenant siteId,
 * SPA auto-route transitions, and UTM campaign parameters.
 */
(function (window, document) {
  'use strict';

  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var scriptOrigin = '';
  try {
    if (currentScript && currentScript.src) {
      scriptOrigin = new URL(currentScript.src).origin;
    }
  } catch (e) {}

  var configSiteId = (currentScript && currentScript.getAttribute('data-site-id')) || 'default';
  var configHost = (currentScript && currentScript.getAttribute('data-host')) || scriptOrigin;
  var configEndpointAttr = (currentScript && currentScript.getAttribute('data-endpoint')) || '/api/analytics/visit';
  var configEndpoint = configHost ? (configHost.replace(/\/$/, '') + configEndpointAttr) : configEndpointAttr;
  var autoTrack = (currentScript && currentScript.getAttribute('data-auto-track')) !== 'false';

  function parseUtmParams() {
    var params = {};
    if (!window.location.search) return params;
    try {
      var searchParams = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        var val = searchParams.get(key);
        if (val) params[key] = val;
      });
    } catch (e) {}
    return params;
  }

  function trackVisit(customPath, customData) {
    var visitPath = customPath || window.location.pathname;
    if (!visitPath || visitPath.indexOf('/api') === 0 || visitPath.indexOf('/admin') === 0) return;

    var utms = parseUtmParams();
    var payload = Object.assign({
      siteId: configSiteId,
      path: visitPath,
      fullUrl: window.location.href,
      referrer: document.referrer || '',
    }, utms, customData || {});

    var payloadString = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payloadString], { type: 'application/json' });
        navigator.sendBeacon(configEndpoint, blob);
      } else {
        fetch(configEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  if (autoTrack) {
    trackVisit();
    var origPushState = history.pushState;
    if (origPushState) {
      history.pushState = function () {
        var result = origPushState.apply(this, arguments);
        trackVisit();
        return result;
      };
    }
    window.addEventListener('popstate', function () {
      trackVisit();
    });
  }

  window.AnalyticsSDK = {
    init: function (cfg) {
      if (cfg.siteId) configSiteId = cfg.siteId;
      if (cfg.endpoint) configEndpoint = cfg.endpoint;
    },
    trackVisit: trackVisit
  };
})(window, document);
