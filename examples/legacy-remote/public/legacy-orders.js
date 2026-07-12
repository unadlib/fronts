/* global window */

(function registerLegacyOrders(global) {
  function render(target, props) {
    if (!target) return undefined;

    var orderId = props && props.orderId ? String(props.orderId) : 'unknown';
    var article = target.ownerDocument.createElement('article');
    article.className = 'legacy-orders-card';
    article.innerHTML =
      '<p style="color:#78448d;font-size:12px;font-weight:700;text-transform:uppercase">' +
      'Fronts 0.x · legacy script</p><h2>Order ' +
      orderId +
      '</h2><p>This application still uses the old render/cleanup contract.</p>';
    target.appendChild(article);

    return function unmountLegacyOrders() {
      article.remove();
    };
  }

  global.__FRONTS__DYNAMIC__MODULES__ = global.__FRONTS__DYNAMIC__MODULES__ || {};
  global.__FRONTS__DYNAMIC__MODULES__['legacy-orders'] = { default: render };
})(window);
