(function () {
  var header = document.querySelector('[data-mavile-header]');
  if (!header) return;
  var toggle = header.querySelector('[data-mavile-menu-toggle]');
  var menu = header.querySelector('[data-mavile-mobile-menu]');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function () {
    var open = menu.hasAttribute('hidden') === false;
    if (open) {
      menu.setAttribute('hidden', '');
      menu.classList.remove('storefront-header__mobile-menu--open');
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      menu.removeAttribute('hidden');
      menu.classList.add('storefront-header__mobile-menu--open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
})();
