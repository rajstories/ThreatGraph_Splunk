import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import cytoscape from 'cytoscape';

const API = 'http://localhost:3001';

const DEMO_INCIDENT = {
  execution_id: "exec-1781382327907",
  timestamp: "2026-06-14T02:47:00.000Z",
  severity: "CRITICAL",
  total_alerts: 847,
  offenderIPs: ["203.0.113.13","203.0.113.12","203.0.113.15","203.0.113.10","203.0.113.11","203.0.113.14"],
  targeted_accounts: ["arjun.sharma","priya.patel","vikram.mehta","sunita.rao","amit.gupta","deepa.nair","rahul.joshi","kavya.reddy","sanjay.iyer","anita.kumar","rohit.singh","meera.pillai"],
  campaign_match: true,
  campaign: {
    id: "CAMP-2024-001",
    name: "Phishing wave — June 11",
    date: "2024-06-11",
    description: "Mass phishing campaign targeting bank customers",
    confirmed: true
  },
  verdict: "CRITICAL: 6 IPs from known campaign \"Phishing wave — June 11\" now credential-stuffing. 12 accounts at risk.",
  actions_taken: [
    { type: "ACCOUNT_LOCKED", target: "arjun.sharma", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "priya.patel", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "vikram.mehta", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "sunita.rao", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "amit.gupta", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "deepa.nair", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "rahul.joshi", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "kavya.reddy", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "sanjay.iyer", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "anita.kumar", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "rohit.singh", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "ACCOUNT_LOCKED", target: "meera.pillai", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "TOKENS_REVOKED", target: "all_affected_sessions", agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.13", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.12", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.15", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.10", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.11", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.14", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "RATE_LIMIT_APPLIED", target: "auth-service", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "MONITORING_ESCALATED", target: "auth-service", agent: "infra", timestamp: "2026-06-14T02:47:05.000Z" },
    { type: "LOG_VERBOSITY_INCREASED", target: "all_services", agent: "infra", timestamp: "2026-06-14T02:47:05.000Z" }
  ],
  remediation_complete: true,
  approved: true,
  approved_by: "Arjun — SOC Analyst",
  approved_at: "2026-06-14T02:49:23.000Z",
  dispatched_at: "2026-06-14T02:47:02.000Z"
};

export default function App() {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const cyContainer = useRef(null);
  const cy = useRef(null);

  useEffect(() => {
    // Try live API first, fall back to demo data
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/incident`, { timeout: 2000 });
        if (res.data) {
          setIncident(res.data);
          setApproved(res.data.approved || false);
        }
      } catch (e) {
        // API not reachable — show demo data
        setIncident(DEMO_INCIDENT);
        setApproved(true);
      }
    }, 3000);

    // Show demo data immediately on load
    setIncident(DEMO_INCIDENT);
    setApproved(true);

    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!incident || !cyContainer.current) return;
    if (cy.current) cy.current.destroy();

    const elements = [
      { data: { id: 'campaign', label: incident.campaign?.name || 'Attack Campaign', type: 'campaign' } },
      ...(incident.offenderIPs || []).flatMap((ip) => [
        { data: { id: ip, label: ip, type: 'ip' } },
        { data: { source: ip, target: 'campaign', id: `e-${ip}` } },
      ]),
    ];

    const layout = {
      name: 'concentric',
      minNodeSpacing: 50,
      padding: 40,
      avoidOverlap: true,
      equidistant: true,
      animate: false,
      concentric: (node) => (node.data('type') === 'campaign' ? 2 : 1),
      levelWidth: () => 1,
      spacingFactor: 1.25,
    };

    cy.current = cytoscape({
      container: cyContainer.current,
      elements,
      style: [
        {
          selector: 'node[type="campaign"]',
          style: {
            'background-color': '#F59E0B',
            label: 'data(label)',
            color: '#111827',
            'font-family': 'JetBrains Mono, Courier New, monospace',
            'font-size': '8px',
            'font-weight': 700,
            'text-valign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '78px',
            width: 92,
            height: 92,
            'border-width': 4,
            'border-color': '#FDE68A',
          },
        },
        {
          selector: 'node[type="ip"]',
          style: {
            'background-color': '#EF4444',
            label: 'data(label)',
            color: '#FFFFFF',
            'font-family': 'JetBrains Mono, Courier New, monospace',
            'font-size': '8px',
            'font-weight': 700,
            'text-valign': 'center',
            width: 68,
            height: 68,
            'border-width': 2,
            'border-color': '#FCA5A5',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#CBD5E1',
            'line-style': 'dashed',
            'line-dash-pattern': [7, 5],
            'target-arrow-color': '#CBD5E1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.78,
          },
        },
      ],
      layout,
    });

    const centerGraph = () => {
      if (!cy.current) return;
      cy.current.resize();
      setTimeout(() => {
        cy.current.fit(cy.current.elements(), 50);
        cy.current.center(cy.current.elements());
      }, 10);
    };

    cy.current.on('layoutstop', centerGraph);
    cy.current.ready(() => {
      setTimeout(centerGraph, 50);
      setTimeout(centerGraph, 200);
      setTimeout(centerGraph, 400);
    });
  }, [incident]);

  const runDetection = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/run-detection`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    await axios.post(`${API}/api/approve`);
    setApproved(true);
  };

  const sevColor = { CRITICAL: '#DC2626', HIGH: '#D97706', MEDIUM: '#2563EB' };
  const statCards = [
    { label: 'Total Alerts', value: incident?.total_alerts ?? '--', accent: '#DC2626', meta: 'Splunk signals' },
    { label: 'Severity', value: incident?.severity ?? 'STANDBY', accent: sevColor[incident?.severity] || '#2563EB', meta: 'Risk posture', critical: incident?.severity === 'CRITICAL' },
    { label: 'Locked Accounts', value: incident?.targeted_accounts?.length ?? '--', accent: '#D97706', meta: 'Identity containment' },
    { label: 'Blocked IPs', value: incident?.offenderIPs?.length ?? '--', accent: '#7C3AED', meta: 'Hostile sources' },
  ];

  const actionTone = (type = '') => {
    if (type.includes('LOCKED') || type.includes('REVOKED')) return { color: '#DC2626', label: 'LOCKED' };
    if (type.includes('BLOCKED') || type.includes('RATE')) return { color: '#7C3AED', label: 'BLOCKED' };
    if (type.includes('ESCALATED') || type.includes('LOG')) return { color: '#D97706', label: 'ESCALATED' };
    return { color: '#16A34A', label: 'RESOLVED' };
  };

  return (
    <div className="tp-shell">
      <style>{`
        :root {
          --bg: #F8F9FC;
          --card: #FFFFFF;
          --border: #E5E7EB;
          --text: #111827;
          --body: #374151;
          --muted: #6B7280;
          --label: #9CA3AF;
          --blue: #2563EB;
          --red: #DC2626;
          --amber: #D97706;
          --green: #16A34A;
          --purple: #7C3AED;
          --nav: #1E293B;
          --mono: 'JetBrains Mono', 'Courier New', monospace;
          --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--body); }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.82); }
        }

        .tp-shell {
          min-height: 100vh;
          width: 100%;
          color: var(--body);
          font-family: var(--sans);
          background: var(--bg);
          overflow-x: hidden;
        }

        .tp-content {
          width: 100%;
          padding: 24px;
          display: grid;
          gap: 20px;
        }

        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .top-bar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto minmax(180px, 1fr);
          gap: 20px;
          align-items: center;
          width: 100%;
          padding: 16px 24px;
          background: var(--nav);
          color: #FFFFFF;
        }

        .brand-row,
        .status-row,
        .inline-center {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }

        .brand-row { gap: 12px; }
        .status-row { justify-content: center; gap: 10px; }
        .inline-center { gap: 8px; }

        .shield {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px;
          background: rgba(255,255,255,0.08);
          font-size: 22px;
        }

        .brand-title {
          margin: 0;
          color: #FFFFFF;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 0;
          font-weight: 700;
        }

        .command-label {
          margin-top: 4px;
          color: #CBD5E1;
          font-size: 12px;
          letter-spacing: 0;
        }

        .status-badge,
        .count-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 26px;
          padding: 5px 10px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 999px;
          color: #E5E7EB;
          background: rgba(255,255,255,0.08);
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .count-badge {
          color: var(--muted);
          background: #F3F4F6;
          border-color: #E5E7EB;
        }

        .status-badge.live {
          color: #DCFCE7;
          border-color: rgba(22,163,74,0.35);
          background: rgba(22,163,74,0.18);
        }

        .live-dot, .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--green);
          flex: 0 0 auto;
        }

        .live-dot { animation: live-pulse 1.8s ease-in-out infinite; }
        .status-dot.blue { background: var(--blue); }
        .status-dot.purple { background: var(--purple); }

        .run-button, .approve-button {
          border: 0;
          cursor: pointer;
          font-weight: 700;
          letter-spacing: 0;
          transition: background 160ms ease, opacity 160ms ease, transform 160ms ease;
        }

        .run-button {
          justify-self: end;
          min-width: 170px;
          padding: 12px 18px;
          border-radius: 8px;
          background: var(--blue);
          color: #FFFFFF;
          font-size: 14px;
        }

        .run-button:hover, .approve-button:hover { transform: translateY(-1px); }
        .run-button:disabled { cursor: not-allowed; opacity: 0.56; transform: none; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }

        .stat-card {
          position: relative;
          padding: 20px 20px 20px 24px;
          min-height: 132px;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--accent);
        }

        .stat-label,
        .panel-kicker,
        .action-kicker,
        .metric-label {
          color: var(--label);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .stat-value {
          margin-top: 16px;
          color: var(--accent);
          font-size: clamp(30px, 3vw, 42px);
          line-height: 1;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .stat-meta {
          margin-top: 12px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 58fr 42fr;
          gap: 20px;
          align-items: stretch;
        }

        .panel {
          padding: 24px;
          min-height: 560px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .panel-title {
          margin: 8px 0 0;
          color: var(--text);
          font-size: 20px;
          line-height: 1.25;
          font-weight: 700;
          text-transform: uppercase;
        }

        .title-line {
          width: 44px;
          height: 3px;
          margin-top: 10px;
          border-radius: 999px;
          background: var(--blue);
        }

        .mono {
          font-family: var(--mono);
          color: inherit;
        }

        .severity-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .severity-badge {
          display: inline-flex;
          align-items: center;
          padding: 10px 16px;
          border-radius: 999px;
          background: var(--red);
          color: #FFFFFF;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 700;
        }

        .execution-id {
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .campaign-banner {
          margin-bottom: 20px;
          padding: 16px;
          border: 1px solid #FDE68A;
          border-left: 4px solid var(--amber);
          border-radius: 12px;
          background: #FFFBEB;
        }

        .campaign-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--amber);
          font-size: 14px;
          font-weight: 700;
        }

        .campaign-copy {
          margin-top: 8px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .campaign-name {
          color: var(--text);
          font-weight: 700;
        }

        .verdict-panel {
          margin-bottom: 20px;
          padding: 16px;
          border: 1px solid #BFDBFE;
          border-left: 4px solid var(--blue);
          border-radius: 12px;
          background: #EFF6FF;
        }

        .terminal-text {
          margin-top: 8px;
          color: #1E293B;
          font-size: 14px;
          line-height: 1.7;
        }

        .accounts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .account-pill {
          padding: 12px 14px;
          border: 1px solid rgba(255, 59, 92, 0.25);
          border-radius: 6px;
          background: linear-gradient(135deg, rgba(255, 59, 92, 0.08) 0%, rgba(255, 59, 92, 0.03) 100%);
          color: #FF3B5C;
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .account-pill:hover {
          background: linear-gradient(135deg, rgba(255, 59, 92, 0.15) 0%, rgba(255, 59, 92, 0.08) 100%);
          border-color: rgba(255, 59, 92, 0.4);
          box-shadow: 0 0 12px rgba(255, 59, 92, 0.15);
        }

        .incident-footer {
          margin-top: auto;
          padding-top: 20px;
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
        }

        .graph-wrap {
          position: relative;
          flex: 0 0 60%;
          min-height: 360px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #FFFFFF;
          overflow: hidden;
        }

        .graph-canvas {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          min-height: 360px;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 16px;
          color: var(--muted);
          font-size: 12px;
        }

        .actions-panel {
          padding: 24px;
        }

        .actions-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .action-card {
          min-height: 112px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: #F3F4F6;
        }

        .action-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          color: var(--tone);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .action-type {
          margin-top: 12px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .action-target {
          margin-top: 10px;
          display: inline-block;
          max-width: 100%;
          color: var(--text);
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .approve-wrap {
          display: block;
        }

        .approve-button {
          width: 100%;
          min-height: 68px;
          border-radius: 8px;
          background: var(--green);
          color: #FFFFFF;
          font-size: 17px;
        }

        .approved-card {
          padding: 24px;
          text-align: center;
          border-color: #86EFAC;
          background: #F0FDF4;
        }

        .approved-title {
          color: #166534;
          font-size: 18px;
          font-weight: 700;
        }

        .approved-time {
          margin-top: 8px;
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
        }

        .empty-state {
          min-height: calc(100vh - 72px);
          display: grid;
          place-items: center;
          text-align: center;
          padding: 24px;
        }

        .empty-title {
          color: var(--text);
          font-size: 24px;
          font-weight: 700;
        }

        .empty-copy {
          color: var(--muted);
          font-size: 14px;
          margin-top: 8px;
        }

        @media (max-width: 1100px) {
          .top-bar {
            grid-template-columns: 1fr;
          }

          .status-row {
            justify-content: flex-start;
          }

          .run-button { width: 100%; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .main-grid { grid-template-columns: 1fr; }
          .actions-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 620px) {
          .tp-content { padding: 16px; }
          .top-bar { padding: 16px; }
          .stats-grid { grid-template-columns: 1fr; }
          .panel,
          .actions-panel { padding: 18px; }
          .panel-header { display: block; }
          .actions-strip { grid-template-columns: 1fr; }
          .graph-wrap { min-height: 360px; }
          .brand-title { font-size: 20px; }
        }
      `}</style>

      <header className="top-bar">
        <div className="brand-row">
          <div className="shield">🛡️</div>
          <div>
            <h1 className="brand-title">ThreatGraph</h1>
            <div className="command-label">Bank SOC Command Center</div>
          </div>
        </div>
        <div className="status-row">
          <span className="status-badge live"><span className="live-dot" />LIVE</span>
          <span className="status-badge"><span className="status-dot blue" />Splunk MCP Connected</span>
          <span className="status-badge"><span className="status-dot purple" />Neo4j Active</span>
          {loading && <span className="status-badge"><span className="status-dot" />Analyzing</span>}
        </div>
        <button className="run-button" onClick={runDetection} disabled={loading}>
          {loading ? 'Running Detection' : '▶ Run Detection'}
        </button>
      </header>

      {!incident ? (
        <section className="empty-state">
          <div className="card panel">
            <div className="empty-title">Awaiting Threat Data</div>
            <div className="empty-copy">Commander Agent standing by for Splunk signals and campaign graph correlation.</div>
          </div>
        </section>
      ) : (
        <div className="tp-content">
          <section className="stats-grid">
            {statCards.map((s) => (
              <article className={`card stat-card ${s.critical ? 'critical' : ''}`} key={s.label} style={{ '--accent': s.accent }}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-meta">{s.meta}</div>
              </article>
            ))}
          </section>

          <main className="main-grid">
            <section className="card panel">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Incident Report</div>
                  <div className="title-line" />
                </div>
              </div>

              <div className="severity-row">
                <span className="severity-badge">{incident.severity}</span>
                <span className="execution-id">{incident.execution_id}</span>
              </div>

              {incident.campaign_match && (
                <div className="campaign-banner">
                  <div className="campaign-title">⚠ Campaign Graph Match</div>
                  <div className="campaign-copy">
                    <span className="campaign-name">{incident.campaign?.name}</span>
                  </div>
                  <div className="campaign-copy">{incident.campaign?.description}</div>
                </div>
              )}

              <div className="verdict-panel">
                <div className="panel-kicker" style={{ color: '#2563EB' }}>AI Verdict</div>
                <div className="terminal-text">{incident.verdict}</div>
              </div>

              <div>
                <div className="metric-label">Targeted Accounts ({incident.targeted_accounts?.length})</div>
                <div className="accounts-grid">
                  {incident.targeted_accounts?.map((acc) => (
                    <span className="account-pill" key={acc}>🔒 {acc}</span>
                  ))}
                </div>
              </div>

              <div className="incident-footer">
                {new Date(incident.timestamp).toLocaleString()} / Remediated in ~90s
              </div>
            </section>

            <section className="card panel">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Knowledge Graph</div>
                  <div className="title-line" />
                </div>
              </div>
              <div className="graph-wrap">
                <div ref={cyContainer} className="graph-canvas" />
              </div>
              <div className="legend">
                <span><span style={{ color: '#EF4444' }}>●</span> Attack IP ({incident.offenderIPs?.length})</span>
                <span><span style={{ color: '#F59E0B' }}>●</span> Known Campaign</span>
                <span><span style={{ color: '#CBD5E1' }}>- -</span> Correlation Edge</span>
              </div>
            </section>
          </main>

          <section className="card actions-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Automated Response Chain</div>
                <div className="title-line" />
              </div>
              <span className="count-badge">{incident.actions_taken?.length} ACTIONS</span>
            </div>
            <div className="actions-strip">
              {incident.actions_taken?.map((a, i) => {
                const tone = actionTone(a.type);
                return (
                  <article className="action-card" key={i} style={{ '--tone': tone.color }}>
                    <div className="action-head">
                      <span>{tone.label}</span>
                      <span>#{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="action-type">{a.type.replace(/_/g, ' ')}</div>
                    <div className="action-target">{a.target}</div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="approve-wrap">
            {approved ? (
              <div className="card approved-card">
                <div className="approved-title">✅ Approved by {incident.approved_by}</div>
                <div className="approved-time">{incident.approved_at && new Date(incident.approved_at).toLocaleString()}</div>
              </div>
            ) : (
              <button className="approve-button" onClick={approve}>
                ✅ APPROVE RESPONSE — ARJUN (SOC ANALYST)
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
