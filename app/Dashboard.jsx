'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pdufa-watchlist-state';
const RATING_LABEL = { high: 'HIGH', medium: 'MEDIUM', watch: 'WATCH' };
const RATING_ORDER = { high: 0, medium: 1, watch: 2 };

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(parseIsoDateMs(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(parseIsoDateMs(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function parseIsoDateMs(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoFromDateMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysUntil(iso, today) {
  const t = parseIsoDateMs(today);
  const d = parseIsoDateMs(iso);
  if (Number.isNaN(t) || Number.isNaN(d)) return 0;
  return Math.round((d - t) / 86400000);
}

function parsePercent(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /unknown|n\/a|unavailable/i.test(s)) return null;
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
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1;
  return parseFloat(m[1]) * mult;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function isYes(v) {
  return v && /^yes/i.test(String(v).trim());
}

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

function safeProfile(html) {
  const parts = String(html || '').split(/(<strong>|<\/strong>)/g);
  let strong = false;
  return parts.map((part, i) => {
    if (part === '<strong>') {
      strong = true;
      return null;
    }
    if (part === '</strong>') {
      strong = false;
      return null;
    }
    return strong ? <strong key={i}>{part}</strong> : part;
  });
}

function buildIcs(ticker) {
  const d = new Date(parseIsoDateMs(ticker.pdufaDate));
  const yyyymmdd = ticker.pdufaDate.replace(/-/g, '');
  const dtEnd = new Date(d.getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const uid = `${ticker.ticker}-${yyyymmdd}@pdufa-watchlist.local`;
  const summary = `${ticker.ticker} PDUFA - ${ticker.drug || ''}`.trim();
  const desc = [
    `Ticker: ${ticker.ticker}`,
    `Drug: ${ticker.drug || ''}`,
    `Indication: ${ticker.indication || ''}`,
    `Approval odds: ${ticker.approvalOdds || 'n/a'}`,
    `Rating: ${(ticker.rating || '').toUpperCase()}`
  ].join('\\n');
  return [
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
    'END:VCALENDAR'
  ].join('\r\n');
}

function Badge({ children, className = '', title }) {
  return <span className={`pill ${className}`} title={title}>{children}</span>;
}

function DiffBadges({ curr, prev }) {
  if (!prev) return <span className="diff diff--new">NEW</span>;
  const badges = [];
  if (curr.rating !== prev.rating) {
    const dir = RATING_ORDER[curr.rating] < RATING_ORDER[prev.rating] ? 'up' : 'down';
    badges.push(<span key="rating" className={`diff diff--${dir}`} title="rating change">{(prev.rating || '?').toUpperCase()} -&gt; {(curr.rating || '?').toUpperCase()}</span>);
  }
  const a = parsePercent(curr.approvalOdds);
  const b = parsePercent(prev.approvalOdds);
  if (a != null && b != null && Math.abs(a - b) >= 1) {
    const delta = a - b;
    badges.push(<span key="odds" className={`diff ${delta > 0 ? 'diff--up' : 'diff--down'}`} title="approval odds change">odds {delta > 0 ? '+' : ''}{delta.toFixed(0)}pp</span>);
  }
  const si1 = parsePercent(curr.shortInterest);
  const si0 = parsePercent(prev.shortInterest);
  if (si1 != null && si0 != null && Math.abs(si1 - si0) >= 0.5) {
    const delta = si1 - si0;
    badges.push(<span key="si" className={`diff ${delta > 0 ? 'diff--up' : 'diff--down'}`} title="short interest change">SI {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp</span>);
  }
  if (curr.pdufaDate !== prev.pdufaDate) badges.push(<span key="date" className="diff diff--down" title="PDUFA moved">date moved</span>);
  return badges.length ? badges : <span className="diff diff--flat">-</span>;
}

function OddsGauge({ odds }) {
  const val = parsePercent(odds);
  if (val == null) return <span className="odds-gauge__text">{odds || '-'}</span>;
  const cls = val < 35 ? 'odds-gauge__fill--low' : val < 65 ? 'odds-gauge__fill--mid' : 'odds-gauge__fill--high';
  return (
    <span className="odds-gauge">
      <span className="odds-gauge__bar"><span className={`odds-gauge__fill ${cls}`} style={{ width: `${val}%` }} /></span>
      <span className="odds-gauge__text">{odds}</span>
    </span>
  );
}

function PriceTarget({ t }) {
  const price = parseMoney(t.price);
  const target = parseMoney(t.analystPT);
  const delta = price != null && target != null && price > 0 ? ((target - price) / price) * 100 : null;
  const cls = delta == null ? 'price-target__delta--flat' : delta > 0 ? 'price-target__delta--up' : delta < 0 ? 'price-target__delta--down' : 'price-target__delta--flat';
  const label = delta == null ? 'Target delta unavailable' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs target`;
  return (
    <div className="price-target">
      <div className="price-target__cell">
        <div className="price-target__label">Current price</div>
        <div className="price-target__value">{t.price || '-'}</div>
        {t.priceAsOf && <div className="price-target__as-of">as of {t.priceAsOf}</div>}
      </div>
      <div className="price-target__cell">
        <div className="price-target__label">Analyst target</div>
        <div className="price-target__value">{t.analystPT || '-'}</div>
        {t.analystPTAsOf && <div className="price-target__as-of">as of {t.analystPTAsOf}</div>}
      </div>
      <div className={`price-target__delta ${cls}`}>{label}</div>
    </div>
  );
}

function Timeline({ tickers, today }) {
  const maxDays = 14;
  const t0Raw = parseIsoDateMs(today);
  const t0 = Number.isNaN(t0Raw) ? new Date().setHours(0, 0, 0, 0) : t0Raw;
  const ticks = [];
  for (let d = 0; d <= maxDays; d += 2) {
    const tickDate = isoFromDateMs(t0 + d * 86400000);
    ticks.push({ d, label: fmtDateShort(tickDate) });
  }
  const byDate = {};
  tickers.forEach((tk) => {
    byDate[tk.pdufaDate] = byDate[tk.pdufaDate] || [];
    byDate[tk.pdufaDate].push(tk);
  });
  const dots = [];
  Object.entries(byDate).forEach(([date, items]) => {
    const day = daysUntil(date, today);
    if (day < 0 || day > maxDays) return;
    items.forEach((tk, i) => dots.push({ tk, day, stack: i }));
  });
  return (
    <div className="timeline" id="pdufa-timeline" aria-label="PDUFA timeline">
      <svg className="timeline__svg" viewBox="0 0 1080 96" role="img">
        <line className="timeline__axis" x1="30" y1="66" x2="1050" y2="66" />
        {ticks.map((tick) => {
          const x = 30 + (tick.d / maxDays) * 1020;
          return <g key={tick.d}><line className="timeline__axis" x1={x} y1="66" x2={x} y2="70" /><text className="timeline__tick-text" x={x} y="84" textAnchor="middle">{tick.label}</text></g>;
        })}
        <line className="timeline__today-line" x1="30" y1="12" x2="30" y2="66" />
        <text className="timeline__today-text" x="30" y="10">Today</text>
        {dots.map(({ tk, day, stack }) => {
          const x = 30 + (day / maxDays) * 1020;
          const y = 58 - stack * 14;
          return (
            <g key={`${tk.ticker}-${stack}`}>
              <circle className={`timeline__dot timeline__dot--${tk.rating}`} cx={x} cy={y} r="5" aria-label={`${tk.ticker} - ${tk.drug} - ${fmtDate(tk.pdufaDate)}`} onClick={() => document.getElementById(`card-${tk.ticker.replace(/[^A-Z0-9]/gi, '_')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
              <text className="timeline__label" x={x + 8} y={y + 3}>{tk.ticker}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Momentum({ pc }) {
  if (!pc) return null;
  const cells = [
    ['1D', pc.change1D], ['5D', pc.change5D], ['1M', pc.change1M], ['3M', pc.change3M],
    ['6M', pc.change6M], ['YTD', pc.changeYTD], ['1Y', pc.change1Y]
  ].filter(([, v]) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!cells.length) return null;
  return (
    <>
      <div className="momentum">
        {cells.map(([label, v]) => (
          <span key={label} className={`momentum__cell ${v > 0 ? 'momentum__cell--up' : v < 0 ? 'momentum__cell--down' : 'momentum__cell--flat'}`}>
            <span className="momentum__label">{label}</span>
            <span className="momentum__val">{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
          </span>
        ))}
      </div>
      {pc.notableEvents?.[0] && <div className="momentum__note">Notable: {pc.notableEvents[0].date} {pc.notableEvents[0].change > 0 ? '+' : ''}{pc.notableEvents[0].change}% - {pc.notableEvents[0].note}</div>}
    </>
  );
}

function Runway({ cr }) {
  if (!cr) return null;
  const risk = (cr.dilutionRisk || 'Unknown').toLowerCase();
  const cls = risk === 'critical' ? 'runway-badge--critical' : risk === 'high' ? 'runway-badge--high' : risk === 'medium' ? 'runway-badge--medium' : risk === 'low' ? 'runway-badge--low' : 'runway-badge--neutral';
  const runway = cr.runwayMonths == null ? (cr.quarterlyFreeCashFlow > 0 ? 'FCF+' : '-') : cr.runwayMonths > 36 ? '>36mo runway' : `${cr.runwayMonths}mo runway`;
  return (
    <div className={`runway-badge ${cls}`} title={cr.summary || ''}>
      <span className="runway-badge__label">Cash</span>
      <span className="runway-badge__cash">{formatMoney(cr.cashAndEquivalents)}</span>
      <span className="runway-badge__sep">-</span>
      <span className="runway-badge__runway">{runway}</span>
      <span className="runway-badge__sep">-</span>
      <span className="runway-badge__risk">{cr.dilutionRisk || 'Unknown'} dilution risk</span>
    </div>
  );
}

function TrackRecord({ tr }) {
  if (!tr) return null;
  const names = (tr.approvalsList || []).map((a) => a.drug).slice(0, 3).join(', ');
  return (
    <div className="track-record" title={tr.summary || ''}>
      <span className="track-record__icon">#</span>
      <span className="track-record__label">Sponsor track record (10y):</span>
      <span className="track-record__count"><strong>{tr.approvalsLast10y ?? '?'}</strong> approvals{tr.tentativeApprovals?.length ? ` + ${tr.tentativeApprovals.length} tentative` : ''}</span>
      <span className="track-record__sep">-</span>
      <span className="track-record__crl"><strong>{tr.crlsLast10y ?? '?'}</strong> CRLs</span>
      {names && <span className="track-record__names">{names}</span>}
    </div>
  );
}

function BulletList({ items }) {
  if (!items) return null;
  if (typeof items === 'string') return <p>{items}</p>;
  return <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export default function Dashboard({ data, previous }) {
  const [ui, setUi] = useState({ filter: 'all', sort: 'pdufa-asc', search: '' });
  const [userState, setUserState] = useState({ starred: [], hidden: [] });
  const [theme, setTheme] = useState('light');
  const prevByTicker = useMemo(() => Object.fromEntries((previous?.tickers || []).map((t) => [t.ticker, t])), [previous]);
  const today = data.lastUpdated || new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      setUserState({ starred: [], hidden: [], ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}) });
      const stored = localStorage.getItem('pdufa-theme');
      setTheme(stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('pdufa-theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (location.hash.length > 1) {
      const id = `card-${location.hash.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [ui.filter, ui.search]);

  const isStarred = (ticker) => userState.starred?.includes(ticker);
  const isHidden = (ticker) => userState.hidden?.includes(ticker);
  const saveUserState = (next) => {
    setUserState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };
  const toggleStar = (ticker) => {
    const starred = isStarred(ticker) ? userState.starred.filter((x) => x !== ticker) : [...(userState.starred || []), ticker];
    saveUserState({ ...userState, starred });
  };
  const toggleHide = (ticker) => {
    const hidden = isHidden(ticker) ? userState.hidden.filter((x) => x !== ticker) : [...(userState.hidden || []), ticker];
    saveUserState({ ...userState, hidden });
  };

  const matchesFilter = (t) => {
    switch (ui.filter) {
      case 'starred': return isStarred(t.ticker);
      case 'hidden': return isHidden(t.ticker);
      case 'nme': return isYes(t.nme);
      case 'btd': return isYes(t.btd);
      case 'priority': return isYes(t.priorityReview);
      case 'fasttrack': return isYes(t.fastTrack);
      case 'adcom': return t.adcom && !/^(no|none|n\/a)/i.test(String(t.adcom));
      case 'smallcap': return parseMoney(t.marketCap) != null && parseMoney(t.marketCap) < 500e6;
      default: return true;
    }
  };
  const filtered = useMemo(() => {
    let list = [...(data.tickers || [])];
    if (ui.filter !== 'hidden') list = list.filter((t) => !isHidden(t.ticker));
    list = list.filter(matchesFilter);
    if (ui.search) {
      const q = ui.search.toLowerCase();
      list = list.filter((t) => [t.ticker, t.company, t.drug, t.indication].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)));
    }
    return list;
  }, [data.tickers, ui, userState]);

  const high = filtered.filter((t) => t.rating === 'high').sort((a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || ''));
  const medium = filtered.filter((t) => t.rating === 'medium').sort((a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || ''));
  const watch = filtered.filter((t) => t.rating === 'watch').sort((a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || ''));
  const cards = useMemo(() => {
    const list = [...filtered];
    const cmpDate = (a, b) => (a.pdufaDate || '').localeCompare(b.pdufaDate || '');
    switch (ui.sort) {
      case 'pdufa-desc': return list.sort((a, b) => cmpDate(b, a));
      case 'si-desc': return list.sort((a, b) => (parsePercent(b.shortInterest) || 0) - (parsePercent(a.shortInterest) || 0));
      case 'mc-desc': return list.sort((a, b) => (parseMoney(b.marketCap) || 0) - (parseMoney(a.marketCap) || 0));
      case 'mc-asc': return list.sort((a, b) => (parseMoney(a.marketCap) || 0) - (parseMoney(b.marketCap) || 0));
      case 'odds-desc': return list.sort((a, b) => (parsePercent(b.approvalOdds) || 0) - (parsePercent(a.approvalOdds) || 0));
      default: return list.sort(cmpDate);
    }
  }, [filtered, ui.sort]);

  const summary = data.summary || {};
  const kpis = [
    ['Upcoming', summary.tracked ?? data.tickers.length, 'pending PDUFAs', 'kpi--total'],
    ['High', summary.high ?? data.tickers.filter((t) => t.rating === 'high').length, '<= 7 days', 'kpi--high'],
    ['Medium', summary.medium ?? data.tickers.filter((t) => t.rating === 'medium').length, '2-8 weeks', 'kpi--med'],
    ['Watch', summary.watch ?? data.tickers.filter((t) => t.rating === 'watch').length, '> 8 weeks', 'kpi--watch'],
    ['Resolved', summary.resolved ?? (data.resolved || []).length, 'since prior run', 'kpi--resolved']
  ];

  const downloadIcs = (ticker) => {
    const blob = new Blob([buildIcs(ticker)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker.ticker}-PDUFA-${ticker.pdufaDate}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <Header data={data} theme={theme} setTheme={setTheme} />
      <main id="main">
        <section className="hero">
          <div className="shell">
            <div className="hero__eyebrow">{data.heroEyebrow || '-'}</div>
            <h1 className="hero__title">{data.heroTitle || 'US-listed small & mid-cap biotechs with PDUFA dates in the next 90 days'}</h1>
            <p className="hero__lede">{data.heroLede || data.calendarNote || 'Catalyst calendar with run-over-run deltas. Big pharma sponsors excluded.'}</p>
            <div className="kpi-grid">{kpis.map(([label, value, sub, cls]) => <div key={label} className={`kpi ${cls}`}><div className="kpi__label">{label}</div><div className="kpi__value">{value}</div><div className="kpi__sub">{sub}</div></div>)}</div>
            <Timeline tickers={data.tickers || []} today={today} />
            <nav className="filter-nav" aria-label="Jump to section">
              <a href="#resolved" className="filter-nav__btn">Resolved</a>
              <a href="#this-week" className="filter-nav__btn">This week [HIGH]</a>
              <a href="#upcoming" className="filter-nav__btn">Upcoming [MED]</a>
              <a href="#watch" className="filter-nav__btn">Watch list</a>
              <a href="#cards" className="filter-nav__btn">Full cards</a>
            </nav>
          </div>
        </section>
        <Toolbar ui={ui} setUi={setUi} />
        <Resolved items={data.resolved || []} />
        <SectionTable id="this-week" title="This week - high priority" desc="PDUFA action dates within the next 7 days." count={high.length} dot="section__dot--high" items={high} today={today} prevByTicker={prevByTicker} />
        <SectionTable id="upcoming" title="Upcoming - medium priority" desc="PDUFA action dates 2-8 weeks out." count={medium.length} dot="section__dot--med" items={medium} today={today} prevByTicker={prevByTicker} />
        <WatchTable items={watch} today={today} />
        <Cards items={cards} today={today} prevByTicker={prevByTicker} isStarred={isStarred} isHidden={isHidden} toggleStar={toggleStar} toggleHide={toggleHide} downloadIcs={downloadIcs} />
      </main>
      <Footer runId={data.runId || data.lastUpdated} />
    </>
  );
}

function Header({ data, theme, setTheme }) {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <a href="#" className="brand" aria-label="PDUFA Watchlist home">
          <svg className="brand__logo" width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 4 Q16 12 24 4" /><path d="M8 16 Q16 24 24 16" /><path d="M8 28 Q16 20 24 28" /><line x1="10" y1="8" x2="22" y2="20" /><line x1="22" y1="8" x2="10" y2="20" />
          </svg>
          <div><div className="brand__name">PDUFA Watchlist</div><div className="brand__sub">Biotech catalysts - 90-day window</div></div>
        </a>
        <div className="header-meta">
          <div className="header-meta__time">Updated {fmtDate(data.lastUpdated)} - {data.timezone || ''}</div>
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
          </button>
        </div>
      </div>
    </header>
  );
}

function Toolbar({ ui, setUi }) {
  const filters = [['all', 'All'], ['starred', 'Starred'], ['nme', 'NME'], ['btd', 'BTD'], ['priority', 'Priority'], ['fasttrack', 'Fast Track'], ['adcom', 'AdCom'], ['smallcap', '< $500M'], ['hidden', 'Hidden']];
  return (
    <section className="toolbar-section" aria-label="Filter, sort, search">
      <div className="shell"><div className="toolbar">
        <div className="toolbar__group" role="group" aria-label="Filter"><span className="toolbar__label">Filter</span>{filters.map(([key, label]) => <button key={key} type="button" className={`chip ${ui.filter === key ? 'is-active' : ''}`} onClick={() => setUi((s) => ({ ...s, filter: key }))}>{label}</button>)}</div>
        <div className="toolbar__group"><span className="toolbar__label">Sort</span><select className="select" value={ui.sort} onChange={(e) => setUi((s) => ({ ...s, sort: e.target.value }))} aria-label="Sort by"><option value="pdufa-asc">PDUFA date up</option><option value="pdufa-desc">PDUFA date down</option><option value="si-desc">Short interest down</option><option value="mc-desc">Market cap down</option><option value="mc-asc">Market cap up</option><option value="odds-desc">Approval odds down</option></select></div>
        <div className="toolbar__group toolbar__group--search"><input className="search" id="search-input" type="search" placeholder="Search ticker, drug, indication..." aria-label="Search" value={ui.search} onChange={(e) => setUi((s) => ({ ...s, search: e.target.value.trim() }))} /></div>
      </div></div>
    </section>
  );
}

function Resolved({ items }) {
  return <section className="section" id="resolved"><div className="shell"><header className="section__header"><span className="section__dot section__dot--resolved" aria-hidden="true" /><h2 className="section__title">Resolved catalysts</h2><span className="section__count">{items.length}</span><p className="section__desc">Decisions adjudicated since the prior watchlist run.</p></header><div className="resolved-grid">{items.map((r) => <ResolvedCard key={`${r.ticker}-${r.resolvedDate || r.pdufaDate}`} r={r} />)}</div></div></section>;
}

function ResolvedCard({ r }) {
  const approved = String(r.outcome || '').toLowerCase() === 'approved';
  const src = r.source || {};
  const srcUrl = typeof src === 'string' ? src : src.url || '';
  const srcName = typeof src === 'string' ? 'Source' : src.name || hostnameFromUrl(srcUrl) || 'Source';
  return <article className={`resolved-card ${approved ? 'resolved-card--approved' : 'resolved-card--crl'}`}><div className="resolved-card__head"><span className="resolved-card__ticker">{r.ticker}</span><Badge className={approved ? 'pill--approved' : 'pill--crl'}>{approved ? 'Approved' : 'CRL'}</Badge><span className="resolved-card__date">{fmtDate(r.resolvedDate || r.date || r.pdufaDate)}</span></div><div><span className="resolved-card__drug">{r.drug}</span><span className="resolved-card__indication">{r.indication}</span></div><p className="resolved-card__detail">{r.outcomeNote || r.detail || ''}</p>{srcUrl && <a className="resolved-card__source" href={srcUrl} target="_blank" rel="noopener noreferrer">{srcName} -&gt;</a>}</article>;
}

function SectionTable({ id, title, desc, count, dot, items, today, prevByTicker }) {
  return <section className="section" id={id}><div className="shell"><header className="section__header"><span className={`section__dot ${dot}`} aria-hidden="true" /><h2 className="section__title">{title}</h2><span className="section__count">{count}</span><p className="section__desc">{desc}</p></header><div className="table-wrap"><table className="table"><thead><tr><th>Ticker</th><th>Drug - Indication</th><th>PDUFA</th><th>Delta</th><th>NME</th><th>AdCom</th><th>Insider</th><th>X - Reddit - Trends</th><th>Approval odds</th><th style={{ textAlign: 'right' }}>Price - Cap</th></tr></thead><tbody>{items.map((t) => <TickerRow key={t.ticker} t={t} today={today} prev={prevByTicker[t.ticker]} />)}</tbody></table></div></div></section>;
}

function TickerRow({ t, today, prev }) {
  const days = daysUntil(t.pdufaDate, today);
  const xs = t.xSentiment || {}, rs = t.redditSentiment || {}, gt = t.googleTrends || {}, ins = t.insider || {};
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  return <tr data-ticker={safeId} onClick={() => document.getElementById(`card-${safeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><td data-label="Ticker"><span className="ticker-cell">{t.ticker}<span className="ticker-cell__company">{t.company}</span></span></td><td className="drug-cell" data-label="Drug"><span className="drug-cell__name">{t.drug}</span><span className="drug-cell__indication">{t.indication}</span></td><td className="date-cell" data-label="PDUFA">{fmtDate(t.pdufaDate)}<span className={`date-cell__days ${days <= 7 ? 'date-cell__days--soon' : ''}`}>{days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}</span></td><td data-label="Run Delta"><DiffBadges curr={t} prev={prev} /></td><td data-label="NME"><Badge className={isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}>{isYes(t.nme) ? 'NME' : 'non-NME'}</Badge></td><td data-label="AdCom"><Badge className={isYes(t.adcom) ? 'pill--medium' : 'pill--neutral'}>{t.adcom || 'N/A'}</Badge></td><td data-label="Insider"><Badge className={insiderPillClass(ins.signal)} title={ins.summary || ''}>{ins.signal || 'N/A'}</Badge><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: 2 }}>{ins.buys != null ? `${ins.buys}b/${ins.sells}s - ${ins.netValue || '$0'}` : ''}</span></td><td data-label="Sentiment"><Badge className={`${sentimentPillClass(xs.overall)} pill--sm`}>{xs.overall || 'N/A'}</Badge> <Badge className={`${sentimentPillClass(rs.overall)} pill--sm`}>{rs.overall || 'N/A'}</Badge> <Badge className={`${trendsPillClass(gt.signal)} pill--sm`}>{gt.signal || 'N/A'}</Badge></td><td data-label="Approval odds"><OddsGauge odds={t.approvalOdds} /></td><td className="price-cell" data-label="Price - Cap">{t.price || '-'}<span className="price-cell__cap">{t.marketCap || ''}</span></td></tr>;
}

function WatchTable({ items, today }) {
  return <section className="section" id="watch"><div className="shell"><header className="section__header"><span className="section__dot section__dot--watch" aria-hidden="true" /><h2 className="section__title">Watch list</h2><span className="section__count">{items.length}</span><p className="section__desc">PDUFA action dates more than 8 weeks out - compact view.</p></header><div className="table-wrap"><table className="table table--compact"><thead><tr><th>Ticker</th><th>Drug</th><th>PDUFA</th><th>Indication</th><th>Key flag</th></tr></thead><tbody>{items.map((t) => <WatchRow key={t.ticker} t={t} today={today} />)}</tbody></table></div></div></section>;
}

function WatchRow({ t }) {
  const flag = isYes(t.nme) ? 'NME' : isYes(t.btd) ? 'BTD' : isYes(t.adcom) ? 'AdCom' : isYes(t.priorityReview) ? 'Priority' : isYes(t.fastTrack) ? 'Fast Track' : '-';
  return <tr data-ticker={t.ticker.replace(/[^A-Z0-9]/gi, '_')} onClick={() => document.getElementById(`card-${t.ticker.replace(/[^A-Z0-9]/gi, '_')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><td data-label="Ticker"><span className="ticker-cell">{t.ticker}</span></td><td data-label="Drug">{t.drug}</td><td className="date-cell" data-label="PDUFA">{fmtDate(t.pdufaDate)}</td><td data-label="Indication">{t.indication}</td><td data-label="Key flag"><Badge className="pill--neutral">{flag}</Badge></td></tr>;
}

function Cards({ items, today, prevByTicker, isStarred, isHidden, toggleStar, toggleHide, downloadIcs }) {
  return <section className="section" id="cards"><div className="shell"><header className="section__header"><span className="section__dot" aria-hidden="true" style={{ background: 'var(--color-primary)' }} /><h2 className="section__title">Full ticker cards</h2><span className="section__count">{items.length}</span><p className="section__desc">Drug profile, market data, and bull/bear/risk thesis for every tracked ticker.</p></header><div className="cards-grid">{items.map((t) => <TickerCard key={t.ticker} t={t} today={today} prev={prevByTicker[t.ticker]} isStarred={isStarred} isHidden={isHidden} toggleStar={toggleStar} toggleHide={toggleHide} downloadIcs={downloadIcs} />)}</div>{!items.length && <div className="empty-state">No tickers match the current filter / search.</div>}</div></section>;
}

function TickerCard({ t, today, prev, isStarred, isHidden, toggleStar, toggleHide, downloadIcs }) {
  const safeId = t.ticker.replace(/[^A-Z0-9]/gi, '_');
  const days = daysUntil(t.pdufaDate, today);
  const xs = t.xSentiment || {}, rs = t.redditSentiment || {}, ins = t.insider || {}, gt = t.googleTrends || {};
  const ratingCls = t.rating === 'high' ? 'pill--high' : t.rating === 'medium' ? 'pill--medium' : 'pill--watch';
  const asOf = (field) => t[`${field}AsOf`] ? <span className="metric__as-of">as of {t[`${field}AsOf`]}</span> : null;
  return <article className={`ticker-card ${isStarred(t.ticker) ? 'is-starred' : ''} ${isHidden(t.ticker) ? 'is-hidden' : ''}`} id={`card-${safeId}`}><header className="ticker-card__head"><div className="ticker-card__id"><div className="ticker-card__ticker">{t.ticker}</div><div className="ticker-card__company">{t.company}</div></div><div className="ticker-card__price"><div className="ticker-card__price-val">{t.price || '-'}</div><span className="ticker-card__cap">{t.marketCap || ''}</span><div className="ticker-card__actions"><button type="button" className={`icon-btn ${isStarred(t.ticker) ? 'is-active' : ''}`} onClick={() => toggleStar(t.ticker)} title="Star">★</button><button type="button" className={`icon-btn ${isHidden(t.ticker) ? 'is-active' : ''}`} onClick={() => toggleHide(t.ticker)} title="Hide">⊘</button><button type="button" className="icon-btn" onClick={() => downloadIcs(t)} title="Download .ics">Cal</button><button type="button" className="icon-btn" onClick={(e) => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${t.ticker}`); e.currentTarget.textContent = 'OK'; setTimeout(() => { e.currentTarget.textContent = '#'; }, 900); }} title="Copy link">#</button></div></div></header><div className="ticker-card__body"><div className="ticker-card__rating-row"><Badge className={ratingCls}>{RATING_LABEL[t.rating] || 'WATCH'}</Badge><Badge className={isYes(t.nme) ? 'pill--medium' : 'pill--neutral'}>{isYes(t.nme) ? 'NME' : 'non-NME'}</Badge>{isYes(t.btd) && <Badge className="pill--medium">BTD</Badge>}{isYes(t.priorityReview) && <Badge className="pill--medium">Priority</Badge>}{isYes(t.fastTrack) && <Badge className="pill--medium">Fast Track</Badge>}<span className="ticker-card__pdufa">{fmtDate(t.pdufaDate)}</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: days <= 7 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}</span><DiffBadges curr={t} prev={prev} /></div>{Array.isArray(t.pdufaDatesExtra) && t.pdufaDatesExtra.length > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>+ {t.pdufaDatesExtra.map(fmtDate).join(' - ')}</div>}<h3 className="ticker-card__drug-name" style={{ marginTop: 'var(--space-3)' }}>{t.drug}</h3><p className="ticker-card__indication">{t.indication}</p><PriceTarget t={t} /><div className="metrics-grid"><div className="metric"><div className="metric__label">Approval odds</div><div className="metric__value"><OddsGauge odds={t.approvalOdds} /></div></div><div className="metric"><div className="metric__label">Short int.</div><div className="metric__value">{t.shortInterest || '-'}</div>{asOf('shortInterest')}</div><div className="metric"><div className="metric__label">Implied vol.</div><div className="metric__value">{t.iv || '-'}</div>{asOf('iv')}</div><div className="metric"><div className="metric__label">Analyst PT</div><div className="metric__value">{t.analystPT || '-'}</div>{asOf('analystPT')}</div></div><Momentum pc={t.priceChange} /><Runway cr={t.cashRunway} /><TrackRecord tr={t.sponsorTrackRecord} /><p className="profile-text">{safeProfile(t.drugProfile || '')}</p><div className="sentiment-block"><SentimentLine label="X Sentiment" cls={sentimentPillClass(xs.overall)} value={xs.overall} volume={xs.volume} summary={xs.summary} /><SentimentLine label="Reddit Sentiment" cls={sentimentPillClass(rs.overall)} value={rs.overall} volume={rs.volume} summary={rs.summary} /><SentimentLine label="Insider" cls={insiderPillClass(ins.signal)} value={ins.signal} volume={ins.buys != null ? `${ins.buys}b / ${ins.sells}s - net ${ins.netValue || '$0'}` : ''} summary={ins.summary} /><SentimentLine label="Google Trends" cls={trendsPillClass(gt.signal)} value={gt.signal} volume={`${gt.volume || ''}${gt.peakDate ? ` - peak ${gt.peakDate}` : ''}`} summary={gt.summary} /></div><div className="thesis"><details className="thesis__bull"><summary>Bull case</summary><div className="thesis__body"><BulletList items={t.bull} /></div></details><details className="thesis__bear"><summary>Bear case</summary><div className="thesis__body"><BulletList items={t.bear} /></div></details><details className="thesis__risk"><summary>Key risk</summary><div className="thesis__body"><BulletList items={t.risk} /></div></details></div><div className="sources">{(t.sources || []).map((s, i) => <a key={`${s.url}-${i}`} className="source-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.name} -&gt;</a>)}</div></div></article>;
}

function SentimentLine({ label, cls, value, volume, summary }) {
  return <p className="sentiment-line"><span className="sentiment-label">{label}:</span><Badge className={`${cls} pill--sm`}>{value || 'N/A'}</Badge><span className="sentiment-volume">{volume || ''}</span><span className="sentiment-summary">- {summary || ''}</span></p>;
}

function Footer({ runId }) {
  return <footer className="site-footer"><div className="shell"><p>Catalyst classification: HIGH = PDUFA &lt;=7 days - MEDIUM = 2-8 weeks - WATCH = &gt;8 weeks. Research scope capped at 90 days from dashboard date.</p><p>Prices, market caps, and analyst targets reflect data available at compile time and may have changed. Not investment advice.</p><p style={{ marginTop: 'var(--space-3)' }}>Auto-rebuilt Mon / Wed / Fri 06:00 SGT - <span id="run-tag">run {runId || '-'}</span></p></div></footer>;
}
