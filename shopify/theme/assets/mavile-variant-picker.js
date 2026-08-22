(function () {
  var root = document.querySelector('[data-mavile-product]');
  if (!root) return;
  var jsonEl = root.querySelector('[data-product-json]');
  if (!jsonEl) return;
  var product = JSON.parse(jsonEl.textContent);
  var selected = (product.options || []).map(function (_, i) {
    var active = root.querySelector('[data-option-index="' + i + '"].storefront-variant-btn--active');
    return active ? active.getAttribute('data-option-value') : (product.options[i] && product.options[i].values[0]);
  });
  var idInput = root.querySelector('[data-variant-id]');
  var addBtn = root.querySelector('[data-add-to-cart]');
  var hero = document.querySelector('[data-gallery-hero]');

  function findVariant() {
    return (product.variants || []).find(function (variant) {
      return selected.every(function (value, index) {
        return !value || variant.options[index] === value;
      });
    });
  }

  function optionAvailable(index, value) {
    var trial = selected.slice();
    trial[index] = value;
    return (product.variants || []).some(function (variant) {
      return trial.every(function (v, i) {
        return !v || variant.options[i] === v;
      }) && variant.available;
    });
  }

  function refresh() {
    var buttons = root.querySelectorAll('.storefront-variant-btn');
    buttons.forEach(function (btn) {
      var index = parseInt(btn.getAttribute('data-option-index'), 10);
      var value = btn.getAttribute('data-option-value');
      var available = optionAvailable(index, value);
      btn.disabled = !available;
      var isSelected = selected[index] === value;
      btn.classList.toggle('storefront-variant-btn--active', isSelected);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    var variant = findVariant();
    if (idInput) idInput.value = variant ? variant.id : '';
    if (addBtn) addBtn.disabled = !(variant && variant.available);
    if (hero && variant && variant.featured_image) {
      hero.setAttribute('src', variant.featured_image.src);
    }
  }

  root.addEventListener('click', function (event) {
    var btn = event.target.closest('.storefront-variant-btn');
    if (!btn || btn.disabled) return;
    event.preventDefault();
    var index = parseInt(btn.getAttribute('data-option-index'), 10);
    selected[index] = btn.getAttribute('data-option-value');
    refresh();
  });

  var form = root.querySelector('[data-mavile-product-form]');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = idInput && idInput.value;
      if (!id) return;
      fetch((window.Shopify && window.Shopify.routes && window.Shopify.routes.root ? window.Shopify.routes.root : '/') + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), quantity: 1 })
      }).then(function (res) {
        if (res.ok) window.location.href = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root ? window.Shopify.routes.root : '/') + 'cart';
      });
    });
  }

  refresh();
})();
