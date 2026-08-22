(function () {
  var root = document.querySelector('[data-mavile-cart]');
  if (!root) return;
  var cartUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root ? window.Shopify.routes.root : '/') + 'cart/change.js';

  function change(key, quantity) {
    fetch(cartUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    }).then(function (res) {
      if (res.ok) window.location.reload();
    });
  }

  root.addEventListener('click', function (event) {
    var line = event.target.closest('[data-line]');
    if (!line) return;
    var key = line.getAttribute('data-line');
    var delta = event.target.getAttribute('data-qty-change');
    var set = event.target.getAttribute('data-qty-set');
    if (set === '0') {
      event.preventDefault();
      change(key, 0);
      return;
    }
    if (delta) {
      event.preventDefault();
      var current = parseInt(line.querySelector('.storefront-cart__qty span').textContent, 10);
      change(key, Math.max(0, current + parseInt(delta, 10)));
    }
  });
})();
