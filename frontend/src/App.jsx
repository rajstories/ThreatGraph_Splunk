import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import cytoscape from 'cytoscape';

const API = 'http://localhost:3001';

export default function App() {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const cyContainer = useRef(null);
  const cy = useRef(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/incident`);
        if (res.data) {
          setIncident(res.data);
          setApproved(res.data.approved || false);
        }
      } catch (e) {}
    }, 2000);
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

    const graphBox = cyContainer.current.getBoundingClientRect();
    const layout = {
      name: 'concentric',
      minNodeSpacing: 36,
      padding: 76,
      avoidOverlap: true,
      equidistant: true,
      animate: false,
      boundingBox: {
        x1: 0,
        y1: 0,
        w: graphBox.width,
        h: graphBox.height,
      },
      concentric: (node) => (node.data('type') === 'campaign' ? 2 : 1),
      levelWidth: () => 1,
    };

    cy.current = cytoscape({
      container: cyContainer.current,
      elements,
      style: [
        {
          selector: 'node[type="campaign"]',
          style: {
            'background-color': '#FFB800',
            label: 'data(label)',
            color: '#060B18',
            'font-family': 'JetBrains Mono, Courier New, monospace',
            'font-size': '8px',
            'font-weight': 700,
            'text-valign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '78px',
            width: 92,
            height: 92,
            'border-width': 4,
            'border-color': '#FFE7A0',
            'underlay-color': '#FFB800',
            'underlay-opacity': 0.26,
            'underlay-padding': 12,
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'node[type="ip"]',
          style: {
            'background-color': '#FF3B5C',
            label: 'data(label)',
            color: '#F0F4FF',
            'font-family': 'JetBrains Mono, Courier New, monospace',
            'font-size': '8px',
            'font-weight': 700,
            'text-valign': 'center',
            width: 68,
            height: 68,
            'border-width': 2,
            'border-color': '#FF9AAD',
            'underlay-color': '#FF3B5C',
            'underlay-opacity': 0.28,
            'underlay-padding': 10,
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#00D4FF',
            'line-style': 'dashed',
            'line-dash-pattern': [7, 5],
            'target-arrow-color': '#00D4FF',
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
      cy.current.fit(cy.current.elements(), 80);

      const box = cy.current.elements().renderedBoundingBox({ includeLabels: false, includeOverlays: true });
      const dx = cy.current.width() / 2 - (box.x1 + box.x2) / 2;
      const dy = cy.current.height() / 2 - (box.y1 + box.y2) / 2;
      cy.current.panBy({ x: dx, y: dy });
    };

    cy.current.on('layoutstop', centerGraph);
    cy.current.ready(() => {
      centerGraph();
      setTimeout(centerGraph, 80);
      setTimeout(centerGraph, 250);
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

  const sevColor = { CRITICAL: '#FF3B5C', HIGH: '#FFB800', MEDIUM: '#00D4FF' };
  const statCards = [
    { label: 'Total Alerts', value: incident?.total_alerts ?? '--', accent: '#FF3B5C', meta: 'SPLUNK SIGNALS' },
    { label: 'Severity', value: incident?.severity ?? 'STANDBY', accent: sevColor[incident?.severity] || '#00D4FF', meta: 'RISK POSTURE', critical: incident?.severity === 'CRITICAL' },
    { label: 'Locked', value: incident?.targeted_accounts?.length ?? '--', accent: '#FFB800', meta: 'ACCOUNTS' },
    { label: 'Blocked', value: incident?.offenderIPs?.length ?? '--', accent: '#8B5CF6', meta: 'HOSTILE IPS' },
  ];

  const actionTone = (type = '') => {
    if (type.includes('LOCKED') || type.includes('REVOKED')) return { icon: '🔴', color: '#FF3B5C', label: 'CONTAINED' };
    if (type.includes('BLOCKED') || type.includes('RATE')) return { icon: '🟣', color: '#8B5CF6', label: 'BLOCKED' };
    if (type.includes('ESCALATED') || type.includes('LOG')) return { icon: '🟡', color: '#FFB800', label: 'ESCALATED' };
    return { icon: '🟢', color: '#00FF88', label: 'RESOLVED' };
  };

  return (
    <div className="tp-shell">
      <style>{`
        :root {
          --bg: #060B18;
          --panel: rgba(255,255,255,0.03);
          --panel-strong: rgba(255,255,255,0.04);
          --border: rgba(255,255,255,0.08);
          --cyan: #00D4FF;
          --red: #FF3B5C;
          --amber: #FFB800;
          --green: #00FF88;
          --purple: #8B5CF6;
          --text: #F0F4FF;
          --muted: rgba(255,255,255,0.4);
          --terminal: #020812;
          --mono: 'JetBrains Mono', 'Courier New', monospace;
          --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); }

        @keyframes pulse-red {
          0%,100% { box-shadow: 0 0 15px rgba(255,59,92,0.4); }
          50% { box-shadow: 0 0 35px rgba(255,59,92,0.8); }
        }

        @keyframes pulse-green {
          0%,100% { box-shadow: 0 0 14px rgba(0,255,136,0.35), 0 0 0 0 rgba(0,255,136,0.28); }
          50% { box-shadow: 0 0 34px rgba(0,255,136,0.7), 0 0 0 9px rgba(0,255,136,0); }
        }

        @keyframes blink {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        @keyframes radar-ring {
          0% { transform: scale(0.35); opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        @keyframes radar-sweep {
          to { transform: rotate(360deg); }
        }

        .tp-shell {
          min-height: 100vh;
          padding: 18px;
          color: var(--text);
          font-family: var(--sans);
          background:
            radial-gradient(circle at 18% 8%, rgba(0,212,255,0.16), transparent 26%),
            radial-gradient(circle at 80% 20%, rgba(255,59,92,0.13), transparent 28%),
            linear-gradient(180deg, #081125 0%, var(--bg) 42%, #030711 100%);
          overflow-x: hidden;
        }

        .tp-shell::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(0,212,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.045) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 85%);
        }

        .glass {
          position: relative;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          backdrop-filter: blur(12px);
          box-shadow: 0 18px 60px rgba(0,0,0,0.34);
        }

        .top-bar {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 18px 20px;
          overflow: hidden;
        }

        .brand-row, .status-row, .inline-center {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }

        .brand-row { gap: 12px; }
        .status-row { gap: 14px; margin-top: 8px; color: var(--muted); font-size: 12px; }
        .inline-center { gap: 8px; }

        .shield {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(0,212,255,0.32);
          border-radius: 8px;
          background: rgba(0,212,255,0.08);
          box-shadow: 0 0 24px rgba(0,212,255,0.24);
          font-size: 22px;
        }

        .brand-title {
          margin: 0;
          color: var(--text);
          font-size: clamp(21px, 3vw, 34px);
          line-height: 1;
          letter-spacing: 0;
          font-weight: 900;
        }

        .command-label {
          color: var(--cyan);
          font-family: var(--mono);
          font-size: 12px;
          letter-spacing: 0;
        }

        .live-pill, .soc-pill, .scan-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 28px;
          padding: 5px 10px;
          border: 1px solid rgba(0,212,255,0.24);
          border-radius: 999px;
          color: var(--cyan);
          background: rgba(0,212,255,0.06);
          font-family: var(--mono);
          font-size: 12px;
          white-space: nowrap;
        }

        .soc-pill {
          color: var(--text);
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.045);
        }

        .scan-pill {
          color: var(--amber);
          border-color: rgba(255,184,0,0.28);
          background: rgba(255,184,0,0.08);
        }

        .live-dot, .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--green);
          animation: pulse-green 1.6s infinite;
        }

        .status-dot { width: 7px; height: 7px; animation-duration: 2.2s; }
        .status-dot.cyan { background: var(--cyan); box-shadow: 0 0 12px rgba(0,212,255,0.75); animation: none; }

        .run-button, .approve-button {
          border: 0;
          cursor: pointer;
          color: #021018;
          font-weight: 900;
          letter-spacing: 0;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }

        .run-button {
          min-width: 184px;
          padding: 14px 20px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--cyan), #6AE8FF);
          box-shadow: 0 0 24px rgba(0,212,255,0.34);
        }

        .run-button:hover, .approve-button:hover { transform: translateY(-1px); }
        .run-button:disabled { cursor: not-allowed; opacity: 0.56; transform: none; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 14px 0;
        }

        .stat-card {
          padding: 18px;
          min-height: 124px;
          overflow: hidden;
        }

        .stat-card.critical {
          border-color: rgba(255,59,92,0.42);
          animation: pulse-red 2s infinite;
        }

        .stat-meta, .panel-kicker, .action-kicker, .metric-label {
          color: var(--muted);
          font-family: var(--mono);
          font-size: 11px;
          text-transform: uppercase;
        }

        .stat-value {
          margin-top: 13px;
          color: var(--accent);
          font-size: clamp(29px, 4vw, 45px);
          line-height: 0.95;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .stat-label {
          margin-top: 9px;
          color: var(--text);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(360px, 2fr);
          gap: 14px;
        }

        .panel {
          padding: 20px;
          min-height: 458px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .panel-title {
          margin: 4px 0 0;
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .mono {
          font-family: var(--mono);
          color: var(--cyan);
        }

        .severity-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,59,92,0.42);
          border-radius: 8px;
          background: rgba(255,59,92,0.1);
          color: var(--red);
          font-family: var(--mono);
          font-weight: 900;
          animation: pulse-red 2s infinite;
        }

        .execution-id {
          color: var(--muted);
          font-family: var(--mono);
          font-size: 11px;
          margin-top: 9px;
          overflow-wrap: anywhere;
        }

        .campaign-banner {
          margin: 16px 0;
          padding: 14px;
          border: 1px solid transparent;
          border-radius: 8px;
          background:
            linear-gradient(#11111B, #11111B) padding-box,
            linear-gradient(135deg, rgba(255,184,0,0.92), rgba(255,59,92,0.48), rgba(0,212,255,0.28)) border-box;
          box-shadow: 0 0 24px rgba(255,184,0,0.14);
        }

        .campaign-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--amber);
          font-size: 14px;
          font-weight: 900;
        }

        .campaign-copy {
          margin-top: 7px;
          color: rgba(240,244,255,0.76);
          font-size: 13px;
          line-height: 1.5;
        }

        .terminal {
          margin: 16px 0;
          padding: 15px;
          border: 1px solid rgba(0,212,255,0.28);
          border-radius: 8px;
          background: var(--terminal);
          box-shadow: inset 0 0 24px rgba(0,212,255,0.05);
        }

        .terminal-text {
          margin-top: 8px;
          color: var(--cyan);
          font-family: var(--mono);
          font-size: 13px;
          line-height: 1.65;
        }

        .terminal-text::after {
          content: '█';
          color: var(--green);
          margin-left: 5px;
          animation: blink 1s steps(1) infinite;
        }

        .accounts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(122px, 1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .account-pill {
          min-width: 0;
          padding: 8px 9px;
          border: 1px solid rgba(255,59,92,0.45);
          border-radius: 7px;
          background: rgba(255,59,92,0.08);
          color: #FF9AAD;
          font-family: var(--mono);
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .incident-footer {
          margin-top: 16px;
          color: var(--muted);
          font-family: var(--mono);
          font-size: 11px;
        }

        .graph-wrap {
          position: relative;
          min-height: 460px;
          border: 1px solid rgba(0,212,255,0.18);
          border-radius: 8px;
          background: var(--terminal);
          box-shadow: inset 0 0 36px rgba(0,212,255,0.04), 0 0 28px rgba(0,212,255,0.08);
          overflow: hidden;
        }

        .graph-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .graph-canvas {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 460px;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 12px;
          color: var(--muted);
          font-family: var(--mono);
          font-size: 11px;
        }

        .actions-panel {
          margin-top: 14px;
          padding: 18px;
        }

        .actions-strip {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(220px, 1fr);
          gap: 10px;
          overflow-x: auto;
          padding: 4px 2px 10px;
          scrollbar-color: rgba(0,212,255,0.5) transparent;
        }

        .action-card {
          min-height: 104px;
          padding: 13px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 13%, transparent), rgba(255,255,255,0.025));
          box-shadow: 0 0 20px color-mix(in srgb, var(--tone) 16%, transparent);
        }

        .action-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          color: var(--tone);
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 900;
        }

        .action-type {
          margin-top: 12px;
          color: var(--text);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .action-target {
          margin-top: 6px;
          display: inline-block;
          max-width: 100%;
          padding: 5px 7px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 6px;
          color: var(--cyan);
          background: var(--terminal);
          font-family: var(--mono);
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .approve-wrap {
          margin-top: 14px;
        }

        .approve-button {
          width: 100%;
          min-height: 64px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--green), #B6FFD8);
          font-size: clamp(14px, 2.3vw, 18px);
          animation: pulse-green 1.7s infinite;
        }

        .approved-card {
          padding: 18px;
          text-align: center;
          border-color: rgba(0,255,136,0.42);
          background: rgba(0,255,136,0.1);
          box-shadow: 0 0 26px rgba(0,255,136,0.18);
        }

        .approved-title {
          color: var(--green);
          font-size: 18px;
          font-weight: 900;
        }

        .approved-time {
          margin-top: 7px;
          color: #B6FFD8;
          font-family: var(--mono);
          font-size: 12px;
        }

        .empty-state {
          min-height: calc(100vh - 122px);
          display: grid;
          place-items: center;
          text-align: center;
        }

        .radar {
          position: relative;
          width: min(58vw, 360px);
          aspect-ratio: 1;
          border: 1px solid rgba(0,212,255,0.28);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,212,255,0.16), rgba(0,212,255,0.02) 38%, transparent 68%);
          box-shadow: 0 0 44px rgba(0,212,255,0.16), inset 0 0 38px rgba(0,212,255,0.08);
        }

        .radar::before,
        .radar::after {
          content: '';
          position: absolute;
          inset: 12%;
          border: 1px solid rgba(0,212,255,0.25);
          border-radius: 50%;
          animation: radar-ring 2.8s infinite;
        }

        .radar::after { animation-delay: 1.3s; }

        .radar-sweep {
          position: absolute;
          inset: 50% 50% auto auto;
          width: 48%;
          height: 2px;
          transform-origin: left center;
          background: linear-gradient(90deg, var(--green), transparent);
          animation: radar-sweep 2.2s linear infinite;
        }

        .radar-core {
          position: absolute;
          inset: 45%;
          border-radius: 50%;
          background: var(--cyan);
          box-shadow: 0 0 22px rgba(0,212,255,0.9);
        }

        .empty-title {
          margin: 24px 0 8px;
          color: var(--cyan);
          font-family: var(--mono);
          font-size: clamp(18px, 3vw, 28px);
          font-weight: 900;
        }

        .empty-copy {
          color: var(--muted);
          font-family: var(--mono);
          font-size: 12px;
        }

        @media (max-width: 980px) {
          .top-bar, .main-grid { grid-template-columns: 1fr; }
          .run-button { width: 100%; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .graph-wrap { min-height: 420px; }
          .graph-canvas { height: 420px; }
        }

        @media (max-width: 620px) {
          .tp-shell { padding: 10px; }
          .stats-grid { grid-template-columns: 1fr; }
          .panel { padding: 15px; }
          .panel-header { display: block; }
          .severity-badge { margin-top: 12px; }
          .actions-strip { grid-auto-columns: minmax(190px, 86vw); }
          .graph-wrap { min-height: 360px; }
          .graph-canvas { height: 360px; }
        }
      `}</style>

      <header className="glass top-bar">
        <div>
          <div className="brand-row">
            <div className="shield">🛡️</div>
            <div>
              <h1 className="brand-title">THREATPILOT</h1>
              <div className="command-label">BANK SOC COMMAND CENTER</div>
            </div>
            <span className="live-pill"><span className="live-dot" />LIVE</span>
            <span className="soc-pill">BANK SOC</span>
            {loading && <span className="scan-pill">⚡ ANALYZING</span>}
          </div>
          <div className="status-row">
            <span className="inline-center"><span className="status-dot" />Splunk MCP Connected</span>
            <span className="inline-center"><span className="status-dot cyan" />Neo4j Graph Active</span>
            <span className="mono">API {API}</span>
          </div>
        </div>
        <button className="run-button" onClick={runDetection} disabled={loading}>
          {loading ? 'RUNNING DETECTION' : '▶ RUN DETECTION'}
        </button>
      </header>

      {!incident ? (
        <section className="empty-state">
          <div>
            <div className="radar" aria-hidden="true">
              <div className="radar-sweep" />
              <div className="radar-core" />
            </div>
            <div className="empty-title">AWAITING THREAT DATA</div>
            <div className="empty-copy">Commander Agent standing by for Splunk signals and campaign graph correlation.</div>
          </div>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            {statCards.map((s) => (
              <article className={`glass stat-card ${s.critical ? 'critical' : ''}`} key={s.label} style={{ '--accent': s.accent }}>
                <div className="stat-meta">{s.meta}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </article>
            ))}
          </section>

          <main className="main-grid">
            <section className="glass panel">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Incident Report</div>
                  <h2 className="panel-title">Credential Attack Response</h2>
                  <div className="execution-id">{incident.execution_id}</div>
                </div>
                <span className="severity-badge">● {incident.severity}</span>
              </div>

              {incident.campaign_match && (
                <div className="campaign-banner">
                  <div className="campaign-title">⚠ Campaign Graph Match</div>
                  <div className="campaign-copy">
                    IPs linked to <strong style={{ color: '#FFB800' }}>"{incident.campaign?.name}"</strong>
                  </div>
                  <div className="campaign-copy mono">
                    {incident.campaign?.date} / {incident.campaign?.description}
                  </div>
                </div>
              )}

              <div className="terminal">
                <div className="panel-kicker">AI Verdict</div>
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

            <section className="glass panel">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">Campaign Graph</div>
                  <h2 className="panel-title">Knowledge Graph</h2>
                </div>
                <span className="soc-pill">CONCENTRIC</span>
              </div>
              <div className="graph-wrap">
                <div ref={cyContainer} className="graph-canvas" />
              </div>
              <div className="legend">
                <span><span style={{ color: '#FF3B5C' }}>●</span> Attack IP ({incident.offenderIPs?.length})</span>
                <span><span style={{ color: '#FFB800' }}>●</span> Known Campaign</span>
                <span><span style={{ color: '#00D4FF' }}>- -</span> Correlation Edge</span>
              </div>
            </section>
          </main>

          <section className="glass actions-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">Actions Timeline</div>
                <h2 className="panel-title">Automated Response Chain</h2>
              </div>
              <span className="soc-pill">{incident.actions_taken?.length} ACTIONS</span>
            </div>
            <div className="actions-strip">
              {incident.actions_taken?.map((a, i) => {
                const tone = actionTone(a.type);
                return (
                  <article className="action-card" key={i} style={{ '--tone': tone.color }}>
                    <div className="action-head">
                      <span>{tone.icon} {tone.label}</span>
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
              <div className="glass approved-card">
                <div className="approved-title">✅ Approved by {incident.approved_by}</div>
                <div className="approved-time">{incident.approved_at && new Date(incident.approved_at).toLocaleString()}</div>
              </div>
            ) : (
              <button className="approve-button" onClick={approve}>
                ✅ APPROVE RESPONSE — ARJUN (SOC ANALYST)
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
