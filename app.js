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

    // Over welke seizoenen gaan de matchdetails? Van seizoen 1 bestaan enkel totalen.
    const scopeSeasons = cardSeason === 'all'
      ? [...detailSeasons].sort((a, b) => a - b)
      : (detailSeasons.has(+cardSeason) ? [+cardSeason] : []);
    const scopeList = scopeSeasons.map(sz => 'S' + sz);
    const scopeText = scopeList.length > 1 ? scopeList.slice(0, -1).join(', ') + ' en ' + scopeList[scopeList.length - 1] : (scopeList[0] || '');
    const scope = scopeText ? ` <span class="scope">(${scopeText})</span>` : '';

    const recordHtml = hasDetail
      ? `${rec.W} gewonnen, ${rec.G} gelijk, ${rec.V} verloren`
      : `Speelde geen match in ${scopeText}`;
    const bestHtml = best && best.g + best.a > 0
      ? `${best.g} ${best.g === 1 ? 'goal' : 'goals'} en ${best.a} ${best.a === 1 ? 'assist' : 'assists'} tegen ${esc(best.m.tegen)} (${best.m.gv}–${best.m.gt}), seizoen ${best.s}`
      : (hasDetail ? 'Nog geen goal of assist in één match' : `Speelde geen match in ${scopeText}`);
    const form = games.slice(-6).map(g => resBadge(resultOf(g.m))).join('');
    const matchFacts = scopeList.length
      ? `<div class="wide"><dt>Uitslagen als hij meespeelde${scope}</dt><dd>${recordHtml}</dd></div>
          <div class="wide"><dt>Beste match${scope}</dt><dd>${bestHtml}</dd></div>
          ${form ? `<div class="wide"><dt>Laatste matchen${scope}</dt><dd><span class="form">${form}</span></dd></div>` : ''}`
      : `<div class="wide nodata"><dt class="sr-only">Matchdetails</dt><dd>Geen gedetailleerde wedstrijdgegevens van seizoen ${esc(cardSeason)} beschikbaar.</dd></div>`;

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
          ${matchFacts}
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
    // Elke keer drie willekeurige hoofden op het veld
    const players = D.players.filter(p => p.face)
      .map(p => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1])
      .slice(0, 3);
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

  // ---------- Opstelling: kies je eigen vijf ----------
  // Keeper met een ruit ervoor. Elke speler kan maar één keer opgesteld worden.
  // Klaar? Dan zie je hoe vaak deze vijf samen op het blad stonden en hun all-time goals en assists.
  (function lineup() {
    const pitch = $('#pitch'), verdict = $('#verdict');
    const picker = $('#kiezer'), list = $('#kiezer-lijst');
    if (!pitch) return;

    const POS = [
      { id: 'v', label: 'Voor',   x: 50, y: 19 },
      { id: 'l', label: 'Links',  x: 20, y: 42 },
      { id: 'r', label: 'Rechts', x: 80, y: 42 },
      { id: 'a', label: 'Achter', x: 50, y: 62 },
      { id: 'k', label: 'Keeper', x: 50, y: 85 },
    ];
    const byName = new Map(D.players.map(p => [p.name, p]));
    const squads = Object.values(D.squads || {});
    const KEY = 'avp-opstelling';
    let team = {};
    try { team = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { team = {}; }
    for (const k of Object.keys(team)) if (!byName.has(team[k]) || !POS.some(p => p.id === k)) delete team[k];
    let editing = null, justPlaced = null;

    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(team)); } catch (e) { /* geen opslag */ } };
    const posOf = name => POS.find(p => team[p.id] === name);

    function face(pl, cls) {
      return pl.face
        ? `<img class="${cls}" src="assets/${esc(pl.face)}" alt="" width="420" height="420" loading="lazy">`
        : `<span class="${cls} ${cls}--mono mono" aria-hidden="true">${esc(initials(pl.name))}</span>`;
    }

    function drawPitch() {
      pitch.innerHTML = POS.map(p => {
        const pl = team[p.id] && byName.get(team[p.id]);
        const label = pl ? `${p.label}: ${pl.name}. Wijzigen` : `${p.label}: kies een speler`;
        return `<button type="button" class="slot${pl ? ' is-filled' : ''}${justPlaced === p.id ? ' is-new' : ''}" data-pos="${p.id}"
                  style="--x:${p.x}%;--y:${p.y}%" aria-label="${esc(label)}">
          <span class="slot__disc" aria-hidden="true">${pl ? face(pl, 'f') : '+'}</span>
          ${pl ? `<span class="slot__name" aria-hidden="true">${esc(pl.name)}</span>` : ''}
        </button>`;
      }).join('');
      justPlaced = null;
      drawVerdict();
    }

    function drawVerdict() {
      const names = POS.map(p => team[p.id]).filter(Boolean);
      if (names.length < 2) {
        verdict.innerHTML = `
          <p class="verdict__h">${names.length === 0 ? 'Stel je ploeg op' : 'Kies nog een speler'}</p>
          <div class="verdict__bar" aria-hidden="true">${POS.map((p, i) => `<i class="${i < names.length ? 'on' : ''}"></i>`).join('')}</div>`;
        return;
      }
      const together = squads.filter(sq => names.every(n => sq.includes(n))).length;
      const tot = names.reduce((t, n) => { const s = statsFor(byName.get(n), 'all'); t.g += s.g; t.a += s.a; return t; }, { g: 0, a: 0 });
      const ga = tot.g + tot.a;
      const GROUP = { 2: ['Dit duo', 'Dit duo'], 3: ['Dit trio', 'Dit trio'], 4: ['Deze vier', 'Deze vier'], 5: ['Deze vijf', 'Deze vijf'] };

      // Eretitels, enkel voor een duo of trio
      let title = null;
      if (names.length === 2) {
        if (together >= 20) title = { text: 'Magisch Duo', kind: 'opal' };
        else if (together >= 15) title = { text: 'Gouden Duo', kind: 'gold' };
      } else if (names.length === 3) {
        if (ga > 175) title = { text: 'De Drie Wijzen', kind: 'opal' };
        else if (ga > 125) title = { text: 'Triple Threat', kind: 'opal' };
        else if (ga > 75) title = { text: 'Gouden Trio', kind: 'gold' };
      }

      verdict.innerHTML = `
        <p class="verdict__h">${GROUP[names.length][0]} samen</p>
        ${title ? `<p class="honor honor--${title.kind}"><span>${title.text}</span></p>` : ''}
        <div class="verdict__nums">
          <div class="hl"><span class="v">${together}</span><span class="k">${together === 1 ? 'match' : 'matchen'} samen op het blad</span></div>
          <div><span class="v">${ga}</span><span class="k">goals + assists samen</span></div>
        </div>
        <p class="verdict__split">${tot.g} goals en ${tot.a} assists, alle seizoenen samen.</p>
        ${together === 0 ? `<p class="verdict__note">${GROUP[names.length][1]} stond${names.length > 2 ? 'en' : ''} nog nooit samen op het blad.</p>` : ''}`;
    }

    function openPicker(posId) {
      editing = posId;
      const pos = POS.find(p => p.id === posId);
      $('#kiezer-titel').textContent = `Kies: ${pos.label.toLowerCase()}`;
      const players = D.players.slice().sort((a, b) => a.name.localeCompare(b.name));
      list.innerHTML = players.map(pl => {
        const at = posOf(pl.name);
        const here = at && at.id === posId;
        const taken = at && !here;
        return `<li><button type="button" data-pick="${esc(pl.name)}"${taken ? ' disabled' : ''}${here ? ' aria-current="true"' : ''}>
          ${face(pl, 'thumb')}
          <span>${esc(pl.name)}${taken ? `<span class="where">staat al ${esc(at.label.toLowerCase())}</span>` : ''}</span>
        </button></li>`;
      }).join('');
      $('#kiezer-leeg').disabled = !team[posId];
      picker.showModal();
      const cur = list.querySelector('[aria-current="true"]') || list.querySelector('button:not([disabled])');
      if (cur) cur.focus();
    }

    function closePicker() {
      picker.close();
      const back = pitch.querySelector(`[data-pos="${editing}"]`);
      if (back) back.focus();
    }

    pitch.addEventListener('click', e => {
      const b = e.target.closest('.slot');
      if (b) openPicker(b.dataset.pos);
    });
    list.addEventListener('click', e => {
      const b = e.target.closest('button[data-pick]');
      if (!b || b.disabled) return;
      team[editing] = b.dataset.pick;
      justPlaced = editing;
      save(); drawPitch(); closePicker();
    });
    $('#kiezer-leeg').addEventListener('click', () => { delete team[editing]; save(); drawPitch(); closePicker(); });
    $('#kiezer-sluit').addEventListener('click', closePicker);
    picker.addEventListener('click', e => { if (e.target === picker) closePicker(); });

    $('#ploeg-leeg').addEventListener('click', () => { team = {}; save(); drawPitch(); });
    $('#ploeg-random').addEventListener('click', () => {
      const pool = D.players.filter(p => p.active).map(p => [Math.random(), p.name]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      team = {};
      POS.forEach((p, i) => { team[p.id] = pool[i]; });
      save(); drawPitch();
      pitch.querySelectorAll('.slot').forEach(s => s.classList.add('is-new'));
    });

    drawPitch();
  })();

  // ---------- Quiz ----------
  // Wordt opgebouwd terwijl je naar beneden scrolt en weer afgebroken als je naar boven scrolt.
  // Elke keer dat je opnieuw helemaal naar beneden komt, staat er een nieuwe willekeurige vraag.
  (function quiz() {
    const section = $('#quiz'), stage = $('#quiz-stage');
    const qEl = $('#quiz-vraag'), optsEl = $('#quiz-opties'), resEl = $('#quiz-uitkomst');
    if (!section) return;
    const W = window.AVP_WEETJES || {};

    // --- gegevens ---
    const byName = new Map(D.players.map(p => [p.name, p]));
    const squads = Object.values(D.squads || {});
    const total = n => statsFor(byName.get(n), 'all');
    const pool = D.players.filter(p => statsFor(p, 'all').c >= 3).map(p => p.name);
    const inPool = n => pool.includes(n);
    const togCache = new Map();
    const tog = (a, b) => {
      const k = a < b ? a + '|' + b : b + '|' + a;
      if (!togCache.has(k)) togCache.set(k, squads.filter(s => s.includes(a) && s.includes(b)).length);
      return togCache.get(k);
    };
    const seasonStat = (n, s, k) => { const v = byName.get(n).seasons[s]; return v ? (k === 'ga' ? v.g + v.a : v[k]) : 0; };
    const playedIn = s => pool.filter(n => seasonStat(n, s, 'c') > 0);

    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const goals = n => `${n} ${n === 1 ? 'goal' : 'goals'}`;
    const matchen = n => `${n} ${n === 1 ? 'match' : 'matchen'}`;

    // Maakt een vraag met 1 juist en 2 foute antwoorden (of null als dat niet lukt)
    function make(q, right, wrongs, explain) {
      const w = shuffle([...new Set(wrongs)].filter(n => n !== right)).slice(0, 2);
      if (!right || w.length < 2) return null;
      return { q, right, options: shuffle([right, ...w]), explain };
    }
    // Unieke hoogste waarde in een lijst, anders null
    function uniqueTop(names, f) {
      const s = names.map(n => [n, f(n)]).sort((a, b) => b[1] - a[1]);
      return s.length > 1 && s[0][1] > s[1][1] && s[0][1] > 0 ? s : null;
    }

    const GEN = [
      // Nooit samen gespeeld met X
      () => {
        const x = rnd(pool);
        const right = rnd(pool.filter(n => n !== x && tog(n, x) === 0));
        return make(`Ik stond nog nooit samen met ${x} op het blad.`, right,
          pool.filter(n => n !== x && tog(n, x) >= 3),
          `${right} en ${x} speelden nog nooit samen in dezelfde match.`);
      },
      // De gebroeders Guldemont
      () => {
        const [a, b] = (W.broers || [])[0] || [];
        if (!a) return null;
        const fam = (W.familienaam || {})[a];
        const right = rnd(pool.filter(n => n !== a && n !== b && tog(n, a) === 0 && tog(n, b) === 0));
        return make(`Ik speelde nog nooit samen met ${fam ? 'de gebroeders ' + fam : a + ' of ' + b}.`, right,
          pool.filter(n => n !== a && n !== b && tog(n, a) >= 2 && tog(n, b) >= 2),
          `${right} stond nooit samen op het blad met ${a} of ${b}.`);
      },
      // Maar één keer samen
      () => {
        const x = rnd(pool);
        const right = rnd(pool.filter(n => n !== x && tog(n, x) === 1));
        return make(`Samen met ${x} vorm ik een duo dat maar één keer samen op het blad stond.`, right,
          pool.filter(n => n !== x && tog(n, x) >= 4),
          `${right} en ${x} speelden precies één match samen.`);
      },
      // Vaakst samen met X
      () => {
        const x = rnd(pool);
        const top = uniqueTop(pool.filter(n => n !== x), n => tog(n, x));
        if (!top) return null;
        return make(`Met niemand stond ${x} vaker samen op het blad dan met mij.`, top[0][0],
          top.slice(1).filter(t => t[1] < top[0][1]).map(t => t[0]).slice(0, 8),
          `${top[0][0]} en ${x} stonden al ${matchen(top[0][1])} samen op het blad.`);
      },
      // Evenveel goals als X in een seizoen
      () => {
        const s = rnd(D.seasons);
        const x = rnd(playedIn(s).filter(n => seasonStat(n, s, 'g') > 0));
        if (!x) return null;
        const g = seasonStat(x, s, 'g');
        const right = rnd(playedIn(s).filter(n => n !== x && seasonStat(n, s, 'g') === g));
        return make(`In seizoen ${s} scoorde ik evenveel doelpunten als ${x}.`, right,
          playedIn(s).filter(n => n !== x && Math.abs(seasonStat(n, s, 'g') - g) >= 2),
          `${right} en ${x} scoorden allebei ${goals(g)} in seizoen ${s}.`);
      },
      // Topschutter / assistkoning / meeste caps (per seizoen of aller tijden)
      () => {
        const k = rnd(['g', 'a', 'c']);
        const s = rnd([...D.seasons, 'all']);
        const names = s === 'all' ? pool : playedIn(s);
        const val = n => (s === 'all' ? total(n)[k] : seasonStat(n, s, k));
        const top = uniqueTop(names, val);
        if (!top) return null;
        const when = s === 'all' ? 'aller tijden' : `in seizoen ${s}`;
        const q = s === 'all'
          ? { g: 'Ik ben de topschutter aller tijden.', a: 'Niemand gaf ooit meer assists dan ik.', c: 'Ik speelde de meeste matchen aller tijden.' }[k]
          : { g: `Ik was topschutter van seizoen ${s}.`, a: `Niemand gaf meer assists in seizoen ${s} dan ik.`, c: `Ik speelde de meeste matchen in seizoen ${s}.` }[k];
        const word = { g: 'goals', a: 'assists', c: 'caps' }[k];
        return make(q, top[0][0], top.slice(1, 7).map(t => t[0]),
          `${top[0][0]}: ${top[0][1]} ${word} ${when}. Nummer twee had er ${top[1][1]}.`);
      },
      // Precies zoveel goals en assists in een seizoen
      () => {
        const s = rnd(D.seasons);
        const names = playedIn(s);
        const x = rnd(names.filter(n => seasonStat(n, s, 'ga') >= 3));
        if (!x) return null;
        const g = seasonStat(x, s, 'g'), a = seasonStat(x, s, 'a');
        if (names.some(n => n !== x && seasonStat(n, s, 'g') === g && seasonStat(n, s, 'a') === a)) return null;
        return make(`In seizoen ${s} kwam ik aan ${goals(g)} en ${a} ${a === 1 ? 'assist' : 'assists'}.`, x,
          names.filter(n => n !== x),
          `${x} had in seizoen ${s} ${goals(g)} en ${a} ${a === 1 ? 'assist' : 'assists'}.`);
      },
      // Veel goals in één match
      () => {
        const rows = D.players.flatMap(p => p.games.filter(g => g[2] >= 3).map(g => ({ n: p.name, s: g[0], md: g[1], g: g[2] })));
        const r = rnd(rows);
        if (!r || !inPool(r.n)) return null;
        const m = MATCHES.get(matchKey(r.s, r.md));
        if (!m) return null;
        const others = D.players.filter(p => p.name !== r.n && p.games.some(g => g[0] === r.s && g[1] === r.md && g[2] === r.g));
        if (others.length) return null;
        return make(`Ik scoorde ${r.g} keer in één match tegen ${m.tegen} (seizoen ${r.s}).`, r.n,
          pool.filter(n => n !== r.n),
          `${r.n} maakte ${goals(r.g)} in de ${m.gv}–${m.gt} tegen ${m.tegen}.`);
      },
      // Wie van deze drie: meeste caps / goals / assists / goals per match
      () => {
        const k = rnd(['c', 'g', 'a', 'r']);
        const val = n => { const t = total(n); return k === 'r' ? (t.c >= 8 ? t.g / t.c : -1) : t[k]; };
        const three = shuffle(pool.filter(n => val(n) >= 0)).slice(0, 3);
        const top = uniqueTop(three, val);
        if (!top || top[0][1] === top[1][1]) return null;
        const q = { c: 'Van deze drie speelde ik de meeste matchen.', g: 'Van deze drie scoorde ik het vaakst.', a: 'Van deze drie gaf ik de meeste assists.', r: 'Van deze drie scoor ik gemiddeld het meest per match.' }[k];
        const fmt = n => (k === 'r' ? fmt1(val(n)) + ' goals per match' : val(n) + ' ' + { c: 'caps', g: 'goals', a: 'assists' }[k]);
        return { q, right: top[0][0], options: three, explain: three.map(n => `${n}: ${fmt(n)}`).join(', ') + ' (aller tijden).' };
      },
      // Oudste / jongste
      () => {
        const old = rnd([true, false]);
        const right = old ? W.oudste : W.jongste;
        if (!right) return null;
        return make(old ? 'Ik ben de oudste speler van Avondpartij.' : 'Ik ben de jongste speler van Avondpartij.', right,
          pool.filter(n => n !== W.oudste && n !== W.jongste),
          old ? `${right} is de oudste van de ploeg.` : `${right} is de benjamin van de ploeg.`);
      },
      // Familie
      () => {
        const fam = [];
        for (const v of W.vaderZoon || []) {
          fam.push(['Mijn zoon speelt ook bij Avondpartij.', v.vader, `${v.vader} is de vader van ${v.zoon}.`]);
          fam.push(['Mijn vader speelt ook bij Avondpartij.', v.zoon, `${v.zoon} is de zoon van ${v.vader}.`]);
        }
        for (const [a, b] of W.broers || []) {
          const x = rnd([a, b]);
          fam.push(['Mijn broer speelt ook bij Avondpartij.', x, `${a} en ${b} zijn broers.`]);
        }
        const f = rnd(fam);
        if (!f) return null;
        const family = new Set([...(W.vaderZoon || []).flatMap(v => [v.vader, v.zoon]), ...(W.broers || []).flat()]);
        return make(f[0], f[1], pool.filter(n => !family.has(n)), f[2]);
      },
      // Rugnummers en bijnamen
      () => {
        const e = rnd(W.rugnummers || []);
        if (!e) return null;
        const right = e.spelers[0];
        const variant = rnd(['bijnaam', 'nummer']);
        const q = variant === 'bijnaam'
          ? `Op mijn truitje staat '${e.bijnaam}'.`
          : `Ik speel ${e.spelers.length > 1 ? 'meestal ' : ''}met rugnummer ${e.nummer}.`;
        return make(q, right, pool.filter(n => !e.spelers.includes(n)),
          `${right} is '${e.bijnaam}', met nummer ${e.nummer}.`);
      },
    ];

    // Gewicht per soort vraag (zelfde volgorde als GEN): vragen uit de cijfers komen vaker,
    // leeftijd en familie minder vaak omdat er daar maar een paar van zijn.
    const WEIGHT = [3, 1, 3, 3, 3, 3, 2, 2, 3, 1, 1, 2];
    const BAG = GEN.flatMap((g, i) => Array(WEIGHT[i] || 1).fill(i));
    let last = '', lastGen = -1;
    function newQuestion() {
      let q = null;
      for (let i = 0; i < 40 && (!q || q.q === last); i++) {
        let gi = rnd(BAG);
        while (gi === lastGen) gi = rnd(BAG);
        q = GEN[gi]();
        if (q) lastGen = gi;
      }
      if (!q) return;
      last = q.q;
      const face = n => {
        const p = byName.get(n);
        return p.face ? `<img src="assets/${esc(p.face)}" alt="" width="420" height="420">` : `<span class="mono" aria-hidden="true">${esc(initials(n))}</span>`;
      };
      qEl.textContent = q.q;
      optsEl.innerHTML = q.options.map(n => `<li><button type="button" class="qopt" data-name="${esc(n)}">${face(n)}<span>${esc(n)}</span></button></li>`).join('');
      resEl.innerHTML = '';
      optsEl.dataset.right = q.right;
      optsEl.dataset.explain = q.explain;
    }

    optsEl.addEventListener('click', e => {
      const b = e.target.closest('.qopt');
      if (!b || b.disabled) return;
      const right = optsEl.dataset.right, ok = b.dataset.name === right;
      optsEl.querySelectorAll('.qopt').forEach(o => {
        o.disabled = true;
        if (o.dataset.name === right) o.classList.add('is-right');
        else if (o === b) o.classList.add('is-wrong');
        else o.classList.add('is-dim');
      });
      resEl.innerHTML = `
        <span class="quiz__verdict${ok ? '' : ' is-wrong'}">${ok ? 'Juist!' : 'Helaas, het was ' + esc(right) + '.'}</span>
        <p class="quiz__explain">${esc(optsEl.dataset.explain)}</p>
        <button type="button" class="btn btn--dark" id="quiz-nog">Nog een vraag</button>`;
      $('#quiz-nog').addEventListener('click', () => {
        newQuestion();
        for (const el of [qEl, optsEl]) { el.classList.remove('quiz__fade'); void el.offsetWidth; el.classList.add('quiz__fade'); }
        const first = optsEl.querySelector('.qopt');
        if (first) first.focus();
      });
    });

    // --- opbouwen en afbreken met de scroll ---
    const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
    let armed = true, raf = 0;
    function update() {
      raf = 0;
      const r = section.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / r.height));
      if (!reduceMotion.matches) {
        stage.style.setProperty('--a', seg(p, 0, .42).toFixed(3));
        stage.style.setProperty('--b', seg(p, .4, .6).toFixed(3));
        stage.style.setProperty('--c', seg(p, .55, .72).toFixed(3));
        stage.style.setProperty('--d', seg(p, .68, .94).toFixed(3));
      }
      const live = reduceMotion.matches ? p > .3 : p > .9;
      stage.classList.toggle('is-live', live);
      document.body.classList.toggle('quiz-on', p > .3);
      // Pas als de quiz helemaal afgebroken was, komt er bij de volgende keer een nieuwe vraag
      if (p < .03) armed = true;
      if (armed && p > .3) { armed = false; newQuestion(); }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();

  // ---------- Zwevend hoofd ----------
  // Om de 10 seconden zweeft een willekeurig hoofd over het scherm.
  // Tik of hou het vast: je ziet een korte statistiek van die speler, daarna verdwijnt het.
  (function drifter() {
    const faces = D.players.filter(p => p.face);
    if (!faces.length || reduceMotion.matches) return;

    const INTERVAL = 10000, FLIGHT = 10000, SHOW = 4200;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'drifter';
    el.hidden = true;
    el.innerHTML = '<img alt="" width="420" height="420" draggable="false">';
    const img = el.querySelector('img');
    const tip = document.createElement('div');
    tip.className = 'drifter__tip';
    tip.setAttribute('role', 'status');
    tip.hidden = true;
    document.body.append(el, tip);

    let timer = 0, raf = 0, pl = null, lastName = null, path = null, pos = { x: 0, y: 0, r: 0 };

    function schedule(ms) { clearTimeout(timer); timer = setTimeout(launch, ms); }

    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

    function statFor(p) {
      const t = statsFor(p, 'all');
      const out = [];
      if (t.g > 0) out.push(`${t.g} ${t.g === 1 ? 'goal' : 'goals'} in ${t.c} ${t.c === 1 ? 'match' : 'matchen'} voor Avondpartij`);
      else out.push('Jaagt nog op zijn eerste goal voor Avondpartij');
      if (t.a > 0) out.push(`${t.a} ${t.a === 1 ? 'assist' : 'assists'} aller tijden`);
      out.push(`${t.c} caps voor Avondpartij`);
      if (t.c >= 3 && t.g > 0) out.push(`${fmt1(t.g / t.c)} goals per match`);
      for (const [k, label] of [['g', 'topschutters'], ['a', 'assistgevers'], ['c', 'meeste caps']]) {
        const r = ranked('all', k).find(x => x.pl.name === p.name);
        if (r && r.rank <= 5 && r.s[k] > 0) out.push(`Nummer ${r.rank} van de ${label} aller tijden`);
      }
      const seasons = Object.entries(p.seasons).filter(([, v]) => v.c > 0);
      if (seasons.length > 1) {
        const [sz, v] = seasons.sort((a, b) => b[1].g - a[1].g)[0];
        if (v.g > 0) out.push(`Beste seizoen: seizoen ${sz} met ${v.g} goals`);
      }
      const games = p.games.map(g => ({ s: g[0], g: g[2], a: g[3], m: MATCHES.get(matchKey(g[0], g[1])) })).filter(g => g.m);
      const best = games.sort((x, y) => (y.g + y.a) - (x.g + x.a))[0];
      if (best && best.g + best.a >= 2) out.push(`Beste match: ${best.g} goals en ${best.a} assists tegen ${best.m.tegen} (S${best.s})`);
      const wins = games.filter(g => resultOf(g.m) === 'W').length;
      const ds = [...detailSeasons].sort((a, b) => a - b).map(s => 'S' + s);
      const dsText = ds.length > 1 ? ds.slice(0, -1).join(', ') + ' en ' + ds[ds.length - 1] : ds[0];
      if (wins > 0) out.push(`${wins} keer gewonnen met hem op het veld (${dsText})`);
      return pick(out);
    }

    function launch() {
      if (document.hidden || document.querySelector("dialog[open]") || document.body.classList.contains("quiz-on")) { schedule(5000); return; }
      const choices = faces.filter(p => p.name !== lastName);
      pl = pick(choices.length ? choices : faces);
      lastName = pl.name;
      img.src = 'assets/' + pl.face;
      el.setAttribute('aria-label', `Vang het hoofd van ${pl.name}`);

      const vw = window.innerWidth, vh = window.innerHeight;
      const size = vw < 640 ? 92 : 124;
      el.style.setProperty('--s', size + 'px');
      const dir = Math.random() < 0.5 ? 1 : -1;
      path = {
        start: performance.now(), dir, size,
        x0: dir > 0 ? -size : vw + size, x1: dir > 0 ? vw + size : -size,
        y: vh * (0.2 + Math.random() * 0.5),
        bob: 22 + Math.random() * 18, phase: Math.random() * 6,
      };
      el.classList.remove('is-caught', 'is-gone');
      el.hidden = false;
      raf = requestAnimationFrame(fly);
    }

    function fly(now) {
      const t = (now - path.start) / FLIGHT;
      if (t >= 1) { el.hidden = true; schedule(INTERVAL); return; }
      pos.x = path.x0 + (path.x1 - path.x0) * t;
      pos.y = path.y + Math.sin(t * Math.PI * 3 + path.phase) * path.bob;
      pos.r = Math.sin(t * Math.PI * 4 + path.phase) * 12 + path.dir * 6;
      el.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) rotate(${pos.r.toFixed(1)}deg)`;
      raf = requestAnimationFrame(fly);
    }

    function catchIt() {
      if (el.hidden || el.classList.contains('is-caught')) return;
      cancelAnimationFrame(raf);
      el.classList.add('is-caught');
      tip.innerHTML = `<strong>${esc(pl.name)}</strong><span>${esc(statFor(pl))}</span>`;
      tip.hidden = false;
      // ballon boven het hoofd, of eronder als er bovenaan geen plaats is
      const w = tip.offsetWidth, h = tip.offsetHeight, half = path.size / 2;
      const left = Math.min(Math.max(pos.x - w / 2, 12), window.innerWidth - w - 12);
      const above = pos.y - half - h - 10;
      tip.style.left = left + 'px';
      tip.style.top = (above > 12 ? above : pos.y + half + 10) + 'px';
      clearTimeout(timer);
      timer = setTimeout(release, SHOW);
    }

    function release() {
      tip.hidden = true;
      el.classList.add('is-gone');
      setTimeout(() => { el.hidden = true; el.classList.remove('is-caught', 'is-gone'); }, 350);
      schedule(INTERVAL);
    }

    el.addEventListener('pointerdown', e => { e.preventDefault(); catchIt(); });
    el.addEventListener('click', e => { if (e.detail === 0) catchIt(); });
    tip.addEventListener('click', () => { clearTimeout(timer); release(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !el.hidden && !el.classList.contains('is-caught')) {
        cancelAnimationFrame(raf); el.hidden = true; schedule(INTERVAL);
      }
    });

    schedule(12000);
  })();

  render();

  // Gedeelde link met een speler erin? Open meteen zijn kaart.
  const linked = params.get('speler');
  if (linked && D.players.some(p => p.name === linked)) openCard(linked);
})();
