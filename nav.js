 // Show one view and hide all the others
function showView(name) {
  document.querySelectorAll('.view').forEach(function (v) {
    v.hidden = true;
  });
  document.getElementById('view-' + name).hidden = false;
  window.scrollTo(0, 0);
}

// Listen for clicks anywhere on the page.
// If the thing clicked (or its parent) has data-open="...", show that view.
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-open]');
  if (btn) {
    showView(btn.dataset.open);
  }
});
// Copy the first few items of a finished list into a small preview on Home.
//   sourceId = the full list that app.js fills
//   targetId = the small box on Home
//   count    = how many items to copy
function mirror(sourceId, targetId, count) {
  var source = document.getElementById(sourceId);
  var target = document.getElementById(targetId);
  if (!source || !target) return;

  function copy() {
    target.innerHTML = '';
    Array.from(source.children).slice(0, count).forEach(function (item) {
      target.appendChild(item.cloneNode(true));
    });
  }

  copy();                                                        // copy now
  new MutationObserver(copy).observe(source, { childList: true }); // and again whenever app.js changes it
}

mirror('table-body',     'home-table',    5);
mirror('fixtures-list',  'home-fixtures', 3);
mirror('leaders-week',   'home-leaders',  3);
mirror('market-movers',  'home-movers',   2);
mirror('value-under',    'home-value',    3);
mirror('news-list',      'home-news',     3);