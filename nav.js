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
// A grey silhouette drawn as an inline SVG, so it needs no extra file
var SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" fill="#3b2447"/>' +
  '<circle cx="32" cy="25" r="11" fill="#8f7a99"/>' +
  '<path d="M10 64c0-14 10-22 22-22s22 8 22 22z" fill="#8f7a99"/>' +
  '</svg>'
);

// If a player photo is missing or broken, swap in the silhouette
function fixPhotos(container) {
  container.querySelectorAll('img.player-photo').forEach(function (img) {
    function useSilhouette() {
      img.onerror = null;          // stops an endless loop if the silhouette fails
      img.src = SILHOUETTE;
    }
    img.onerror = useSilhouette;   // photo fails to load later
    var src = img.getAttribute('src');
    if (!src || (img.complete && img.naturalWidth === 0)) {
      useSilhouette();             // no photo at all, or it already failed
    }
  });
}

function mirror(sourceId, targetId, count) {
  var source = document.getElementById(sourceId);
  var target = document.getElementById(targetId);
  if (!source || !target) return;

  function copy() {
    target.innerHTML = '';
    Array.from(source.children).slice(0, count).forEach(function (item) {
      target.appendChild(item.cloneNode(true));
    });
    fixPhotos(target);             // new line: tidy up photos after copying
  }

  copy();
  new MutationObserver(copy).observe(source, { childList: true });
}

mirror('table-body',     'home-table',    5);
mirror('fixtures-list',  'home-fixtures', 3);
mirror('leaders-week',   'home-leaders',  3);
mirror('market-movers',  'home-movers',   2);
mirror('value-under',    'home-value',    3);
mirror('news-list',      'home-news',     3);