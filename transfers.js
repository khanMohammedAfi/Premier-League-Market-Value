 (function () {
  const DATA_URL = 'data/transfers.json'; // change if your other data lives elsewhere
  const STAGE_LABELS = {
    interest: 'Interest',
    talks: 'In talks',
    advanced: 'Advanced',
    agreed: 'Agreed'
  };

  let items = [];
  let filter = 'all';
  let query = '';

  // Agent-generated text must never be inserted as raw HTML
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '#');
  const photoUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

  function route(t) {
    if (t.type === 'contract') return 'Contract · ' + esc(t.to);
    if (!t.from || t.from === 'Unknown club' || t.from === t.to) return 'Linked with ' + esc(t.to);
    return esc(t.from) + ' → ' + esc(t.to);
  }

   function renderItem(t, compact) {
    const stage = STAGE_LABELS[t.stage] || '';
    return `
      <li class="transfer">
        <img class="player-photo" src="${esc(photoUrl(t.photo))}" alt="" loading="lazy">
        <div class="transfer-body">
          <div class="transfer-top">
            <strong>${esc(t.player)}</strong>
            <span class="badge badge-${esc(t.type)}">${esc(t.type)}</span>
            ${stage ? `<span class="badge stage-${esc(t.stage)}">${esc(stage)}</span>` : ''}
          </div>
          <div class="transfer-route">${route(t)}</div>
          ${compact ? '' : `<p class="transfer-summary">${esc(t.summary)}</p>`}
          <small>
            <a href="${safeUrl(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.source)}</a>
            · ${esc(t.date)}
          </small>
        </div>
      </li>`;
  }

    function renderHome() {
    const el = document.getElementById('home-transfers');
    if (!el) return;
    el.innerHTML = items.length
      ? items.slice(0, 3).map((t) => renderItem(t, true)).join('')
      : '<li class="muted">No credible rumours right now.</li>';
    if (typeof fixPhotos === 'function') fixPhotos(el);
  }

  function renderFull() {
    const list = document.getElementById('transfers-list');
    const empty = document.getElementById('transfers-empty');
    if (!list) return;

    const q = query.trim().toLowerCase();
    const shown = items.filter((t) => {
      const typeOk = filter === 'all' || t.type === filter;
      const textOk = !q || [t.player, t.from, t.to].join(' ').toLowerCase().includes(q);
      return typeOk && textOk;
    });

    list.innerHTML = shown.map((t) => renderItem(t, false)).join('');
    if (typeof fixPhotos === 'function') fixPhotos(list);
    empty.hidden = shown.length > 0;
  }

  function bindControls() {
    document.querySelectorAll('#transfer-filters .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        document
          .querySelectorAll('#transfer-filters .tab')
          .forEach((b) => b.classList.toggle('active', b === btn));
        renderFull();
      });
    });
    const search = document.getElementById('transfer-search');
    if (search) {
      search.addEventListener('input', (e) => {
        query = e.target.value;
        renderFull();
      });
    }
  }

  async function init() {
    bindControls();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
      const upd = document.getElementById('transfers-updated');
      if (upd && data.updated) upd.textContent = 'Last updated ' + data.updated;
    } catch (err) {
      console.error('Transfers failed to load', err);
      const home = document.getElementById('home-transfers');
      if (home) home.innerHTML = '<li class="muted">Couldn\'t load rumours.</li>';
      return;
    }
    renderHome();
    renderFull();
  }

  init();
})();