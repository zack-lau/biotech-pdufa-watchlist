/* ------------------------------------------------------------------
   PDUFA Watchlist — render layer
   ------------------------------------------------------------------ */

// ---------- THEME TOGGLE ----------
(function initThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  setIcon();

  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
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

// ---------- DATA LOAD ----------
fetch('./data.json')
  .then((r) => r.json())
  .then(render)
  .catch((err) => {
    console.error('Failed to load data.json', err);
    document.querySelector('main').innerHTML =
      '<section class="section"><div class="shell"><p>Failed to load dashboard data.</p></div></section>';
  });

// ---------- HELPERS ----------
const RATING_LABEL = { high: 'HIGH', medium: 'MEDIUM', watch: 'WATCH' };
const RATING_SYMBOL = { high: '[HIGH]', medium: '[MED]', watch: '[WATCH]' };

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    .replace(/>/g, '&gt;');
}

// drugProfile contains hand-curated <strong> tags. Allow only those.
function safeProfile(html) {
  const escaped = escapeHTML(html);
  return escaped.replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');
}

// ---------- SENTIMENT / INSIDER PILL HELPERS ----------

/**
 * Map a sentiment overall value to a pill CSS class.
 * Bullish  -> pill--medium  (green-ish)
 * Bearish  -> pill--high    (red-ish)
 * Mixed    -> pill--neutral
 * Neutral  -> pill--neutral
 * Quiet    -> pill--neutral
 */
function sentimentPillClass(overall) {
  if (!overall) return 'pill--neutral';
  const v = String(overall).toLowerCase();
  if (v.startsWith('bullish') || v === 'positive') return 'pill--medium';
  if (v.startsWith('bearish') || v === 'negative') return 'pill--high';
  return 'pill--neutral';
}

/**
 * Map an insider signal value to a pill CSS class.
 * Bullish  -> pill--medium
 * Bearish  -> pill--high
 * Mixed    -> pill--neutral
 * Neutral  -> pill--neutral
 */
function insiderPillClass(signal) {
  if (!signal) return 'pill--neutral';
  const v = String(signal).toLowerCase();
  if (v.startsWith('bullish') || v === 'positive') return 'pill--medium';
  if (v.startsWith('bearish') || v === 'negative') return 'pill--high';
  return 'pill--neutral';
}

// ---------- RENDER ----------
function render(data) {
  const today = data.lastUpdated;

  // header stamp
  document.getElementById('updated-stamp').textContent =
    'Updated ' + fmtDate(today) + ' · ' + data.timezone;

  // KPIs
  const kpis = [
    { label: 'Upcoming', value: data.summary.tracked, sub: 'pending PDUFAs', cls: 'kpi--total' },
    { label: 'High', value: data.summary.high, sub: '<= 7 days', cls: 'kpi--high' },
    { label: 'Medium', value: data.summary.medium, sub: '2 - 8 weeks', cls: 'kpi--med' },
    { label: 'Watch', value: data.summary.watch, sub: '> 8 weeks', cls: 'kpi--watch' },
    { label: 'Resolved', value: data.summary.resolved, sub: 'since prior run', cls: 'kpi--resolved' },
  ];

  document.getElementById('kpi-grid').innerHTML = kpis
    .map(
      (k) => `
      <div class="kpi ${k.cls}">
        <div class="kpi__label">${k.label}</div>
        <div class="kpi__value">${k.value}</div>
        <div class="kpi__sub">${k.sub}</div>
      </div>`,
    )
    .join('');

  // Resolved
  document.getElementById('count-resolved').textContent = data.resolved.length;
  document.getElementById('resolved-grid').innerHTML = data.resolved
    .map((r) => {
      const isApproved = r.outcome === 'approved';
      const pillCls = isApproved ? 'pill--approved' : 'pill--crl';
      const pillLabel = isApproved ? 'Approved' : 'CRL';
      const cardCls = isApproved ? 'resolved-card--approved' : 'resolved-card--crl';
      return `
        <article class="resolved-card ${cardCls}">
          <div class="resolved-card__head">
            <span class="resolved-card__ticker">${escapeHTML(r.ticker)}</span>
            <span class="pill ${pillCls}">${pillLabel}</span>
            <span class="resolved-card__date">${fmtDate(r.date)}</span>
          </div>
          <div>
            <span class="resolved-card__drug">${escapeHTML(r.drug)}</span>
            <span class="resolved-card__indication">${escapeHTML(r.indication)}</span>
          </div>
          <p class="resolved-card__detail">${escapeHTML(r.detail)}</p>
          <p class="resolved-card__reaction">${escapeHTML(r.stockReaction)}</p>
          <a class="resolved-card__source" href="${r.source.url}" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(r.source.name)} &nearr;
          </a>
        </article>`;
    })
    .join('');

  // Bucket tickers
  const high = data.tickers.filter((t) => t.rating === 'high');
  const med = data.tickers.filter((t) => t.rating === 'medium');

  document.getElementById('count-high').textContent = high.length;
  document.getElementById('count-medium').textContent = med.length;
  document.getElementById('count-total').textContent = data.tickers.length;

  // Sort by PDUFA ascending
  const byDate = (a, b) => a.pdufaDate.localeCompare(b.pdufaDate);

  document.querySelector('#table-high tbody').innerHTML = high
    .sort(byDate)
    .map((t) => tableRow(t, today))
    .join('');

  document.querySelector('#table-medium tbody').innerHTML = med
    .sort(byDate)
    .map((t) => tableRow(t, today))
    .join('');

  // Cards
  document.getElementById('cards-grid').innerHTML = data.tickers
    .sort(byDate)
    .map((t) => tickerCard(t, today))
    .join('');

  // Anchor link from table row -> matching card
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

function isYes(v) {
  return v && /^yes/i.test(String(v).trim());
}

function tableRow(t, today) {
  const days = daysUntil(t.pdufaDate, today);
  const daysClass = days <= 7 ? 'date-cell__days--soon' : '';
  const daysLabel = days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`;
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');

  // Insider column: signal pill + counts + net
  const ins = t.insider || {};
  const insPillCls = insiderPillClass(ins.signal);
  const insLabel = escapeHTML(ins.signal || 'N/A');
  const insDetail = ins.buys != null
    ? `${ins.buys}b / ${ins.sells}s, ${escapeHTML(ins.netValue || '$0')}`
    : '';

  // X sentiment column
  const xs = t.xSentiment || {};
  const xPillCls = sentimentPillClass(xs.overall);
  const xLabel = escapeHTML(xs.overall || 'N/A');

  // Reddit sentiment column
  const rs = t.redditSentiment || {};
  const rPillCls = sentimentPillClass(rs.overall);
  const rLabel = escapeHTML(rs.overall || 'N/A');

  return `
    <tr data-ticker="${safeId}">
      <td>
        <span class="ticker-cell">${escapeHTML(t.ticker)}
          <span class="ticker-cell__company">${escapeHTML(t.company)}</span>
        </span>
      </td>
      <td class="drug-cell">
        <span class="drug-cell__name">${escapeHTML(t.drug)}</span>
        <span class="drug-cell__indication">${escapeHTML(t.indication)}</span>
      </td>
      <td class="date-cell">
        ${fmtDate(t.pdufaDate)}
        <span class="date-cell__days ${daysClass}">${daysLabel}</span>
      </td>
      <td>
        <span class="pill ${isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}" title="New Molecular Entity">${
          isYes(t.nme) ? 'NME' : 'non-NME'
        }</span>
      </td>
      <td>
        <span class="pill ${isYes(t.adcom) ? 'pill--medium' : 'pill--neutral'}">${
          escapeHTML(t.adcom || 'N/A')
        }</span>
      </td>
      <td>
        <span class="pill ${insPillCls}" title="${escapeHTML(ins.summary || '')}">${insLabel}</span>
        <span style="font-size: var(--text-xs); color: var(--color-text-muted); display: block; margin-top: 2px">${insDetail}</span>
      </td>
      <td>
        <span class="pill ${xPillCls}">${xLabel}</span>
      </td>
      <td>
        <span class="pill ${rPillCls}">${rLabel}</span>
      </td>
      <td><span style="font-size: var(--text-xs); color: var(--color-text-muted)">${escapeHTML(t.approvalOdds)}</span></td>
      <td class="price-cell">
        ${escapeHTML(t.price)}
        <span class="price-cell__cap">${escapeHTML(t.marketCap)}</span>
      </td>
    </tr>
  `;
}

function tickerCard(t, today) {
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  const days = daysUntil(t.pdufaDate, today);
  const ratingLabel = RATING_LABEL[t.rating] || 'WATCH';
  const pillCls =
    t.rating === 'high' ? 'pill--high' : t.rating === 'medium' ? 'pill--medium' : 'pill--watch';

  const extraDates =
    Array.isArray(t.pdufaDatesExtra) && t.pdufaDatesExtra.length
      ? `<div style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px">+ ${t.pdufaDatesExtra
          .map(fmtDate)
          .join(' · ')}</div>`
      : '';

  // Sentiment and insider data
  const xs = t.xSentiment || {};
  const rs = t.redditSentiment || {};
  const ins = t.insider || {};

  const xPillCls = sentimentPillClass(xs.overall);
  const rPillCls = sentimentPillClass(rs.overall);
  const insPillCls = insiderPillClass(ins.signal);

  const sentimentLines = `
    <div class="sentiment-block">
      <p class="sentiment-line">
        <span class="sentiment-label">X Sentiment:</span>
        <span class="pill ${xPillCls} pill--sm">${escapeHTML(xs.overall || 'N/A')}</span>
        <span class="sentiment-volume">${escapeHTML(xs.volume || '')}</span>
        <span class="sentiment-summary">— ${escapeHTML(xs.summary || '')}</span>
      </p>
      <p class="sentiment-line">
        <span class="sentiment-label">Reddit Sentiment:</span>
        <span class="pill ${rPillCls} pill--sm">${escapeHTML(rs.overall || 'N/A')}</span>
        <span class="sentiment-volume">${escapeHTML(rs.volume || '')}</span>
        <span class="sentiment-summary">— ${escapeHTML(rs.summary || '')}</span>
      </p>
      <p class="sentiment-line">
        <span class="sentiment-label">Insider:</span>
        <span class="pill ${insPillCls} pill--sm">${escapeHTML(ins.signal || 'N/A')}</span>
        <span class="sentiment-volume">${ins.buys != null ? ins.buys + ' buys / ' + ins.sells + ' sells, net ' + escapeHTML(ins.netValue || '$0') : ''}</span>
        <span class="sentiment-summary">— ${escapeHTML(ins.summary || '')}</span>
      </p>
    </div>
  `;

  return `
    <article class="ticker-card" id="card-${safeId}">
      <header class="ticker-card__head">
        <div class="ticker-card__id">
          <div class="ticker-card__ticker">${escapeHTML(t.ticker)}</div>
          <div class="ticker-card__company">${escapeHTML(t.company)}</div>
        </div>
        <div class="ticker-card__price">
          <div class="ticker-card__price-val">${escapeHTML(t.price)}</div>
          <span class="ticker-card__cap">${escapeHTML(t.marketCap)}</span>
        </div>
      </header>

      <div class="ticker-card__body">
        <div class="ticker-card__rating-row">
          <span class="pill ${pillCls}">${ratingLabel}</span>
          <span class="pill ${isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}" title="New Molecular Entity">${
            isYes(t.nme) ? 'NME' : 'non-NME'
          }</span>
          ${isYes(t.btd) ? '<span class="pill pill--medium" title="Breakthrough Therapy Designation">BTD</span>' : ''}
          <span class="ticker-card__pdufa">${fmtDate(t.pdufaDate)}</span>
          <span style="font-family: var(--font-mono); font-size: var(--text-xs); color: ${
            days <= 7 ? 'var(--color-error)' : 'var(--color-text-muted)'
          }">${days < 0 ? Math.abs(days) + 'd ago' : 'in ' + days + 'd'}</span>
        </div>
        ${extraDates}

        <h3 class="ticker-card__drug-name" style="margin-top: var(--space-3)">${escapeHTML(t.drug)}</h3>
        <p class="ticker-card__indication">${escapeHTML(t.indication)}</p>

        <div class="metrics-grid">
          <div class="metric"><div class="metric__label">Analyst PT</div><div class="metric__value">${escapeHTML(t.analystPT)}</div></div>
          <div class="metric"><div class="metric__label">Short int.</div><div class="metric__value">${escapeHTML(t.shortInterest)}</div></div>
          <div class="metric"><div class="metric__label">Implied vol.</div><div class="metric__value">${escapeHTML(t.iv)}</div></div>
          <div class="metric"><div class="metric__label">NME · BTD · AdCom</div><div class="metric__value">${escapeHTML(t.nme || '?')} · ${escapeHTML(t.btd || '?')} · ${escapeHTML(t.adcom || '?')}</div></div>
        </div>

        <p class="profile-text">${safeProfile(t.drugProfile)}</p>

        ${sentimentLines}

        <div class="thesis">
          <details class="thesis__bull">
            <summary>Bull case</summary>
            <div class="thesis__body">${escapeHTML(t.bull)}</div>
          </details>
          <details class="thesis__bear">
            <summary>Bear case</summary>
            <div class="thesis__body">${escapeHTML(t.bear)}</div>
          </details>
          <details class="thesis__risk">
            <summary>Key risk</summary>
            <div class="thesis__body">${escapeHTML(t.risk)}</div>
          </details>
        </div>

        <div class="sources">
          ${t.sources
            .map(
              (s) =>
                `<a class="source-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(
                  s.name,
                )} &nearr;</a>`,
            )
            .join('')}
        </div>
      </div>
    </article>
  `;
}
