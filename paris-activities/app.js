(() => {
  'use strict';

  const STATE_KEY = 'frida-paris-board-v3';
  const LEGACY_KEY = 'frida-paris-board-v2';
  const CUSTOM_KEY = 'frida-paris-custom-v1';
  const UPDATED_KEY = 'frida-paris-updated-v1';
  const labels = { available: 'Disponibles', todo: 'À faire', planned: 'Prévues', past: 'Passées' };
  const columns = Object.keys(labels);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const icons = {
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="7" r="1.2"/><circle cx="16" cy="7" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="8" cy="17" r="1.2"/><circle cx="16" cy="17" r="1.2"/></svg>'
  };

  const extraStyles = document.createElement('style');
  extraStyles.textContent = `
    .tagline{justify-content:flex-start!important}.tag-actions{margin-left:auto;display:flex;align-items:center;gap:7px}.drag-handle{margin-left:auto;width:34px;height:30px;border:1px solid #ddd8cb;background:#f7f4ec;border-radius:10px;display:inline-grid;place-items:center;color:#77746b;cursor:grab;touch-action:none;flex:0 0 auto}.drag-handle:active{cursor:grabbing}.drag-handle svg{width:18px;height:18px;fill:currentColor}.touch-ghost{position:fixed!important;z-index:9999!important;pointer-events:none!important;margin:0!important;opacity:.93!important;transform:rotate(1.5deg) scale(1.02);box-shadow:0 22px 60px rgba(20,20,18,.28)!important}.card.touch-origin{opacity:.26}.column.drag-over{background:rgba(255,255,255,.88)!important;border-color:#77736a!important}.drop-marker{height:8px;border-radius:999px;background:#20211f;margin:2px 4px;box-shadow:0 0 0 3px rgba(32,33,31,.1)}
    .cinema-section{margin:4px 0 18px;border:1px solid rgba(209,204,192,.88);border-radius:22px;padding:17px;background:linear-gradient(120deg,rgba(25,26,24,.96),rgba(53,50,45,.96));color:#fff;overflow:hidden}.section-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.cinema-section .eyebrow{color:#c9c3b6;margin-bottom:5px}.cinema-section h2{font-family:Georgia,"Times New Roman",serif;font-size:30px;line-height:1;margin:0;font-weight:500;letter-spacing:-.03em}.cinema-note{display:grid;gap:2px;background:#f5d85e;color:#28271f;border-radius:14px;padding:10px 13px;min-width:max-content}.cinema-note strong{font-size:12px}.cinema-note span{font-size:10px}.drag-hint{font-size:11px;color:#c8c3b9;margin:10px 0 13px}.cinema-list{display:flex;gap:10px;overflow-x:auto;padding:1px 1px 6px;scroll-snap-type:x proximity}.cinema-card{min-width:240px;max-width:285px;background:#fffef9;color:#20211f;padding:12px 12px 11px;border-radius:15px;scroll-snap-align:start}.cinema-card.rail-card{box-shadow:0 8px 24px rgba(0,0,0,.18)}.cinema-card-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.cinema-card h3{font-size:19px;margin:0 0 8px;line-height:1.04}.cinema-release{display:flex;gap:7px;align-items:center;font-size:11px;color:#65635b;margin-bottom:10px}.cinema-release svg{width:14px;height:14px;stroke:#858176;fill:none;stroke-width:1.7}.cinema-card-bottom{display:flex;align-items:center;gap:7px;border-top:1px solid #ebe6dc;padding-top:9px}.cinema-age{font-size:10px;color:#77746c;margin-right:auto}.cinema-link,.mini-add{border:0;text-decoration:none;font-size:10px;font-weight:800;border-radius:999px;padding:7px 9px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap}.cinema-link{background:#20211f;color:#fff}.cinema-link svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}.mini-add{background:#e6e1d5;color:#35342f}.cinema-empty{border:1px dashed rgba(255,255,255,.28);border-radius:14px;padding:16px;color:#c8c3b9;font-size:12px;min-width:100%}.card.cinema-card:not(.rail-card){min-width:0;max-width:none}.card.cinema-card:not(.rail-card) .status-select{margin-top:9px}
    @media(min-width:721px){.drag-handle{opacity:.58}.card:hover .drag-handle{opacity:1}}
    @media(max-width:720px){.cinema-section{padding:14px;margin-bottom:13px}.section-heading{display:block}.cinema-section h2{font-size:25px}.cinema-note{display:inline-grid;margin-top:10px}.cinema-card{min-width:78vw}.drag-hint{margin-bottom:10px}}
  `;
  document.head.appendChild(extraStyles);

  let catalog = [...(window.__INITIAL_ACTIVITIES__ || [])];
  let cinema = [...(window.__INITIAL_CINEMA__ || [])];
  let custom = readJSON(CUSTOM_KEY, []);
  let state = readState();
  let query = '';
  let category = '';
  let venue = '';
  let draggedId = null;
  let suppressOpenUntil = 0;

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function readState() {
    const current = readJSON(STATE_KEY, null);
    if (current && current.statuses) return { statuses: current.statuses || {}, order: current.order || {} };
    const legacy = readJSON(LEGACY_KEY, {});
    return { statuses: legacy && !legacy.statuses ? legacy : {}, order: {} };
  }

  function save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state.statuses));
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    } catch {
      toast('Le navigateur bloque la sauvegarde locale');
    }
  }

  function esc(v = '') {
    return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function all() { return [...catalog, ...cinema, ...custom]; }
  function byId(id) { return all().find(a => a.id === id); }
  function effectiveEnd(a) { return a.end || a.periodEnd || (a.recurrence ? a.recurrence.until + 'T23:59:00+02:00' : null) || a.start || a.sortDate; }
  function isExpired(a) {
    if (a.kind === 'cinema') return false;
    const e = effectiveEnd(a);
    return e ? new Date(e).getTime() < Date.now() : false;
  }
  function statusOf(a) { return state.statuses[a.id] || (isExpired(a) ? 'past' : 'available'); }
  function sortTime(a) { return new Date(a.start || (a.releaseDate ? a.releaseDate + 'T12:00:00+02:00' : null) || a.sortDate || a.periodEnd || '2099-01-01').getTime(); }

  function isRecentCinema(a) {
    if (!a.releaseDate) return false;
    const release = new Date(a.releaseDate + 'T00:00:00+02:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = (today.getTime() - release.getTime()) / 86400000;
    return days >= 0 && days <= 14;
  }

  function dateText(a) {
    if (a.dateLabel) return a.dateLabel;
    if (a.releaseDate) {
      const d = new Date(a.releaseDate + 'T12:00:00+02:00');
      return 'Sorti le ' + new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
    }
    if (!a.start) return 'Date à choisir';
    const d = new Date(a.start), end = a.end ? new Date(a.end) : null;
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    const cap = day.charAt(0).toUpperCase() + day.slice(1);
    const from = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const to = end ? end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : '';
    return `${cap} · ${from}${to ? '–' + to : ''}`;
  }

  function nextOccurrence(a) {
    if (!a.recurrence) return '';
    const now = new Date(), until = new Date(a.recurrence.until + 'T23:59:59+02:00');
    for (let i = 0; i < 370; i++) {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      if (d > until) break;
      if (a.recurrence.weekdays.includes(d.getDay())) {
        const [h, m] = a.recurrence.time.split(':').map(Number); d.setHours(h, m, 0, 0);
        if (d > now) return 'Prochaine : ' + new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', 'h');
      }
    }
    return '';
  }

  function soonLabel(a) {
    const t = sortTime(a), delta = (t - Date.now()) / 86400000;
    if (!a.start || delta < 0 || delta > 8) return '';
    if (delta < 1) return 'Demain';
    return `Dans ${Math.ceil(delta)} j`;
  }

  function matches(a) {
    const hay = [a.title, a.venue, a.category, a.description, a.why, a.address, dateText(a)].join(' ').toLowerCase();
    return (!query || hay.includes(query)) && (!category || a.category === category) && (!venue || a.venue === venue);
  }

  function ordered(list, status) {
    const saved = state.order[status] || [];
    const index = new Map(saved.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ai = index.has(a.id) ? index.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.id) ? index.get(b.id) : Number.MAX_SAFE_INTEGER;
      return ai !== bi ? ai - bi : sortTime(a) - sortTime(b);
    });
  }

  function dragHandle(a) {
    return `<button class="drag-handle" type="button" data-drag-handle aria-label="Déplacer ${esc(a.title)}">${icons.grip}</button>`;
  }

  function statusSelect(a) {
    const status = statusOf(a);
    return `<select class="status-select" data-status aria-label="Changer le statut">${Object.entries(labels).map(([k, v]) => `<option value="${k}"${k === status ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
  }

  function cinemaCardHTML(a, inRail = false) {
    return `<article class="card cinema-card${inRail ? ' rail-card' : ''}" draggable="true" data-id="${esc(a.id)}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="cinema-card-top"><span class="tag">Nouveau cinéma</span>${dragHandle(a)}</div>
      <h3>${esc(a.title)}</h3>
      <div class="cinema-release">${icons.calendar}<span>${esc(dateText(a))}</span></div>
      <div class="cinema-card-bottom">
        <span class="cinema-age">${esc(a.age || 'Tout public')}</span>
        ${inRail ? '<button class="mini-add" type="button" data-quick-add>+ À faire</button>' : ''}
        ${a.ticketUrl ? `<a class="cinema-link" href="${esc(a.ticketUrl)}" target="_blank" rel="noopener" data-ticket>Séances ${icons.arrow}</a>` : ''}
      </div>
      ${inRail ? '' : statusSelect(a)}
    </article>`;
  }

  function cardHTML(a) {
    if (a.kind === 'cinema') return cinemaCardHTML(a, false);
    const soon = soonLabel(a), next = nextOccurrence(a);
    return `<article class="card${a.featured ? ' featured' : ''}" draggable="true" data-id="${esc(a.id)}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="tagline"><span class="tag">${esc(a.category || 'Sortie')}</span><span class="tag-actions">${soon ? `<span class="soon">${esc(soon)}</span>` : ''}${dragHandle(a)}</span></div>
      <h3>${esc(a.title)}</h3>
      <p class="why">${esc(a.why || a.description || '')}</p>
      <div class="meta">
        <div class="meta-row">${icons.calendar}<span>${esc(dateText(a))}${next ? `<br><strong>${esc(next)}</strong>` : ''}${a.timeLabel ? `<br>${esc(a.timeLabel)}` : ''}</span></div>
        <div class="meta-row">${icons.pin}<span>${esc(a.venue)}<br><span style="color:#88867d">${esc(a.address || 'Paris')}</span></span></div>
        <div class="meta-row">${icons.user}<span>${esc(a.age || 'En famille')} · ${esc(a.price || 'Voir billetterie')}</span></div>
      </div>
      <div class="card-foot">
        ${a.ticketUrl ? `<a class="ticket" href="${esc(a.ticketUrl)}" target="_blank" rel="noopener" data-ticket>Billets ${icons.arrow}</a>` : ''}
        <button class="details" type="button" data-details>Voir le détail</button>
      </div>
      ${statusSelect(a)}
    </article>`;
  }

  function render() {
    const grouped = { available: [], todo: [], planned: [], past: [] };
    [...catalog, ...custom].filter(matches).forEach(a => grouped[statusOf(a)].push(a));
    cinema.filter(a => statusOf(a) !== 'available' && matches(a)).forEach(a => grouped[statusOf(a)].push(a));
    columns.forEach(key => grouped[key] = ordered(grouped[key], key));

    $$('.column').forEach(col => {
      const key = col.dataset.column, box = $('.cards', col), list = grouped[key];
      $('.count', col).textContent = list.length;
      box.innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="empty">${query || category || venue ? 'Aucun résultat avec ces filtres.' : 'Glisse une carte ici.'}</div>`;
    });

    const recentCinema = cinema
      .filter(a => statusOf(a) === 'available' && isRecentCinema(a) && matches(a))
      .sort((a, b) => sortTime(b) - sortTime(a));
    $('#cinemaList').innerHTML = recentCinema.length
      ? recentCinema.map(a => cinemaCardHTML(a, true)).join('')
      : '<div class="cinema-empty">Aucune nouvelle sortie familiale dans les 14 derniers jours.</div>';

    bindCards();
    fillFilters();
  }

  function bindCards() {
    $$('.card').forEach(card => {
      card.addEventListener('dragstart', e => {
        if (e.target.closest('a,button,select')) { e.preventDefault(); return; }
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      });
      card.addEventListener('dragend', cleanupDesktopDrag);
      const details = $('[data-details]', card);
      if (details) details.addEventListener('click', () => { if (Date.now() > suppressOpenUntil) openDetail(card.dataset.id); });
      const select = $('[data-status]', card);
      if (select) select.addEventListener('change', e => move(card.dataset.id, e.target.value));
      const quickAdd = $('[data-quick-add]', card);
      if (quickAdd) quickAdd.addEventListener('click', () => move(card.dataset.id, 'todo'));
      const handle = $('[data-drag-handle]', card);
      if (handle) handle.addEventListener('pointerdown', e => beginTouchDrag(e, card));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.target.closest('a,button,select')) openDetail(card.dataset.id);
      });
    });
  }

  function cleanupDesktopDrag() {
    draggedId = null;
    $$('.card').forEach(c => c.classList.remove('dragging'));
    $$('.column').forEach(c => c.classList.remove('drag-over'));
    $$('.drop-marker').forEach(m => m.remove());
  }

  function dropPosition(column, clientY, movingId) {
    const cards = $$('.card', $('.cards', column)).filter(c => c.dataset.id !== movingId);
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return card.dataset.id;
    }
    return null;
  }

  $$('.column').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'move';
    });
    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
    });
    col.addEventListener('drop', e => {
      e.preventDefault();
      const id = draggedId || e.dataTransfer.getData('text/plain');
      const beforeId = dropPosition(col, e.clientY, id);
      col.classList.remove('drag-over');
      if (id) move(id, col.dataset.column, beforeId);
      cleanupDesktopDrag();
    });
  });

  function beginTouchDrag(event, card) {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    const id = card.dataset.id;
    const handle = event.currentTarget;
    const startX = event.clientX, startY = event.clientY;
    const rect = card.getBoundingClientRect();
    const offsetX = startX - rect.left, offsetY = startY - rect.top;
    let active = false, ghost = null, currentColumn = null;

    try { handle.setPointerCapture(event.pointerId); } catch {}

    const start = () => {
      active = true;
      draggedId = id;
      card.classList.add('touch-origin');
      ghost = card.cloneNode(true);
      ghost.classList.add('touch-ghost');
      ghost.removeAttribute('draggable');
      ghost.style.width = Math.min(rect.width, 320) + 'px';
      ghost.style.left = Math.max(8, startX - offsetX) + 'px';
      ghost.style.top = Math.max(8, startY - offsetY) + 'px';
      document.body.appendChild(ghost);
      navigator.vibrate?.(18);
    };

    const timer = setTimeout(start, 90);

    const onMove = e => {
      if (e.pointerId !== event.pointerId) return;
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!active && distance > 7) { clearTimeout(timer); start(); }
      if (!active) return;
      e.preventDefault();
      ghost.style.left = Math.min(window.innerWidth - ghost.offsetWidth - 8, Math.max(8, e.clientX - offsetX)) + 'px';
      ghost.style.top = Math.min(window.innerHeight - ghost.offsetHeight - 8, Math.max(8, e.clientY - offsetY)) + 'px';

      const board = $('#board');
      const boardRect = board.getBoundingClientRect();
      if (e.clientX > boardRect.right - 42) board.scrollLeft += 18;
      if (e.clientX < boardRect.left + 42) board.scrollLeft -= 18;
      if (e.clientY > window.innerHeight - 55) window.scrollBy(0, 12);
      if (e.clientY < 55) window.scrollBy(0, -12);

      const target = document.elementFromPoint(e.clientX, e.clientY);
      const col = target?.closest('.column') || null;
      if (currentColumn !== col) {
        $$('.column').forEach(c => c.classList.remove('drag-over'));
        currentColumn = col;
        currentColumn?.classList.add('drag-over');
      }
    };

    const cleanup = () => {
      active = false;
      draggedId = null;
      card.classList.remove('touch-origin');
      ghost?.remove();
      $$('.column').forEach(c => c.classList.remove('drag-over'));
    };

    const finish = e => {
      clearTimeout(timer);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      if (!active) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const col = target?.closest('.column') || currentColumn;
      const beforeId = col ? dropPosition(col, e.clientY, id) : null;
      cleanup();
      if (col) move(id, col.dataset.column, beforeId);
      suppressOpenUntil = Date.now() + 500;
    };

    const cancel = () => {
      clearTimeout(timer);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      cleanup();
    };

    handle.addEventListener('pointermove', onMove, { passive: false });
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', cancel);
  }

  function move(id, status, beforeId = null) {
    if (!columns.includes(status)) return;
    columns.forEach(key => {
      state.order[key] = (state.order[key] || []).filter(existing => existing !== id);
    });
    state.statuses[id] = status;
    const targetOrder = state.order[status] || [];
    if (beforeId) {
      const index = targetOrder.indexOf(beforeId);
      if (index >= 0) targetOrder.splice(index, 0, id);
      else targetOrder.push(id);
    } else targetOrder.push(id);
    state.order[status] = targetOrder;
    save();
    render();
    toast(`Carte déplacée vers « ${labels[status]} » — sauvegardée`);
  }

  function fillFilters() {
    const cat = $('#categoryFilter'), ven = $('#venueFilter');
    const cats = [...new Set(all().map(a => a.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const venues = [...new Set(all().map(a => a.venue).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const c = cat.value || category, v = ven.value || venue;
    cat.innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(x => `<option${x === c ? ' selected' : ''}>${esc(x)}</option>`).join('');
    ven.innerHTML = '<option value="">Tous les lieux</option>' + venues.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  }

  function openDetail(id) {
    const a = byId(id); if (!a) return;
    const status = statusOf(a), dlg = $('#detailDialog');
    const primaryLabel = a.kind === 'cinema' ? 'Voir les séances' : 'Réserver les billets';
    $('#detailContent').innerHTML = `
      <div class="modal-head"><div><div class="eyebrow">${esc(a.category || 'Sortie culturelle')}</div><h2>${esc(a.title)}</h2></div><button class="x" type="button" data-close aria-label="Fermer">×</button></div>
      <p>${esc(a.description || a.why || '')}</p>${a.why && a.description ? `<p><strong>Pourquoi c’est bien :</strong> ${esc(a.why)}</p>` : ''}
      <div class="modal-grid">
        <div class="info"><small>${a.kind === 'cinema' ? 'Sortie' : 'Date & heure'}</small><strong>${esc(dateText(a))}${a.timeLabel ? '<br>' + esc(a.timeLabel) : ''}</strong></div>
        <div class="info"><small>Lieu</small><strong>${esc(a.venue)}<br>${esc(a.address || 'Paris')}</strong></div>
        <div class="info"><small>Âge</small><strong>${esc(a.age || 'En famille')}</strong></div>
        <div class="info"><small>Prix</small><strong>${esc(a.price || 'Voir billetterie')}</strong></div>
      </div>
      <div class="field"><label for="modalStatus">Colonne</label><select id="modalStatus">${Object.entries(labels).map(([k, v]) => `<option value="${k}"${k === status ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="modal-actions">${a.ticketUrl ? `<a class="btn primary" href="${esc(a.ticketUrl)}" target="_blank" rel="noopener">${primaryLabel} ${icons.arrow}</a>` : ''}${a.sourceUrl ? `<a class="btn" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Source</a>` : ''}${a.custom ? `<button class="btn" type="button" data-delete>Supprimer</button>` : ''}</div>`;
    $('[data-close]', dlg).onclick = () => dlg.close();
    $('#modalStatus', dlg).onchange = e => { move(a.id, e.target.value); dlg.close(); };
    const del = $('[data-delete]', dlg);
    if (del) del.onclick = () => {
      custom = custom.filter(x => x.id !== a.id);
      delete state.statuses[a.id];
      columns.forEach(key => state.order[key] = (state.order[key] || []).filter(id => id !== a.id));
      save(); dlg.close(); render(); toast('Activité supprimée');
    };
    dlg.showModal();
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function refreshCatalog() {
    const btn = $('#refreshBtn'); btn.classList.add('refreshing'); btn.disabled = true;
    try {
      const [activityRes, cinemaRes] = await Promise.all([
        fetch(`activities.json?v=${Date.now()}`, { cache: 'no-store' }),
        fetch(`cinema.json?v=${Date.now()}`, { cache: 'no-store' })
      ]);
      if (!activityRes.ok || !cinemaRes.ok) throw new Error('fetch');
      const [freshActivities, freshCinema] = await Promise.all([activityRes.json(), cinemaRes.json()]);
      if (!Array.isArray(freshActivities) || !Array.isArray(freshCinema)) throw new Error('format');
      const oldIds = new Set([...catalog, ...cinema].map(x => x.id));
      catalog = freshActivities;
      cinema = freshCinema;
      const count = [...freshActivities, ...freshCinema].filter(x => !oldIds.has(x.id)).length;
      localStorage.setItem(UPDATED_KEY, new Date().toISOString());
      updateSync(); render();
      toast(count ? `${count} nouvelle${count > 1 ? 's' : ''} sortie${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''}` : 'La sélection est à jour — ton classement est conservé');
    } catch {
      toast('Connexion impossible — ton classement reste enregistré');
    } finally {
      btn.classList.remove('refreshing'); btn.disabled = false;
    }
  }

  function updateSync() {
    const v = localStorage.getItem(UPDATED_KEY);
    if (v) $('#syncStatus').textContent = 'Actualisé ' + new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)).replace(':', 'h');
  }

  $('#searchInput').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
  $('#categoryFilter').addEventListener('change', e => { category = e.target.value; render(); });
  $('#venueFilter').addEventListener('change', e => { venue = e.target.value; render(); });
  $('#refreshBtn').addEventListener('click', refreshCatalog);
  $('#addBtn').addEventListener('click', () => $('#addDialog').showModal());

  $('#addForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#newTitle').value.trim(), place = $('#newVenue').value.trim();
    if (!title || !place) return;
    const d = $('#newDate').value;
    const a = { id: 'custom-' + Date.now(), custom: true, title, venue: place, category: $('#newCategory').value.trim() || 'Idée personnelle', start: d ? new Date(d).toISOString() : null, dateLabel: d ? '' : 'Date à choisir', age: 'En famille', price: $('#newPrice').value.trim() || 'À vérifier', ticketUrl: $('#newUrl').value.trim(), description: $('#newDescription').value.trim(), why: $('#newDescription').value.trim(), address: 'Paris' };
    custom.push(a);
    state.statuses[a.id] = 'todo';
    state.order.todo = [...(state.order.todo || []), a.id];
    save(); e.target.reset(); $('#addDialog').close(); render(); toast('Activité ajoutée à « À faire »');
  });

  $('#exportBtn').addEventListener('click', () => {
    const payload = { exportedAt: new Date().toISOString(), board: state, activities: all().map(a => ({ ...a, status: statusOf(a) })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'sorties-frida-paris.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500); toast('Tableau exporté');
  });

  $('#resetBtn').addEventListener('click', e => {
    e.preventDefault();
    if (confirm('Remettre toutes les cartes dans leur état initial ?')) {
      state = { statuses: {}, order: {} }; custom = []; save(); render(); toast('Tableau réinitialisé');
    }
  });

  $('#sourcesBtn').addEventListener('click', e => {
    e.preventDefault();
    const a = all().find(x => x.sourceUrl);
    if (a) openDetail(a.id);
    toast('Chaque carte contient sa source');
  });

  $$('#detailDialog,#addDialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  window.addEventListener('storage', e => {
    if (e.key === STATE_KEY || e.key === LEGACY_KEY || e.key === CUSTOM_KEY) {
      state = readState(); custom = readJSON(CUSTOM_KEY, []); render();
    }
  });

  updateSync();
  render();
})();