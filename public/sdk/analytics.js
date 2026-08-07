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

  function renderBlockedOverlay(ip) {
    try {
      var blockedIpStr = ip || 'Your IP';
      var overlayHtml = 
        '<div style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:2147483647; background:#0b0f19; color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">' +
          '<div style="background:#151d30; border:1px solid #2a364f; border-radius:20px; padding:40px 32px; max-width:500px; width:100%; text-align:center; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">' +
            '<div style="width:64px; height:64px; background:rgba(239, 68, 68, 0.15); color:#ef4444; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:32px; font-weight:bold; margin:0 auto 24px auto;">🚫</div>' +
            '<h1 style="font-size:1.6rem; font-weight:800; margin:0 0 12px 0; color:#ffffff; letter-spacing:-0.02em;">Access Restricted</h1>' +
            '<p style="font-size:0.95rem; color:#94a3b8; line-height:1.6; margin:0 0 24px 0;">Your IP address <span style="background:#070a10; padding:6px 12px; border-radius:8px; font-family:monospace; color:#ef4444; font-size:0.9rem; word-break:break-all; border:1px solid rgba(239, 68, 68, 0.3);">' + blockedIpStr + '</span> has been detected and blocked due to policy enforcement or suspicious activity.</p>' +
            '<div style="background:#0f172a; border:1px dashed #38bdf8; border-radius:12px; padding:20px; margin-top:12px;">' +
              '<p style="margin:0 0 8px 0; color:#cbd5e1; font-size:0.875rem;">If you believe this is a mistake, send an email to request an unblock:</p>' +
              '<a href="mailto:unblock@consoleapi.in" style="color:#38bdf8; font-weight:700; text-decoration:none; font-size:1.05rem;">unblock@consoleapi.in</a>' +
            '</div>' +
          '</div>' +
        '</div>';

      if (document.body) {
        document.body.innerHTML = overlayHtml;
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          document.body.innerHTML = overlayHtml;
        });
      }
    } catch (e) {}
  }

  function generateBeaconSignature(siteId) {
    var nonce = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    var timeWindow = Math.floor(Date.now() / 300000);
    var secretSalt = 'c0ns0l3ap1_s3cr3t_s4lt_v1_2026';
    
    var rawString = (siteId || 'default') + '_' + timeWindow + '_' + nonce + '_' + secretSalt;
    var hash = 0;
    for (var i = 0; i < rawString.length; i++) {
      var char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    var digest = Math.abs(hash).toString(16);
    return nonce + '.' + timeWindow + '.' + digest;
  }

  function trackVisit(customPath, customData) {
    var visitPath = customPath || window.location.pathname;
    if (!visitPath || visitPath.indexOf('/api') === 0 || visitPath.indexOf('/admin') === 0) return;

    var utms = parseUtmParams();
    var sig = generateBeaconSignature(configSiteId);
    var payload = Object.assign({
      siteId: configSiteId,
      path: visitPath,
      fullUrl: window.location.href,
      referrer: document.referrer || '',
      _sig: sig
    }, utms, customData || {});

    var payloadString = JSON.stringify(payload);

    try {
      fetch(configEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Beacon-Signature': sig
        },
        body: payloadString,
        keepalive: true
      }).then(function (res) {
        if (res.status === 403) {
          res.json().then(function (data) {
            renderBlockedOverlay(data && data.ip ? data.ip : '');
          }).catch(function () {
            renderBlockedOverlay('');
          });
        }
      }).catch(function () {});
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
