(function () {
  var gallery = document.querySelector('[data-mavile-gallery]');
  if (!gallery) return;
  var hero = gallery.querySelector('[data-gallery-hero]');
  var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-thumb]'));
  if (!hero || !thumbs.length) return;

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      var src = thumb.getAttribute('data-src');
      if (src) hero.setAttribute('src', src);
      thumbs.forEach(function (el) {
        el.classList.remove('storefront-gallery__thumb--active');
        el.setAttribute('aria-current', 'false');
      });
      thumb.classList.add('storefront-gallery__thumb--active');
      thumb.setAttribute('aria-current', 'true');
    });
  });
})();
