(() => {
  'use strict';

  const D = window.AVP_DATA;
  if (!D) {
    document.getElementById('rows').innerHTML =
      '<tr><td colspan="6" class="empty">De cijfers konden niet geladen worden. Draai update-stats.bat opnieuw.</td></tr>';
    return;
  }

  const $ = (s, el = document) => el.querySelector(s);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt1 = n => n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const resultOf = m => (m.gv > m.gt ? 'W' : m.gv === m.gt ? 'G' : 'V');
  const RES_WORD = { W: 'gewonnen', G: 'gelijk', V: 'verloren' };
  const resBadge = r => `<span class="res res--${r}" title="${RES_WORD[r]}"><span aria-hidden="true">${r}</span><span class="sr-only">${RES_WORD[r]}</span></span>`;

  // Elke statistiek krijgt een kaartsymbool, net als de mouwen van het truitje.
  const STATS = {
    g:  { label: 'Goals',   short: 'G',   suit: '♠' },
    a:  { label: 'Assists', short: 'A',   suit: '♣' },
    c:  { label: 'Caps',    short: 'C',   suit: '♦' },
    ga: { label: 'G+A',     short: 'G+A', suit: '♥' },
  };
  const SORT_ORDER = ['g', 'a', 'c', 'ga'];

  const matchKey = (s, md) => s + '-' + md;
  const MATCHES = new Map(D.matches.map(m => [matchKey(m.s, m.md), m]));
  const detailSeasons = new Set(D.players.flatMap(p => p.games.map(g => g[0])));

  // ---------- Status (in de URL, zodat je een link kan delen) ----------
  const params = new URLSearchParams(location.search);
  const seasonOptions = [...D.seasons].reverse().map(String).concat('all');
  const state = {
    season: seasonOptions.includes(params.get('seizoen')) ? params.get('seizoen') : String(D.current),
    sort: STATS[params.get('op')] ? params.get('op') : 'g',
  };
  function saveUrl(player) {
    const p = new URLSearchParams();
    p.set('seizoen', state.season);
    p.set('op', state.sort);
    if (player) p.set('speler', player);
    history.replaceState(null, '', '?' + p.toString() + location.hash);
  }

  function statsFor(pl, season) {
    const t = { c: 0, g: 0, a: 0 };
    const list = season === 'all' ? Object.values(pl.seasons) : [pl.seasons[season]].filter(Boolean);
    for (const s of list) { t.c += s.c; t.g += s.g; t.a += s.a; }
    t.ga = t.g + t.a;
    return t;
  }

  function ranked(season, key) {
    const rows = D.players
      .map(pl => ({ pl, s: statsFor(pl, season) }))
      .filter(r => r.s.c > 0 || r.s.g > 0 || r.s.a > 0)
      .sort((x, y) => (y.s[key] - x.s[key]) || (y.s.g - x.s.g) || (y.s.a - x.s.a) || (x.s.c - y.s.c) || x.pl.name.localeCompare(y.pl.name));
    let rank = 0, prev = null;
    rows.forEach((r, i) => { if (r.s[key] !== prev) { rank = i + 1; prev = r.s[key]; } r.rank = rank; });
    return rows;
  }

  const seasonLabel = s => (s === 'all' ? 'Alle seizoenen' : 'Seizoen ' + s);
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();

  // ---------- Opening: lichtschilderen ----------
  // De cursor (of vinger) laat een lichtspoor achter dat langzaam weer donker wordt,
  // zoals een lange sluitertijd op een avondmatch. Klikken of tikken is een flits.
  (function lightPainting() {
    const hero = $('.night');
    const btn = $('.lights');
    const dark = $('.night__dark'), glow = $('.night__glow'), flashEl = $('.night__flash');
    const dc = dark.getContext('2d'), gc = glow.getContext('2d');
    const NIGHT = '31, 26, 32';
    let W = 0, H = 0, dpr = 1, brush = 120;
    let last = null, queue = [], lastInput = -1e9, raf = 0, visible = true;
    const started = performance.now();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = hero.clientWidth; H = hero.clientHeight;
      for (const c of [dark, glow]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      dc.setTransform(dpr, 0, 0, dpr, 0, 0); gc.setTransform(dpr, 0, 0, dpr, 0, 0);
      dc.fillStyle = `rgb(${NIGHT})`; dc.fillRect(0, 0, W, H);
      brush = Math.max(70, Math.min(150, W * 0.09));
      last = null;
    }

    function dab(x, y, r, strength) {
      // licht wegnemen uit het donker
      dc.globalCompositeOperation = 'destination-out';
      let g = dc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g; dc.beginPath(); dc.arc(x, y, r, 0, Math.PI * 2); dc.fill();
      // warme gouden gloed bovenop
      gc.globalCompositeOperation = 'lighter';
      g = gc.createRadialGradient(x, y, 0, x, y, r * 0.8);
      g.addColorStop(0, 'rgba(222,178,83,0.10)');
      g.addColorStop(1, 'rgba(222,178,83,0)');
      gc.fillStyle = g; gc.beginPath(); gc.arc(x, y, r * 0.8, 0, Math.PI * 2); gc.fill();
    }

    function stroke(x, y) {
      if (!last) { dab(x, y, brush, 0.5); last = { x, y }; return; }
      const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
      const step = brush / 5, n = Math.max(1, Math.floor(dist / step));
      for (let i = 1; i <= n; i++) dab(last.x + dx * i / n, last.y + dy * i / n, brush, 0.28);
      last = { x, y };
    }

    function frame(now) {
      raf = 0;
      if (!visible) return;
      // het donker kruipt terug
      dc.globalCompositeOperation = 'source-over';
      dc.fillStyle = `rgba(${NIGHT}, ${reduceMotion.matches ? 0.012 : 0.022})`;
      dc.fillRect(0, 0, W, H);
      gc.globalCompositeOperation = 'destination-out';
      gc.fillStyle = 'rgba(0,0,0,0.06)';
      gc.fillRect(0, 0, W, H);

      for (const p of queue) stroke(p.x, p.y);
      queue = [];

      // niemand aan het schilderen: een onzichtbare hand tekent rustig lussen
      if (now - lastInput > 2600 && !reduceMotion.matches) {
        const t = (now - started) / 1000;
        stroke(W * (0.5 + 0.34 * Math.sin(t * 0.7)), H * (0.42 + 0.22 * Math.sin(t * 1.3 + 0.6)));
      } else if (now - lastInput > 120) {
        last = null;
      }
      raf = requestAnimationFrame(frame);
    }

    function input(cx, cy) {
      const r = hero.getBoundingClientRect();
      if (performance.now() - lastInput > 2600) last = null;
      queue.push({ x: cx - r.left, y: cy - r.top });
      lastInput = performance.now();
    }

    function flash(cx, cy) {
      const r = hero.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
      const big = Math.max(W, H) * 0.42;
      dab(x, y, big, 1); dab(x, y, big * 0.7, 1);
      flashEl.style.setProperty('--fx', x + 'px'); flashEl.style.setProperty('--fy', y + 'px');
      flashEl.classList.remove('is-on'); void flashEl.offsetWidth; flashEl.classList.add('is-on');
      lastInput = performance.now();
    }

    resize();
    raf = requestAnimationFrame(frame);
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

    hero.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') input(e.clientX, e.clientY); });
    hero.addEventListener('touchmove', e => input(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    hero.addEventListener('touchstart', e => { last = null; input(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

    // Flits bij een klik of tik (niet bij slepen)
    let down = null;
    hero.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    hero.addEventListener('pointerup', e => {
      if (!down || e.target.closest('a, button')) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 10 && performance.now() - down.t < 400) flash(e.clientX, e.clientY);
      down = null;
    });

    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(hero);

    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      hero.classList.toggle('is-lit', on);
      $('.lights__label', btn).textContent = on ? 'Licht uit' : 'Licht aan';
    });
  })();

  // Laatste match in de opening
  if (D.lastMatch) {
    const m = D.lastMatch, r = resultOf(m);
    $('#laatste').innerHTML =
      `<span>Laatste match</span> ${resBadge(r)} <strong>${m.gv}–${m.gt}</strong>` +
      `<span>tegen ${esc(m.tegen)}${m.datum ? ', ' + fmtDate(m.datum) : ''}</span>`;
  }

  // ---------- Filters ----------
  const segSeason = $('#seizoenen');
  const segSort = $('#sorteer');

  function buildSeg(el, options, current, onPick) {
    el.innerHTML = options.map(o =>
      `<button type="button" role="radio" data-v="${o.v}" aria-checked="${o.v === current}" tabindex="${o.v === current ? 0 : -1}">${o.html}</button>`
    ).join('');
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      onPick(b.dataset.v);
    });
    el.addEventListener('keydown', e => {
      const btns = [...el.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
      if (n == null) return;
      e.preventDefault();
      onPick(btns[n].dataset.v);
      el.querySelectorAll('button')[n].focus();
    });
  }
  function syncSeg(el, current) {
    el.querySelectorAll('button').forEach(b => {
      const on = b.dataset.v === current;
      b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
    });
  }

  buildSeg(segSeason, seasonOptions.map(s => ({
    v: s,
    html: s === 'all'
      ? '<span class="long">Alle seizoenen</span><span class="short">Alles</span>'
      : `<span class="long">Seizoen ${s}</span><span class="short">S${s}</span>`,
  })), state.season, v => { state.season = v; syncSeg(segSeason, v); render(); });

  buildSeg(segSort, SORT_ORDER.map(k => ({
    v: k, html: `<span class="suit" aria-hidden="true">${STATS[k].suit}</span>${STATS[k].label}`,
  })), state.sort, v => setSort(v));

  function setSort(v) { state.sort = v; syncSeg(segSort, v); render(); }

  // Kolomkoppen zijn ook sorteerknoppen
  document.querySelectorAll('.table th[data-key]').forEach(th => {
    const k = th.dataset.key, s = STATS[k];
    th.innerHTML = `<button type="button"><span class="suit" aria-hidden="true">${s.suit}</span><span class="long">${s.label}</span><span class="short" aria-hidden="true">${s.short}</span></button>`;
    th.querySelector('button').setAttribute('aria-label', 'Sorteer op ' + s.label);
    th.querySelector('button').addEventListener('click', () => setSort(k));
  });

  // Plakbalk krijgt een rand zodra hij bovenaan blijft hangen
  const controls = $('.controls');
  let stuckRaf = 0;
  window.addEventListener('scroll', () => {
    if (stuckRaf) return;
    stuckRaf = requestAnimationFrame(() => {
      stuckRaf = 0;
      controls.classList.toggle('is-stuck', controls.getBoundingClientRect().top <= 0.5);
    });
  }, { passive: true });

  // ---------- Klassement ----------
  let currentRows = [];

  function render() {
    const key = state.sort;
    const rows = ranked(state.season, key);
    currentRows = rows;
    saveUrl();

    // Kolomkop markeren
    document.querySelectorAll('.table th[data-key]').forEach(th => {
      if (th.dataset.key === key) th.setAttribute('aria-sort', 'descending');
      else th.removeAttribute('aria-sort');
    });
    $('#tabel-titel').textContent = `Spelersklassement, ${seasonLabel(state.season).toLowerCase()}, gesorteerd op ${STATS[key].label.toLowerCase()}`;

    // Podium
    const podium = $('#podium');
    podium.innerHTML = rows.slice(0, 3).map(r => {
      const s = STATS[key];
      const face = r.pl.face ? `<img class="pc__face" src="assets/${esc(r.pl.face)}" alt="" width="420" height="420" loading="lazy">` : '';
      return `<li><button type="button" class="pc" data-name="${esc(r.pl.name)}" aria-label="${esc(r.pl.name)}, plaats ${r.rank}, ${r.s[key]} ${s.label.toLowerCase()}. Open spelerskaart.">
        ${face}
        <span class="pc__corner" aria-hidden="true">${r.rank}<span class="suit">${s.suit}</span></span>
        <span class="pc__name" aria-hidden="true">${esc(r.pl.name)}</span>
        <span class="pc__stat" aria-hidden="true">${r.s[key]}</span>
        <span class="pc__lbl" aria-hidden="true">${s.label.toLowerCase()}</span>
        <span class="pc__corner pc__corner--end" aria-hidden="true">${r.rank}<span class="suit">${s.suit}</span></span>
      </button></li>`;
    }).join('');

    // Tabel
    const max = Math.max(1, ...rows.map(r => r.s[key]));
    const tbody = $('#rows');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Nog geen cijfers voor ${seasonLabel(state.season).toLowerCase()}.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const cells = ['c', 'g', 'a', 'ga'].map(k => {
        const v = r.s[k];
        const bar = k === key ? `<span class="bar" style="width:${Math.round((v / max) * 100)}%" aria-hidden="true"></span>` : '';
        return `<td class="col-num${k === key ? ' is-key' : ''}"><span class="n${v === 0 ? ' n--zero' : ''}">${v}${bar}</span></td>`;
      }).join('');
      return `<tr data-name="${esc(r.pl.name)}">
        <td class="col-rank">${r.rank}</td>
        <td class="col-name"><button type="button" class="name-btn">${esc(r.pl.name)}</button></td>
        ${cells}
      </tr>`;
    }).join('');
  }

  // Klik op een rij of podiumkaart opent de spelerskaart
  document.addEventListener('click', e => {
    const hit = e.target.closest('#rows tr[data-name], .pc[data-name], .leaders button[data-name]');
    if (hit) openCard(hit.dataset.name, hit.closest('.leaders') ? 'all' : null);
  });

  // Verborgen hoofden: ze schuiven achter het klassement vandaan als je over hun rij gaat
  (function peek() {
    const board = $('#board'), img = $('#peek');
    const byName = new Map(D.players.map(p => [p.name, p]));
    let current = null;
    function show(tr) {
      const pl = tr && byName.get(tr.dataset.name);
      if (!pl || !pl.face) { hide(); return; }
      if (current === pl.name) return;
      current = pl.name;
      const top = tr.getBoundingClientRect().top - board.getBoundingClientRect().top + tr.offsetHeight / 2;
      img.classList.remove('is-out');
      img.src = 'assets/' + pl.face;
      img.style.top = top + 'px';
      void img.offsetWidth;
      img.classList.add('is-out');
    }
    function hide() { current = null; img.classList.remove('is-out'); }
    board.addEventListener('mouseover', e => show(e.target.closest('#rows tr')));
    board.addEventListener('mouseleave', hide);
    board.addEventListener('focusin', e => show(e.target.closest('#rows tr')));
    board.addEventListener('focusout', hide);
  })();

  // ---------- Spelerskaart ----------
  const dlg = $('#kaart'), flip = $('#flip'), pcard = $('#pcard');
  let cardList = [], cardIdx = 0, cardSeason = null;

  function openCard(name, seasonOverride) {
    cardSeason = seasonOverride || state.season;
    cardList = seasonOverride
      ? ranked(cardSeason, state.sort).map(r => r.pl.name)
      : currentRows.map(r => r.pl.name);
    if (!cardList.includes(name)) cardList.unshift(name);
    cardIdx = cardList.indexOf(name);
    fillCard();
    if (!dlg.open) dlg.showModal();
    turnCard();
    $('#sluit').focus();
  }

  function turnCard() {
    flip.classList.add('no-anim');
    flip.classList.remove('is-open');
    void flip.offsetWidth;
    flip.classList.remove('no-anim');
    requestAnimationFrame(() => flip.classList.add('is-open'));
  }

  function fillCard() {
    const pl = D.players.find(p => p.name === cardList[cardIdx]);
    const key = state.sort, S = STATS[key];
    const s = statsFor(pl, cardSeason);
    const rankRow = ranked(cardSeason, key).find(r => r.pl.name === pl.name);
    const rank = rankRow ? rankRow.rank : '–';
    saveUrl(pl.name);

    // Matchen van deze speler in de gekozen periode (enkel waar er detail is)
    const games = pl.games
      .filter(g => cardSeason === 'all' || g[0] === +cardSeason)
      .map(g => ({ s: g[0], md: g[1], g: g[2], a: g[3], m: MATCHES.get(matchKey(g[0], g[1])) }))
      .filter(g => g.m)
      .sort((x, y) => x.s - y.s || x.md - y.md);
    const rec = { W: 0, G: 0, V: 0 };
    games.forEach(g => rec[resultOf(g.m)]++);
    const best = games.slice().sort((x, y) => (y.g + y.a) - (x.g + x.a) || y.g - x.g)[0];

    let visual;
    if (pl.face) visual = `<img class="pcard__img" src="assets/${esc(pl.face)}" alt="" width="420" height="420">`;
    else if (pl.photo) visual = `<img class="pcard__img pcard__img--photo" src="assets/${esc(pl.photo)}" alt="">`;
    else visual = `<span class="pcard__mono" aria-hidden="true">${esc(initials(pl.name))}</span>`;

    const statCell = k => `<div class="${k === key ? 'hl' : ''}"><span class="v">${s[k]}</span><span class="k"><span class="suit" aria-hidden="true">${STATS[k].suit}</span> ${STATS[k].label}</span></div>`;

    const perMatch = s.c ? fmt1(s.g / s.c) : '–';
    const gaPerMatch = s.c ? fmt1(s.ga / s.c) : '–';
    const hasDetail = games.length > 0;

    const recordHtml = hasDetail
      ? `${rec.W} gewonnen, ${rec.G} gelijk, ${rec.V} verloren`
      : 'Geen matchdetails voor deze periode';
    const bestHtml = best && best.g + best.a > 0
      ? `${best.g} ${best.g === 1 ? 'goal' : 'goals'} en ${best.a} ${best.a === 1 ? 'assist' : 'assists'} tegen ${esc(best.m.tegen)} (${best.m.gv}–${best.m.gt}), seizoen ${best.s}`
      : (hasDetail ? 'Nog geen goal of assist in één match' : 'Onbekend');
    const form = games.slice(-6).map(g => resBadge(resultOf(g.m))).join('');

    const seasonRows = D.seasons.map(sz => {
      const v = pl.seasons[sz];
      const ctx = String(sz) === String(cardSeason) ? ' class="is-ctx"' : '';
      return v
        ? `<tr${ctx}><td>Seizoen ${sz}</td><td>${v.c}</td><td>${v.g}</td><td>${v.a}</td><td>${v.g + v.a}</td></tr>`
        : `<tr${ctx}><td>Seizoen ${sz}</td><td colspan="4">niet gespeeld</td></tr>`;
    }).join('');
    const tot = statsFor(pl, 'all');

    pcard.innerHTML = `
      <header class="pcard__top">
        <span class="pcard__corner" aria-label="Plaats ${rank} op ${S.label.toLowerCase()}">${rank}<span class="suit" aria-hidden="true">${S.suit}</span></span>
        ${visual}
        <h2 class="pcard__name" id="kaart-naam">${esc(pl.name)}</h2>
      </header>
      <div class="pcard__body">
        <p class="pcard__ctx">${seasonLabel(cardSeason)}</p>
        <div class="pcard__stats">${['c', 'g', 'a', 'ga'].map(statCell).join('')}</div>
        <dl class="pcard__facts">
          <div><dt>Goals per match</dt><dd>${perMatch}</dd></div>
          <div><dt>G+A per match</dt><dd>${gaPerMatch}</dd></div>
          <div class="wide"><dt>Uitslagen als hij meespeelde</dt><dd>${recordHtml}</dd></div>
          <div class="wide"><dt>Beste match</dt><dd>${bestHtml}</dd></div>
          ${form ? `<div class="wide"><dt>Laatste matchen</dt><dd><span class="form">${form}</span></dd></div>` : ''}
        </dl>
        <h3 class="pcard__h">Per seizoen</h3>
        <table class="mini">
          <thead><tr><th scope="col">Seizoen</th><th scope="col">Caps</th><th scope="col">Goals</th><th scope="col">Assists</th><th scope="col">G+A</th></tr></thead>
          <tbody>${seasonRows}<tr class="tot"><td>Totaal</td><td>${tot.c}</td><td>${tot.g}</td><td>${tot.a}</td><td>${tot.ga}</td></tr></tbody>
        </table>
      </div>`;
    pcard.scrollTop = 0;

    $('#vorige').disabled = cardList.length < 2;
    $('#volgende').disabled = cardList.length < 2;
  }

  function step(d) {
    cardIdx = (cardIdx + d + cardList.length) % cardList.length;
    fillCard();
    turnCard();
  }
  $('#vorige').addEventListener('click', () => step(-1));
  $('#volgende').addEventListener('click', () => step(1));
  $('#sluit').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  dlg.addEventListener('close', () => { flip.classList.remove('is-open'); saveUrl(); });

  // ---------- Club ----------
  (function club() {
    const all = D.matches;
    const sum = list => list.reduce((t, m) => {
      t.n++; t.gv += m.gv; t.gt += m.gt; t[resultOf(m)]++; return t;
    }, { n: 0, gv: 0, gt: 0, W: 0, G: 0, V: 0 });
    const T = sum(all);
    $('#c-matchen').textContent = T.n;
    $('#c-voor').textContent = T.gv;
    $('#c-tegen').textContent = T.gt;

    const wdl = $('#c-wdl');
    wdl.setAttribute('aria-label', `${T.W} gewonnen, ${T.G} gelijk, ${T.V} verloren`);
    wdl.innerHTML = [['w', T.W], ['g', T.G], ['v', T.V]]
      .filter(([, n]) => n > 0)
      .map(([c, n]) => `<span class="${c}" style="flex:${n}">${n}</span>`).join('');
    $('#c-wdl-legend').innerHTML =
      `<li><i style="background:var(--gold)"></i>Gewonnen ${Math.round(T.W / T.n * 100)}%</li>` +
      `<li><i style="background:var(--draw)"></i>Gelijk ${Math.round(T.G / T.n * 100)}%</li>` +
      `<li><i style="background:#5A505B"></i>Verloren ${Math.round(T.V / T.n * 100)}%</li>`;

    const saldo = n => (n > 0 ? `<span class="pos">+${n}</span>` : String(n));
    $('#c-seizoenen').innerHTML = D.seasons.map(s => {
      const t = sum(all.filter(m => m.s === s));
      const lopend = s === D.current ? ' <span style="font-size:14px;font-family:var(--body);color:#CFC7D0">(bezig)</span>' : '';
      return `<tr><td>Seizoen ${s}${lopend}</td><td>${t.n}</td><td>${t.W}</td><td>${t.G}</td><td>${t.V}</td><td>${t.gv}–${t.gt}</td><td>${saldo(t.gv - t.gt)}</td></tr>`;
    }).join('') + `<tr><td>Totaal</td><td>${T.n}</td><td>${T.W}</td><td>${T.G}</td><td>${T.V}</td><td>${T.gv}–${T.gt}</td><td>${saldo(T.gv - T.gt)}</td></tr>`;

    // Records
    const by = f => all.slice().sort((a, b) => f(b) - f(a))[0];
    const win = by(m => m.gv - m.gt);
    const loss = by(m => m.gt - m.gv);
    const wild = by(m => m.gv + m.gt);
    let run = 0, bestRun = 0;
    all.forEach(m => { run = resultOf(m) === 'V' ? 0 : run + 1; bestRun = Math.max(bestRun, run); });
    const desc = m => `${m.gv}–${m.gt} tegen ${esc(m.tegen)}, seizoen ${m.s}`;
    const rec = [
      ['Grootste overwinning', desc(win)],
      ['Zwaarste nederlaag', desc(loss)],
      ['Meeste goals in één match', `${wild.gv + wild.gt} goals: ${desc(wild)}`],
      ['Langste reeks zonder verlies', `${bestRun} matchen op rij`],
      ['Gemiddeld per match', `${fmt1(T.gv / T.n)} goals gemaakt, ${fmt1(T.gt / T.n)} tegen`],
    ];
    $('#c-records').innerHTML = rec.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    // Aller tijden
    const lead = [['g', 'Topschutter'], ['a', 'Meeste assists'], ['c', 'Meeste caps'], ['ga', 'Meeste goals en assists']];
    $('#c-leaders').innerHTML = lead.map(([k, what]) => {
      const top = ranked('all', k)[0];
      return `<li><button type="button" data-name="${esc(top.pl.name)}">
        <span class="suit" aria-hidden="true">${STATS[k].suit}</span>
        <span><span class="who">${esc(top.pl.name)}</span><span class="what">${what}</span></span>
        <span class="val">${top.s[k]}</span>
      </button></li>`;
    }).join('');

    // Voettekst
    const m = D.lastMatch;
    $('#bijgewerkt').textContent = m
      ? `Cijfers tot en met matchdag ${m.md} van seizoen ${m.s}${m.datum ? ', gespeeld op ' + fmtDate(m.datum) : ''}.`
      : '';
  })();

  // ---------- Hooghouden: de hoofden als ballen ----------
  (function keepyUppy() {
    const court = $('#court');
    const reeksEl = $('#k-reeks'), recordEl = $('#k-record');
    // Elke keer vier willekeurige hoofden op het veld
    const players = D.players.filter(p => p.face)
      .map(p => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1])
      .slice(0, 4);
    if (!court || !players.length) return;

    const KEY = 'avp-hooghouden-record';
    let record = 0;
    try { record = +localStorage.getItem(KEY) || 0; } catch (e) { /* geen opslag: geen probleem */ }
    let streak = 0;
    recordEl.textContent = record;

    let W = 0, H = 0, S = 150, R = 48, F = 58, G = 2400;
    const heads = players.map(pl => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'head';
      el.setAttribute('aria-label', 'Kopbal met ' + pl.name);
      el.innerHTML = `<img src="assets/${esc(pl.face)}" alt="" width="420" height="420" draggable="false">`;
      court.appendChild(el);
      return { pl, el, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, inPlay: false };
    });

    function measure() {
      W = court.clientWidth; H = court.clientHeight;
      S = W < 480 ? 82 : W < 640 ? 108 : 150;
      R = S * 0.33;
      F = S * 0.4; // afstand van midden tot kin
      G = H * 5.6;
      court.style.setProperty('--s', S + 'px');
      heads.forEach(h => { h.el.style.setProperty('--s', S + 'px'); h.x = Math.min(Math.max(h.x, R), W - R); h.y = Math.min(h.y, H - F); });
    }

    function place(dropIn) {
      heads.forEach((h, i) => {
        h.x = W * (i + 1) / (heads.length + 1);
        h.y = dropIn ? -S * (1 + i * 0.9) : H - F;
        h.vx = 0; h.vy = 0; h.a = (i % 2 ? 1 : -1) * 0.2; h.va = 0;
      });
      draw();
    }

    function setScore() {
      reeksEl.textContent = streak;
      if (streak > record) {
        record = streak; recordEl.textContent = record;
        recordEl.classList.remove('bump'); void recordEl.offsetWidth; recordEl.classList.add('bump');
        try { localStorage.setItem(KEY, record); } catch (e) { /* negeren */ }
      }
    }

    function pop(h, text) {
      const p = document.createElement('span');
      p.className = 'pop';
      p.textContent = text;
      p.style.left = h.x + 'px';
      p.style.top = (h.y - R - 34) + 'px';
      court.appendChild(p);
      setTimeout(() => p.remove(), 850);
    }

    function kick(h, px) {
      const lift = Math.sqrt(2 * G * H * 0.7) * (0.92 + Math.random() * 0.16);
      h.vy = -lift;
      const off = px == null ? (Math.random() - 0.5) * 1.4 : (h.x - px) / R;
      h.vx = off * 300 + (Math.random() - 0.5) * 120;
      h.va += (Math.random() - 0.5) * 9;
      h.inPlay = true;
      streak++;
      setScore();
      pop(h, streak);
      wake();
    }

    let raf = 0, prev = 0;
    function wake() { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(step); } }

    function step(now) {
      raf = 0;
      const dt = Math.max(0, Math.min(0.033, (now - prev) / 1000)); prev = now;
      let moving = false;

      for (const h of heads) {
        h.vy += G * dt;
        h.x += h.vx * dt; h.y += h.vy * dt; h.a += h.va * dt;

        if (h.x < R) { h.x = R; h.vx = Math.abs(h.vx) * 0.7; }
        if (h.x > W - R) { h.x = W - R; h.vx = -Math.abs(h.vx) * 0.7; }
        if (h.y < R && h.vy < 0 && h.y > -S) { h.y = R; h.vy = -h.vy * 0.4; }

        if (h.y > H - F) {
          h.y = H - F;
          if (h.inPlay && h.vy > 250) {
            // bal op de grond: reeks voorbij
            h.inPlay = false;
            if (streak > 0) { streak = 0; setScore(); }
          }
          h.vy = Math.abs(h.vy) > 140 ? -h.vy * 0.42 : 0;
          h.vx *= 1 - Math.min(1, 4 * dt);
          h.va = h.vx / R;
          if (Math.abs(h.vx) < 4) h.vx = 0;
        }
        if (h.vy !== 0 || h.vx !== 0 || h.y < H - F - 0.5) moving = true;
      }

      // botsen tegen elkaar
      for (let i = 0; i < heads.length; i++) {
        for (let j = i + 1; j < heads.length; j++) {
          const p = heads[i], q = heads[j];
          const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), min = R * 2;
          if (d > 0 && d < min) {
            const nx = dx / d, ny = dy / d, push = (min - d) / 2;
            p.x -= nx * push; p.y -= ny * push; q.x += nx * push; q.y += ny * push;
            const vn = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
            if (vn > 0) {
              const jv = vn * 0.9;
              p.vx -= jv * nx; p.vy -= jv * ny; q.vx += jv * nx; q.vy += jv * ny;
              p.va -= jv * 0.01; q.va += jv * 0.01;
            }
          }
        }
      }

      draw();
      if (moving) raf = requestAnimationFrame(step);
    }

    function draw() {
      for (const h of heads) h.el.style.transform = `translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px) rotate(${h.a.toFixed(3)}rad)`;
    }

    heads.forEach(h => {
      h.el.addEventListener('pointerdown', e => {
        e.preventDefault();
        kick(h, e.clientX - court.getBoundingClientRect().left);
      });
      // toetsenbord: Enter of spatie
      h.el.addEventListener('click', e => { if (e.detail === 0) kick(h, null); });
    });

    measure();
    place(false);
    let dropped = false;
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !dropped) {
        dropped = true;
        if (!reduceMotion.matches) { place(true); wake(); }
      }
    }, { threshold: 0.4 }).observe(court);

    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); draw(); wake(); }, 150); });
  })();

  render();

  // Gedeelde link met een speler erin? Open meteen zijn kaart.
  const linked = params.get('speler');
  if (linked && D.players.some(p => p.name === linked)) openCard(linked);
})();
