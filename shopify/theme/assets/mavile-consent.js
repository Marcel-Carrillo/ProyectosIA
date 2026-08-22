(function () {
  var banner = document.querySelector('[data-mavile-cookie-banner]');
  var overlay = document.querySelector('[data-mavile-cookie-overlay]');
  if (!banner) return;

  function privacyReady(cb) {
    if (window.Shopify && window.Shopify.customerPrivacy && window.Shopify.customerPrivacy.setTrackingConsent) {
      cb();
      return;
    }
    document.addEventListener('visitorConsentCollected', cb, { once: true });
    window.setTimeout(cb, 1500);
  }

  function setConsent(analytics, marketing) {
    privacyReady(function () {
      if (!window.Shopify || !window.Shopify.customerPrivacy || !window.Shopify.customerPrivacy.setTrackingConsent) {
        return;
      }
      window.Shopify.customerPrivacy.setTrackingConsent(
        {
          analytics: analytics,
          marketing: marketing,
          preferences: analytics,
          sale_of_data: marketing
        },
        function () {}
      );
    });
  }

  function hideBanner() {
    banner.setAttribute('hidden', '');
  }

  function showBanner() {
    banner.removeAttribute('hidden');
  }

  function openModal() {
    if (overlay) overlay.removeAttribute('hidden');
  }

  function closeModal() {
    if (overlay) overlay.setAttribute('hidden', '');
  }

  privacyReady(function () {
    var api = window.Shopify && window.Shopify.customerPrivacy;
    if (api && typeof api.shouldShowGDPRBanner === 'function' && api.shouldShowGDPRBanner()) {
      showBanner();
    }
  });

  banner.addEventListener('click', function (event) {
    if (event.target.closest('[data-mavile-consent-accept]')) {
      setConsent(true, true);
      hideBanner();
    }
    if (event.target.closest('[data-mavile-consent-reject]')) {
      setConsent(false, false);
      hideBanner();
    }
    if (event.target.closest('[data-mavile-consent-customize]')) {
      openModal();
    }
  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-mavile-open-cookies]')) {
      openModal();
    }
    if (event.target.closest('[data-mavile-consent-close]')) {
      closeModal();
    }
    if (event.target.closest('[data-mavile-consent-save]') && overlay) {
      var analytics = overlay.querySelector('[data-mavile-consent-analytics]');
      var marketing = overlay.querySelector('[data-mavile-consent-marketing]');
      setConsent(Boolean(analytics && analytics.checked), Boolean(marketing && marketing.checked));
      hideBanner();
      closeModal();
    }
  });
})();
