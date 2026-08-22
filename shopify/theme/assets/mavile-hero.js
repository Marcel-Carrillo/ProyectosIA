(function () {
  var root = document.querySelector('[data-mavile-hero]');
  if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll('.storefront-hero__bg-slide'));
  var copies = Array.prototype.slice.call(root.querySelectorAll('[data-hero-copy]'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('[data-hero-dot]'));
  if (slides.length < 2) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var interval = parseInt(root.getAttribute('data-rotate-ms') || '7000', 10);
  var index = 0;
  var timer;

  function show(next) {
    slides[index].classList.remove('storefront-hero__bg-slide--active');
    if (copies[index]) copies[index].classList.remove('storefront-hero__copy--visible');
    if (dots[index]) dots[index].classList.remove('storefront-hero__dot--active');
    index = next % slides.length;
    slides[index].classList.add('storefront-hero__bg-slide--active');
    if (copies[index]) copies[index].classList.add('storefront-hero__copy--visible');
    if (dots[index]) dots[index].classList.add('storefront-hero__dot--active');
  }

  function start() {
    timer = window.setInterval(function () {
      show(index + 1);
    }, interval);
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      window.clearInterval(timer);
      show(i);
      start();
    });
  });

  start();
})();
