/* ------------------------------------------------------------------
   PDUFA Watchlist — render layer
   ------------------------------------------------------------------ */

// ---------- THEME TOGGLE ----------
(function initThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  const stored = localStorage.getItem('pdufa-theme');
  let theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);
  setIcon();

  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    localStorage.setItem('pdufa-theme', theme);
    setIcon();
  });

  function setIcon() {
    toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    toggle.innerHTML =
      theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
})();

// ---------- LOCAL STATE ----------
const STORAGE_KEY = 'pdufa-watchlist-state';
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
let userState = Object.assign({ starred: [], hidden: [] }, loadState());

function isStarred(ticker) { return (userState.starred || []).includes(ticker); }
function isHidden(ticker)  { return (userState.hidden  || []).includes(ticker); }
function toggleStar(ticker) {
  userState.starred = userState.starred || [];
  const i = userState.starred.indexOf(ticker);
  if (i >= 0) userState.starred.splice(i, 1);
  else userState.starred.push(ticker);
  saveState(userState);
}
function toggleHide(ticker) {
  userState.hidden = userState.hidden || [];
  const i = userState.hidden.indexOf(ticker);
  if (i >= 0) userState.hidden.splice(i, 1);
  else userState.hidden.push(ticker);
  saveState(userState);
}

// ---------- DATA LOAD ----------
Promise.all([
  fetch('./data.json').then((r) => r.json()),
  fetch('./previous-data.json').then((r) => r.ok ? r.json() : null).catch(() => null),
])
  .then(([data, prev]) => render(data, prev))
  .catch((err) => {
    console.error('Failed to load data', err);
    document.querySelector('main').innerHTML =
      '<section class="section"><div class="shell"><p>Failed to load dashboard data.</p></div></section>';
  });

// ---------- HELPERS ----------
const RATING_LABEL = { high: 'HIGH', medium: 'MEDIUM', watch: 'WATCH' };
const RATING_ORDER = { high: 0, medium: 1, watch: 2 };

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(iso, today) {
  const t = new Date(today + 'T00:00:00').getTime();
  const d = new Date(iso + 'T00:00:00').getTime();
  return Math.round((d - t) / (1000 * 60 * 60 * 24));
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// drugProfile may contain hand-curated <strong> tags. Allow only those.
function safeProfile(html) {
  const escaped = escapeHTML(html);
  return escaped.replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');
}

// ---------- NUMERIC PARSERS (best-effort, tolerate "?" / "Unknown") ----------
function parsePercent(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /unknown|n\/a|unavailable/i.test(s)) return null;
  // "50-55%" -> midpoint
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
function parseMoney(v) {
  if (v == null) return null;
  const s = String(v).replace(/[\$,\s]/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)([KMBT])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1;
  return n * mult;
}

// ---------- PILL CLASS HELPERS ----------
function sentimentPillClass(overall) {
  if (!overall) return 'pill--neutral';
  const v = String(overall).toLowerCase();
  if (v.startsWith('bullish') || v === 'positive') return 'pill--medium';
  if (v.startsWith('bearish') || v === 'negative') return 'pill--high';
  return 'pill--neutral';
}
function insiderPillClass(signal) {
  if (!signal) return 'pill--neutral';
  const v = String(signal).toLowerCase();
  if (v.startsWith('bullish') || v === 'positive') return 'pill--medium';
  if (v.startsWith('bearish') || v === 'negative') return 'pill--high';
  return 'pill--neutral';
}
function trendsPillClass(signal) {
  if (!signal) return 'pill--neutral';
  const v = String(signal).toLowerCase();
  if (v.startsWith('rising')) return 'pill--medium';
  if (v.startsWith('declining')) return 'pill--high';
  return 'pill--neutral';
}

// ---------- DIFF (run-over-run) ----------
function diffBadgesFor(curr, prev) {
  if (!prev) return '<span class="diff diff--new">NEW</span>';
  const badges = [];

  // Rating change
  if (curr.rating !== prev.rating) {
    const dir = RATING_ORDER[curr.rating] < RATING_ORDER[prev.rating] ? 'up' : 'down';
    badges.push(`<span class="diff diff--${dir}" title="rating change">${(prev.rating || '?').toUpperCase()} → ${(curr.rating || '?').toUpperCase()}</span>`);
  }

  // Approval odds delta (pp)
  const a = parsePercent(curr.approvalOdds);
  const b = parsePercent(prev.approvalOdds);
  if (a != null && b != null && Math.abs(a - b) >= 1) {
    const delta = a - b;
    const cls = delta > 0 ? 'diff--up' : 'diff--down';
    const sign = delta > 0 ? '+' : '';
    badges.push(`<span class="diff ${cls}" title="approval odds change">odds ${sign}${delta.toFixed(0)}pp</span>`);
  }

  // Short interest delta (pp)
  const si1 = parsePercent(curr.shortInterest);
  const si0 = parsePercent(prev.shortInterest);
  if (si1 != null && si0 != null && Math.abs(si1 - si0) >= 0.5) {
    const delta = si1 - si0;
    const cls = delta > 0 ? 'diff--up' : 'diff--down';
    const sign = delta > 0 ? '+' : '';
    badges.push(`<span class="diff ${cls}" title="short interest change">SI ${sign}${delta.toFixed(1)}pp</span>`);
  }

  // PDUFA date moved
  if (curr.pdufaDate !== prev.pdufaDate) {
    badges.push(`<span class="diff diff--down" title="PDUFA moved">date moved</span>`);
  }

  return badges.length ? badges.join(' ') : '<span class="diff diff--flat">—</span>';
}

// ---------- APPROVAL ODDS GAUGE ----------
function oddsGauge(rawOdds) {
  const val = parsePercent(rawOdds);
  if (val == null) {
    return `<span class="odds-gauge__text">${escapeHTML(rawOdds || '—')}</span>`;
  }
  const cls = val < 35 ? 'odds-gauge__fill--low'
            : val < 65 ? 'odds-gauge__fill--mid'
            : 'odds-gauge__fill--high';
  return `
    <span class="odds-gauge">
      <span class="odds-gauge__bar"><span class="odds-gauge__fill ${cls}" style="width:${val}%"></span></span>
      <span class="odds-gauge__text">${escapeHTML(rawOdds)}</span>
    </span>`;
}

// ---------- PRICE TARGET COMPARISON ----------
function priceTargetComparison(t) {
  const price = parseMoney(t.price);
  const target = parseMoney(t.analystPT);
  const delta = price != null && target != null && price > 0
    ? ((target - price) / price) * 100
    : null;
  const deltaCls = delta == null ? 'price-target__delta--flat'
    : delta > 0 ? 'price-target__delta--up'
    : delta < 0 ? 'price-target__delta--down'
    : 'price-target__delta--flat';
  const deltaText = delta == null
    ? 'Target delta unavailable'
    : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs target`;
  return `
    <div class="price-target">
      <div class="price-target__cell">
        <div class="price-target__label">Current price</div>
        <div class="price-target__value">${escapeHTML(t.price || '—')}</div>
        ${t.priceAsOf ? `<div class="price-target__as-of">as of ${escapeHTML(t.priceAsOf)}</div>` : ''}
      </div>
      <div class="price-target__cell">
        <div class="price-target__label">Analyst target</div>
        <div class="price-target__value">${escapeHTML(t.analystPT || '—')}</div>
        ${t.analystPTAsOf ? `<div class="price-target__as-of">as of ${escapeHTML(t.analystPTAsOf)}</div>` : ''}
      </div>
      <div class="price-target__delta ${deltaCls}">${escapeHTML(deltaText)}</div>
    </div>`;
}

// ---------- TIMELINE ----------
function renderTimeline(tickers, today, container) {
  if (!tickers.length) { container.innerHTML = ''; return; }
  const _cs = getComputedStyle(container);
  const W = Math.max((container.clientWidth || 1080) - parseFloat(_cs.paddingLeft) - parseFloat(_cs.paddingRight), 200), H = 96;
  const padL = 30, padR = 30, padT = 20, padB = 30;
  const innerW = W - padL - padR;
  const t0 = new Date(today + 'T00:00:00').getTime();
  const maxDays = 14;
  const t1 = t0 + maxDays * 86400000;
  const x = (iso) => {
    const t = new Date(iso + 'T00:00:00').getTime();
    return padL + ((t - t0) / (t1 - t0)) * innerW;
  };
  const yBase = H - padB;

  // Tick marks every 2 days
  const ticks = [];
  for (let d = 0; d <= maxDays; d += 2) {
    const tickDate = new Date(t0 + d * 86400000);
    const isoStr = tickDate.toISOString().slice(0, 10);
    ticks.push({ x: padL + (d / maxDays) * innerW, label: fmtDateShort(isoStr) });
  }

  const tickEls = ticks.map(t => `
    <line class="timeline__axis" x1="${t.x}" y1="${yBase}" x2="${t.x}" y2="${yBase + 4}"/>
    <text class="timeline__tick-text" x="${t.x}" y="${yBase + 18}" text-anchor="middle">${t.label}</text>
  `).join('');

  // Group dots by date so duplicates stack
  const byDate = {};
  tickers.forEach(tk => {
    if (!byDate[tk.pdufaDate]) byDate[tk.pdufaDate] = [];
    byDate[tk.pdufaDate].push(tk);
  });
  const dots = [];
  Object.keys(byDate).forEach(date => {
    const px = x(date);
    if (px < padL - 1 || px > W - padR + 1) return; // outside 100d window
    byDate[date].forEach((tk, i) => {
      const py = yBase - 8 - i * 14;
      const cls = `timeline__dot timeline__dot--${tk.rating}`;
      dots.push(`<g><circle class="${cls}" cx="${px}" cy="${py}" r="5"><title>${escapeHTML(tk.ticker)} · ${escapeHTML(tk.drug)} · ${fmtDate(tk.pdufaDate)}</title></circle><text class="timeline__label" x="${px + 8}" y="${py + 3}">${escapeHTML(tk.ticker)}</text></g>`);
    });
  });

  container.innerHTML = `
    <svg class="timeline__svg" viewBox="0 0 ${W} ${H}" role="img">
      <line class="timeline__axis" x1="${padL}" y1="${yBase}" x2="${W - padR}" y2="${yBase}"/>
      ${tickEls}
      <line class="timeline__today-line" x1="${padL}" y1="${padT - 8}" x2="${padL}" y2="${yBase}"/>
      <text class="timeline__today-text" x="${padL}" y="${padT - 10}" text-anchor="start">Today</text>
      ${dots.join('')}
    </svg>
  `;

  // Make dots clickable to scroll to card
  container.querySelectorAll('circle.timeline__dot').forEach((c) => {
    c.addEventListener('click', () => {
      const title = c.querySelector('title').textContent || '';
      const tkSymbol = title.split('·')[0].trim();
      const card = document.getElementById('card-' + tkSymbol.replace(/[^A-Z0-9]/gi, '_'));
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ---------- .ICS EXPORT ----------
function buildIcs(ticker) {
  const d = new Date(ticker.pdufaDate + 'T00:00:00');
  const yyyymmdd = ticker.pdufaDate.replace(/-/g, '');
  const dtEnd = new Date(d.getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const uid = `${ticker.ticker}-${yyyymmdd}@pdufa-watchlist.local`;
  const summary = `${ticker.ticker} PDUFA — ${ticker.drug || ''}`.trim();
  const desc = [
    `Ticker: ${ticker.ticker}`,
    `Drug: ${ticker.drug || ''}`,
    `Indication: ${ticker.indication || ''}`,
    `Approval odds: ${ticker.approvalOdds || 'n/a'}`,
    `Rating: ${(ticker.rating || '').toUpperCase()}`,
  ].join('\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PDUFA Watchlist//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${yyyymmdd}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function downloadIcs(ticker) {
  const blob = new Blob([buildIcs(ticker)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ticker.ticker}-PDUFA-${ticker.pdufaDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---------- PRICE MOMENTUM STRIP ----------
function priceMomentumStrip(pc) {
  if (!pc) return '';
  const cells = [
    { label: '1D',  v: pc.change1D },
    { label: '5D',  v: pc.change5D },
    { label: '1M',  v: pc.change1M },
    { label: '3M',  v: pc.change3M },
    { label: '6M',  v: pc.change6M },
    { label: 'YTD', v: pc.changeYTD },
    { label: '1Y',  v: pc.change1Y },
  ].filter(c => c.v !== null && c.v !== undefined && !isNaN(c.v));
  if (!cells.length) return '';
  const items = cells.map(c => {
    const cls = c.v > 0 ? 'momentum__cell--up' : c.v < 0 ? 'momentum__cell--down' : 'momentum__cell--flat';
    const sign = c.v > 0 ? '+' : '';
    return `<span class="momentum__cell ${cls}"><span class="momentum__label">${c.label}</span><span class="momentum__val">${sign}${c.v.toFixed(1)}%</span></span>`;
  }).join('');
  const event = (pc.notableEvents && pc.notableEvents[0])
    ? `<div class="momentum__note">Notable: ${escapeHTML(pc.notableEvents[0].date)} ${pc.notableEvents[0].change > 0 ? '+' : ''}${pc.notableEvents[0].change}% — ${escapeHTML(pc.notableEvents[0].note)}</div>`
    : '';
  return `<div class="momentum">${items}</div>${event}`;
}

// ---------- CASH RUNWAY BADGE ----------
function cashRunwayBadge(cr) {
  if (!cr) return '';
  const risk = (cr.dilutionRisk || 'Unknown').toLowerCase();
  const cls = risk === 'critical' ? 'runway-badge--critical'
            : risk === 'high'     ? 'runway-badge--high'
            : risk === 'medium'   ? 'runway-badge--medium'
            : risk === 'low'      ? 'runway-badge--low'
            : 'runway-badge--neutral';
  const cashStr = formatMoney(cr.cashAndEquivalents);
  let runwayStr = '';
  if (cr.runwayMonths === null || cr.runwayMonths === undefined) {
    if (cr.quarterlyFreeCashFlow && cr.quarterlyFreeCashFlow > 0) {
      runwayStr = 'FCF+';
    } else {
      runwayStr = '—';
    }
  } else if (cr.runwayMonths > 36) {
    runwayStr = '>36mo runway';
  } else {
    runwayStr = `${cr.runwayMonths}mo runway`;
  }
  return `
    <div class="runway-badge ${cls}" title="${escapeHTML(cr.summary || '')}">
      <span class="runway-badge__label">Cash</span>
      <span class="runway-badge__cash">${cashStr}</span>
      <span class="runway-badge__sep">·</span>
      <span class="runway-badge__runway">${runwayStr}</span>
      <span class="runway-badge__sep">·</span>
      <span class="runway-badge__risk">${escapeHTML(cr.dilutionRisk || 'Unknown')} dilution risk</span>
    </div>`;
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
}

// ---------- SPONSOR TRACK RECORD ----------
function sponsorTrackRecordLine(tr) {
  if (!tr) return '';
  const apv = tr.approvalsLast10y ?? '?';
  const crls = tr.crlsLast10y ?? '?';
  const tentative = (tr.tentativeApprovals && tr.tentativeApprovals.length) ? ` + ${tr.tentativeApprovals.length} tentative` : '';
  const approvalNames = (tr.approvalsList || []).map(a => escapeHTML(a.drug)).slice(0, 3).join(', ');
  return `
    <div class="track-record" title="${escapeHTML(tr.summary || '')}">
      <span class="track-record__icon">📋</span>
      <span class="track-record__label">Sponsor track record (10y):</span>
      <span class="track-record__count"><strong>${apv}</strong> approvals${tentative}</span>
      <span class="track-record__sep">·</span>
      <span class="track-record__crl"><strong>${crls}</strong> CRLs</span>
      ${approvalNames ? `<span class="track-record__names">${approvalNames}</span>` : ''}
    </div>`;
}

// ---------- BULLETS ----------
function bulletList(items) {
  if (!items) return '';
  if (typeof items === 'string') return `<p>${escapeHTML(items)}</p>`;
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul>${items.map((x) => `<li>${escapeHTML(x)}</li>`).join('')}</ul>`;
}

// ---------- FILTER PREDICATES ----------
function isYes(v) {
  return v && /^yes/i.test(String(v).trim());
}

// Apply the current UI filter chip + hidden state + search query to a list of
// tickers. Shared by renderTables() and renderCards() so filtering affects
// every visible part of the dashboard (not just the bottom cards grid).
function applyUiFilters(list) {
  let result = list.slice();
  // Drop hidden tickers unless the user explicitly filtered to 'hidden'.
  if (UI.filter !== 'hidden') {
    result = result.filter((t) => !isHidden(t.ticker));
  }
  result = result.filter((t) => matchesFilter(t, UI.filter));
  if (UI.search) result = result.filter((t) => applySearch(t, UI.search));
  return result;
}

function matchesFilter(t, filter) {
  switch (filter) {
    case 'all':       return true;
    case 'starred':   return isStarred(t.ticker);
    case 'hidden':    return isHidden(t.ticker);
    case 'nme':       return isYes(t.nme);
    case 'btd':       return isYes(t.btd);
    case 'priority':  return isYes(t.priorityReview);
    case 'fasttrack': return isYes(t.fastTrack);
    case 'adcom':     return t.adcom && !/^(no|none|n\/a)/i.test(String(t.adcom));
    case 'smallcap':  return parseMoney(t.marketCap) != null && parseMoney(t.marketCap) < 500e6;
    default:          return true;
  }
}

function applySearch(t, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [t.ticker, t.company, t.drug, t.indication]
    .filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(q));
}

// ---------- RENDER ----------
let DATA = null, PREV_BY_TICKER = {};
let UI = { filter: 'all', sort: 'pdufa-asc', search: '' };

function render(data, prev) {
  DATA = data;
  PREV_BY_TICKER = {};
  if (prev && Array.isArray(prev.tickers)) {
    prev.tickers.forEach((t) => { PREV_BY_TICKER[t.ticker] = t; });
  }
  const today = data.lastUpdated;

  // Header stamp
  document.getElementById('updated-stamp').textContent =
    'Updated ' + fmtDate(today) + ' · ' + (data.timezone || '');
  document.getElementById('run-tag').textContent =
    'run ' + (data.runId || data.lastUpdated || '');

  // Hero
  if (data.heroEyebrow) document.getElementById('hero-eyebrow').textContent = data.heroEyebrow;
  if (data.heroTitle)   document.getElementById('hero-title').textContent = data.heroTitle;
  if (data.heroLede)    document.getElementById('hero-lede').textContent = data.heroLede;
  if (data.calendarNote && !data.heroLede) {
    document.getElementById('hero-lede').textContent = data.calendarNote;
  }

  // KPIs
  const s = data.summary || {};
  const kpis = [
    { label: 'Upcoming', value: s.tracked ?? data.tickers.length, sub: 'pending PDUFAs', cls: 'kpi--total' },
    { label: 'High',     value: s.high     ?? data.tickers.filter(t => t.rating === 'high').length,   sub: '≤ 7 days', cls: 'kpi--high' },
    { label: 'Medium',   value: s.medium   ?? data.tickers.filter(t => t.rating === 'medium').length, sub: '2–8 weeks', cls: 'kpi--med' },
    { label: 'Watch',    value: s.watch    ?? data.tickers.filter(t => t.rating === 'watch').length,  sub: '> 8 weeks', cls: 'kpi--watch' },
    { label: 'Resolved', value: s.resolved ?? (data.resolved || []).length, sub: 'since prior run', cls: 'kpi--resolved' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map((k) => `
    <div class="kpi ${k.cls}">
      <div class="kpi__label">${k.label}</div>
      <div class="kpi__value">${k.value}</div>
      <div class="kpi__sub">${k.sub}</div>
    </div>`).join('');

  const timeline = document.getElementById('pdufa-timeline');
  if (timeline) renderTimeline(data.tickers || [], today, timeline);

  // Resolved
  const resolved = data.resolved || [];
  document.getElementById('count-resolved').textContent = resolved.length;
  document.getElementById('resolved-grid').innerHTML = resolved.map(renderResolvedCard).join('');

  // Buckets + tables (filtered by the current UI filter chip + search)
  renderTables();

  // Cards (rendered through current UI filter / sort / search)
  renderCards();

  // Toolbar wiring (idempotent)
  wireToolbar();

  // Deep-link to a ticker (#TICKER)
  if (location.hash && location.hash.length > 1) {
    const tk = location.hash.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const el = document.getElementById('card-' + tk);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

function renderResolvedCard(r) {
  const outcomeRaw = (r.outcome || '').toString();
  const isApproved = outcomeRaw.toLowerCase() === 'approved';
  const pillCls = isApproved ? 'pill--approved' : 'pill--crl';
  const pillLabel = isApproved ? 'Approved' : 'CRL';
  const cardCls = isApproved ? 'resolved-card--approved' : 'resolved-card--crl';
  const resolvedDate = r.resolvedDate || r.date || r.pdufaDate || '';
  const detail = r.outcomeNote || r.detail || '';
  const src = r.source || {};
  const srcUrl = typeof src === 'string' ? src : src.url || '';
  let srcName = typeof src === 'string' ? '' : src.name || '';
  if (!srcName && srcUrl) {
    try { srcName = new URL(srcUrl).hostname.replace(/^www\./, ''); } catch (e) { srcName = 'Source'; }
  }
  return `
    <article class="resolved-card ${cardCls}">
      <div class="resolved-card__head">
        <span class="resolved-card__ticker">${escapeHTML(r.ticker)}</span>
        <span class="pill ${pillCls}">${pillLabel}</span>
        <span class="resolved-card__date">${fmtDate(resolvedDate)}</span>
      </div>
      <div>
        <span class="resolved-card__drug">${escapeHTML(r.drug)}</span>
        <span class="resolved-card__indication">${escapeHTML(r.indication)}</span>
      </div>
      <p class="resolved-card__detail">${escapeHTML(detail)}</p>
      ${srcUrl ? `<a class="resolved-card__source" href="${srcUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(srcName)} ↗</a>` : ''}
    </article>`;
}

function tableRow(t, today) {
  const days = daysUntil(t.pdufaDate, today);
  const daysClass = days <= 7 ? 'date-cell__days--soon' : '';
  const daysLabel = days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`;
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  const prev = PREV_BY_TICKER[t.ticker];

  const ins = t.insider || {};
  const insPillCls = insiderPillClass(ins.signal);
  const insLabel = escapeHTML(ins.signal || 'N/A');
  const insDetail = ins.buys != null
    ? `${ins.buys}b/${ins.sells}s · ${escapeHTML(ins.netValue || '$0')}`
    : '';

  const xs = t.xSentiment || {};
  const rs = t.redditSentiment || {};
  const gt = t.googleTrends || {};

  return `
    <tr data-ticker="${safeId}">
      <td data-label="Ticker">
        <span class="ticker-cell">${escapeHTML(t.ticker)}
          <span class="ticker-cell__company">${escapeHTML(t.company)}</span>
        </span>
      </td>
      <td class="drug-cell" data-label="Drug">
        <span class="drug-cell__name">${escapeHTML(t.drug)}</span>
        <span class="drug-cell__indication">${escapeHTML(t.indication)}</span>
      </td>
      <td class="date-cell" data-label="PDUFA">
        ${fmtDate(t.pdufaDate)}
        <span class="date-cell__days ${daysClass}">${daysLabel}</span>
      </td>
      <td data-label="Run Δ">${diffBadgesFor(t, prev)}</td>
      <td data-label="NME">
        <span class="pill ${isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}" title="New Molecular Entity">${
          isYes(t.nme) ? 'NME' : 'non-NME'
        }</span>
      </td>
      <td data-label="AdCom">
        <span class="pill ${isYes(t.adcom) ? 'pill--medium' : 'pill--neutral'}">${escapeHTML(t.adcom || 'N/A')}</span>
      </td>
      <td data-label="Insider">
        <span class="pill ${insPillCls}" title="${escapeHTML(ins.summary || '')}">${insLabel}</span>
        <span style="font-size: var(--text-xs); color: var(--color-text-muted); display: block; margin-top: 2px">${insDetail}</span>
      </td>
      <td data-label="Sentiment">
        <span class="pill ${sentimentPillClass(xs.overall)} pill--sm">${escapeHTML(xs.overall || 'N/A')}</span>
        <span class="pill ${sentimentPillClass(rs.overall)} pill--sm">${escapeHTML(rs.overall || 'N/A')}</span>
        <span class="pill ${trendsPillClass(gt.signal)} pill--sm">${escapeHTML(gt.signal || 'N/A')}</span>
      </td>
      <td data-label="Approval odds">${oddsGauge(t.approvalOdds)}</td>
      <td class="price-cell" data-label="Price · Cap">
        ${escapeHTML(t.price || '—')}
        <span class="price-cell__cap">${escapeHTML(t.marketCap || '')}</span>
      </td>
    </tr>
  `;
}

function watchRow(t, today) {
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  const flag = isYes(t.nme) ? 'NME'
             : isYes(t.btd) ? 'BTD'
             : isYes(t.adcom) ? 'AdCom'
             : t.priorityReview && isYes(t.priorityReview) ? 'Priority'
             : t.fastTrack && isYes(t.fastTrack) ? 'Fast Track'
             : '—';
  return `
    <tr data-ticker="${safeId}">
      <td data-label="Ticker"><span class="ticker-cell">${escapeHTML(t.ticker)}</span></td>
      <td data-label="Drug">${escapeHTML(t.drug)}</td>
      <td class="date-cell" data-label="PDUFA">${fmtDate(t.pdufaDate)}</td>
      <td data-label="Indication">${escapeHTML(t.indication)}</td>
      <td data-label="Key flag"><span class="pill pill--neutral">${escapeHTML(flag)}</span></td>
    </tr>
  `;
}

function tickerCard(t, today) {
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  const days = daysUntil(t.pdufaDate, today);
  const ratingLabel = RATING_LABEL[t.rating] || 'WATCH';
  const pillCls =
    t.rating === 'high' ? 'pill--high' : t.rating === 'medium' ? 'pill--medium' : 'pill--watch';
  const prev = PREV_BY_TICKER[t.ticker];

  const extraDates =
    Array.isArray(t.pdufaDatesExtra) && t.pdufaDatesExtra.length
      ? `<div style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px">+ ${t.pdufaDatesExtra.map(fmtDate).join(' · ')}</div>`
      : '';

  const xs = t.xSentiment || {};
  const rs = t.redditSentiment || {};
  const ins = t.insider || {};
  const gt = t.googleTrends || {};

  const sentimentLines = `
    <div class="sentiment-block">
      <p class="sentiment-line">
        <span class="sentiment-label">X Sentiment:</span>
        <span class="pill ${sentimentPillClass(xs.overall)} pill--sm">${escapeHTML(xs.overall || 'N/A')}</span>
        <span class="sentiment-volume">${escapeHTML(xs.volume || '')}</span>
        <span class="sentiment-summary">— ${escapeHTML(xs.summary || '')}</span>
      </p>
      <p class="sentiment-line">
        <span class="sentiment-label">Reddit Sentiment:</span>
        <span class="pill ${sentimentPillClass(rs.overall)} pill--sm">${escapeHTML(rs.overall || 'N/A')}</span>
        <span class="sentiment-volume">${escapeHTML(rs.volume || '')}</span>
        <span class="sentiment-summary">— ${escapeHTML(rs.summary || '')}</span>
      </p>
      <p class="sentiment-line">
        <span class="sentiment-label">Insider:</span>
        <span class="pill ${insiderPillClass(ins.signal)} pill--sm">${escapeHTML(ins.signal || 'N/A')}</span>
        <span class="sentiment-volume">${ins.buys != null ? ins.buys + 'b / ' + ins.sells + 's · net ' + escapeHTML(ins.netValue || '$0') : ''}</span>
        <span class="sentiment-summary">— ${escapeHTML(ins.summary || '')}</span>
      </p>
      <p class="sentiment-line">
        <span class="sentiment-label">Google Trends:</span>
        <span class="pill ${trendsPillClass(gt.signal)} pill--sm">${escapeHTML(gt.signal || 'N/A')}</span>
        <span class="sentiment-volume">${escapeHTML(gt.volume || '')}${gt.peakDate ? ' · peak ' + escapeHTML(gt.peakDate) : ''}</span>
        <span class="sentiment-summary">— ${escapeHTML(gt.summary || '')}</span>
      </p>
    </div>
  `;

  const starredCls = isStarred(t.ticker) ? ' is-active' : '';
  const hiddenCls  = isHidden(t.ticker)  ? ' is-active' : '';
  const cardCls = [isStarred(t.ticker) ? 'is-starred' : '', isHidden(t.ticker) ? 'is-hidden' : ''].filter(Boolean).join(' ');

  const asOf = (field) => t[field + 'AsOf'] ? `<span class="metric__as-of">as of ${escapeHTML(t[field + 'AsOf'])}</span>` : '';

  return `
    <article class="ticker-card ${cardCls}" id="card-${safeId}">
      <header class="ticker-card__head">
        <div class="ticker-card__id">
          <div class="ticker-card__ticker">${escapeHTML(t.ticker)}</div>
          <div class="ticker-card__company">${escapeHTML(t.company)}</div>
        </div>
        <div class="ticker-card__price">
          <div class="ticker-card__price-val">${escapeHTML(t.price || '—')}</div>
          <span class="ticker-card__cap">${escapeHTML(t.marketCap || '')}</span>
          <div class="ticker-card__actions">
            <button type="button" class="icon-btn${starredCls}" data-action="star" data-ticker="${escapeHTML(t.ticker)}" title="Star">★</button>
            <button type="button" class="icon-btn${hiddenCls}" data-action="hide" data-ticker="${escapeHTML(t.ticker)}" title="Hide">⊘</button>
            <button type="button" class="icon-btn" data-action="ics" data-ticker="${escapeHTML(t.ticker)}" title="Download .ics">📅</button>
            <button type="button" class="icon-btn" data-action="copy" data-ticker="${escapeHTML(t.ticker)}" title="Copy link">#</button>
          </div>
        </div>
      </header>

      <div class="ticker-card__body">
        <div class="ticker-card__rating-row">
          <span class="pill ${pillCls}">${ratingLabel}</span>
          <span class="pill ${isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}" title="New Molecular Entity">${isYes(t.nme) ? 'NME' : 'non-NME'}</span>
          ${isYes(t.btd) ? '<span class="pill pill--medium" title="Breakthrough Therapy Designation">BTD</span>' : ''}
          ${isYes(t.priorityReview) ? '<span class="pill pill--medium" title="Priority Review">Priority</span>' : ''}
          ${isYes(t.fastTrack) ? '<span class="pill pill--medium" title="Fast Track">Fast Track</span>' : ''}
          <span class="ticker-card__pdufa">${fmtDate(t.pdufaDate)}</span>
          <span style="font-family: var(--font-mono); font-size: var(--text-xs); color: ${days <= 7 ? 'var(--color-error)' : 'var(--color-text-muted)'}">${days < 0 ? Math.abs(days) + 'd ago' : 'in ' + days + 'd'}</span>
          ${diffBadgesFor(t, prev)}
        </div>
        ${extraDates}

        <h3 class="ticker-card__drug-name" style="margin-top: var(--space-3)">${escapeHTML(t.drug)}</h3>
        <p class="ticker-card__indication">${escapeHTML(t.indication)}</p>

        ${priceTargetComparison(t)}

        <div class="metrics-grid">
          <div class="metric"><div class="metric__label">Approval odds</div><div class="metric__value">${oddsGauge(t.approvalOdds)}</div></div>
          <div class="metric"><div class="metric__label">Short int.</div><div class="metric__value">${escapeHTML(t.shortInterest || '—')}</div>${asOf('shortInterest')}</div>
          <div class="metric"><div class="metric__label">Implied vol.</div><div class="metric__value">${escapeHTML(t.iv || '—')}</div>${asOf('iv')}</div>
          <div class="metric"><div class="metric__label">Analyst PT</div><div class="metric__value">${escapeHTML(t.analystPT || '—')}</div>${asOf('analystPT')}</div>
        </div>

        ${priceMomentumStrip(t.priceChange)}
        ${cashRunwayBadge(t.cashRunway)}
        ${sponsorTrackRecordLine(t.sponsorTrackRecord)}

        <p class="profile-text">${safeProfile(t.drugProfile || '')}</p>

        ${sentimentLines}

        <div class="thesis">
          <details class="thesis__bull">
            <summary>Bull case</summary>
            <div class="thesis__body">${bulletList(t.bull)}</div>
          </details>
          <details class="thesis__bear">
            <summary>Bear case</summary>
            <div class="thesis__body">${bulletList(t.bear)}</div>
          </details>
          <details class="thesis__risk">
            <summary>Key risk</summary>
            <div class="thesis__body">${bulletList(t.risk)}</div>
          </details>
        </div>

        <div class="sources">
          ${(t.sources || []).map((s) => `<a class="source-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.name)} ↗</a>`).join('')}
        </div>
      </div>
    </article>
  `;
}

// ---------- TABLES RENDER (filter / search aware; always sorted by PDUFA date) ----------
function renderTables() {
  if (!DATA) return;
  const today = DATA.lastUpdated;
  const byDate = (a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || '');

  const filtered = applyUiFilters(DATA.tickers);
  const high  = filtered.filter((t) => t.rating === 'high').sort(byDate);
  const med   = filtered.filter((t) => t.rating === 'medium').sort(byDate);
  const watch = filtered.filter((t) => t.rating === 'watch').sort(byDate);

  document.getElementById('count-high').textContent   = high.length;
  document.getElementById('count-medium').textContent = med.length;
  document.getElementById('count-watch').textContent  = watch.length;
  document.getElementById('count-total').textContent  = filtered.length;

  document.querySelector('#table-high tbody').innerHTML   = high.map((t) => tableRow(t, today)).join('');
  document.querySelector('#table-medium tbody').innerHTML = med.map((t) => tableRow(t, today)).join('');
  document.querySelector('#table-watch tbody').innerHTML  = watch.map((t) => watchRow(t, today)).join('');

  // Re-wire row → card-scroll (innerHTML wipes previous listeners)
  document.querySelectorAll('.table tbody tr[data-ticker]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = 'card-' + row.dataset.ticker;
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.style.transition = 'box-shadow 600ms ease';
        target.style.boxShadow = '0 0 0 2px var(--color-primary)';
        setTimeout(() => (target.style.boxShadow = ''), 1400);
      }
    });
  });
}

// Render every filter-aware section in one call. Use this from any handler
// that mutates UI.filter, UI.search, hidden state, or star state.
function renderAll() {
  renderTables();
  renderCards();
}

// ---------- CARDS RENDER (filter / sort / search aware) ----------
function renderCards() {
  if (!DATA) return;
  const today = DATA.lastUpdated;
  let list = applyUiFilters(DATA.tickers);

  // Sort
  const cmpDate = (a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || '');
  switch (UI.sort) {
    case 'pdufa-desc':
      list.sort((a, b) => cmpDate(b, a)); break;
    case 'si-desc':
      list.sort((a, b) => (parsePercent(b.shortInterest) || 0) - (parsePercent(a.shortInterest) || 0)); break;
    case 'mc-desc':
      list.sort((a, b) => (parseMoney(b.marketCap) || 0) - (parseMoney(a.marketCap) || 0)); break;
    case 'mc-asc':
      list.sort((a, b) => (parseMoney(a.marketCap) || 0) - (parseMoney(b.marketCap) || 0)); break;
    case 'odds-desc':
      list.sort((a, b) => (parsePercent(b.approvalOdds) || 0) - (parsePercent(a.approvalOdds) || 0)); break;
    case 'pdufa-asc':
    default:
      list.sort(cmpDate);
  }

  const grid = document.getElementById('cards-grid');
  const empty = document.getElementById('empty-state');
  if (!list.length) {
    grid.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    grid.innerHTML = list.map((t) => tickerCard(t, today)).join('');
  }

  // Wire card buttons
  grid.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const ticker = btn.dataset.ticker;
      const found = DATA.tickers.find((t) => t.ticker === ticker);
      if (!found) return;
      if (action === 'star') { toggleStar(ticker); renderAll(); }
      else if (action === 'hide') { toggleHide(ticker); renderAll(); }
      else if (action === 'ics') downloadIcs(found);
      else if (action === 'copy') {
        const url = location.origin + location.pathname + '#' + ticker;
        navigator.clipboard?.writeText(url);
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = '#'), 900);
      }
    });
  });
}

// ---------- TOOLBAR ----------
let toolbarWired = false;
function wireToolbar() {
  if (toolbarWired) return;
  toolbarWired = true;
  document.querySelectorAll('.chip[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-filter]').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      UI.filter = chip.dataset.filter;
      renderAll();
    });
  });
  const sortEl = document.getElementById('sort-select');
  if (sortEl) {
    sortEl.addEventListener('change', () => { UI.sort = sortEl.value; renderCards(); });
  }
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    let t = 0;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { UI.search = searchEl.value.trim(); renderAll(); }, 100);
    });
  }

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') { e.target.blur(); }
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });
}
