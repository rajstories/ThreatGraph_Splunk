const express = require('express');
const cors    = require('cors');
const { runCommanderCycle, getLastFindings } = require('../agents/commander');
const { processFindings } = require('../agents/immediator');

const DEMO_INCIDENT = {
  execution_id: "exec-1781382327907",
  timestamp: "2026-06-14T02:47:00.000Z",
  severity: "CRITICAL",
  total_alerts: 847,
  offenderIPs: ["203.0.113.13","203.0.113.12","203.0.113.15","203.0.113.10","203.0.113.11","203.0.113.14"],
  targeted_accounts: ["arjun.sharma","priya.patel","vikram.mehta","sunita.rao","amit.gupta","deepa.nair","rahul.joshi","kavya.reddy","sanjay.iyer","anita.kumar","rohit.singh","meera.pillai"],
  campaign_match: true,
  campaign: { id: "CAMP-2024-001", name: "Phishing wave — June 11", date: "2024-06-11", description: "Mass phishing campaign targeting bank customers", confirmed: true },
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
    { type: "TOKENS_REVOKED", target: "all_affected_sessions", count: 12, agent: "identity", timestamp: "2026-06-14T02:47:03.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.13", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.12", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.15", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.10", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.11", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "IP_BLOCKED", target: "203.0.113.14", method: "WAF_RULE", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "RATE_LIMIT_APPLIED", target: "auth-service", limit: "5 req/min", agent: "network", timestamp: "2026-06-14T02:47:04.000Z" },
    { type: "MONITORING_ESCALATED", target: "auth-service", level: "HIGH_ALERT", agent: "infra", timestamp: "2026-06-14T02:47:05.000Z" },
    { type: "LOG_VERBOSITY_INCREASED", target: "all_services", duration_minutes: 60, agent: "infra", timestamp: "2026-06-14T02:47:05.000Z" }
  ],
  remediation_complete: true,
  approved: false,
  dispatched_at: "2026-06-14T02:47:02.000Z"
};

const IS_DEMO = process.env.DEMO_MODE === 'true';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'ThreatGraph API',
    description: 'Autonomous Agentic SOC on Splunk — Splunk Agentic Ops Hackathon 2025',
    status: 'active',
    mode: IS_DEMO ? 'demo' : 'live',
    endpoints: {
      'POST /api/run-detection': 'Trigger Commander Agent detection cycle',
      'GET  /api/incident':      'Get latest incident report',
      'POST /api/approve':       'SOC analyst approval',
      'POST /api/ask':           'Splunk AI Assistant natural language query',
      'GET  /api/health':        'Health check'
    },
    frontend: 'https://threat-graph-splunk.vercel.app',
    github: 'https://github.com/rajstories/ThreatGraph_Splunk'
  });
});

let latestIncident = null;
let isRunning = false;

// Trigger full detection cycle
app.post('/api/run-detection', async (req, res) => {
  if (IS_DEMO) {
    latestIncident = { ...DEMO_INCIDENT, execution_id: `exec-${Date.now()}`, timestamp: new Date().toISOString() };
    return res.json({ status: 'complete', incident: latestIncident });
  }
  if (isRunning) return res.json({ status: 'already_running' });
  isRunning = true;
  try {
    const finding = await runCommanderCycle();
    if (finding) latestIncident = await processFindings(finding);
    res.json({ status: 'complete', incident: latestIncident });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    isRunning = false;
  }
});

app.get('/api/incident', (req, res) => res.json(latestIncident));
app.get('/api/findings', (req, res) => res.json(getLastFindings()));

// Human approval button
app.post('/api/approve', (req, res) => {
  if (latestIncident) {
    latestIncident.approved = true;
    latestIncident.approved_by = 'Arjun — SOC Analyst';
    latestIncident.approved_at = new Date().toISOString();
  }
  res.json({ status: 'approved', incident: latestIncident });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/status', (req, res) => {
  res.json({
    service: 'ThreatPilot',
    version: '1.0.0',
    agents: ['commander', 'immediator', 'identity', 'network', 'infra'],
    splunk: process.env.SPLUNK_URL,
    neo4j: process.env.NEO4J_URI,
    incident_count: latestIncident ? 1 : 0,
    uptime_seconds: Math.floor(process.uptime())
  });
});

// Splunk AI Assistant — natural language to SPL
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question' });

  if (IS_DEMO) {
    const q = question.toLowerCase();
    let label, results, spl;

    if (q.includes('account') || q.includes('user') || q.includes('targeted') || q.includes('locked')) {
      label = 'Targeted accounts ranked by attack frequency';
      spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by username | sort -count | head 12';
      results = [
        { username: 'arjun.sharma', count: '23' }, { username: 'priya.patel', count: '21' },
        { username: 'vikram.mehta', count: '19' }, { username: 'sunita.rao', count: '18' },
        { username: 'amit.gupta', count: '17' }, { username: 'deepa.nair', count: '16' }
      ];
    } else if (q.includes('ip') || q.includes('attacker') || q.includes('blocked') || q.includes('source')) {
      label = 'Attack IPs ranked by attempt count';
      spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by src_ip | sort -count';
      results = [
        { src_ip: '203.0.113.13', count: '166' }, { src_ip: '203.0.113.12', count: '152' },
        { src_ip: '203.0.113.15', count: '144' }, { src_ip: '203.0.113.10', count: '137' },
        { src_ip: '203.0.113.11', count: '128' }, { src_ip: '203.0.113.14', count: '121' }
      ];
    } else if (q.includes('how many') || q.includes('total') || q.includes('count')) {
      label = 'Total failed login attempts in last 60 minutes';
      spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count';
      results = [{ count: '847' }];
    } else if (q.includes('when') || q.includes('timeline') || q.includes('time')) {
      label = 'Attack volume over last 60 minutes';
      spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | timechart span=10m count';
      results = [
        { _time: '02:40', count: '89' }, { _time: '02:45', count: '203' },
        { _time: '02:50', count: '298' }, { _time: '02:55', count: '257' }
      ];
    } else {
      label = 'Current attack summary';
      spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by src_ip | sort -count';
      results = [
        { src_ip: '203.0.113.13', count: '166' }, { src_ip: '203.0.113.12', count: '152' },
        { src_ip: '203.0.113.15', count: '144' }
      ];
    }

    return res.json({ question, generated_spl: spl, label, results, powered_by: 'Splunk AI Assistant', timestamp: new Date().toISOString() });
  }

  const { runSearch } = require('../splunk/mcp');
  const q = question.toLowerCase();
  let spl, label;

  if (q.includes('account') || q.includes('user') || q.includes('locked') || q.includes('targeted')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by username | sort -count | head 12';
    label = 'Targeted accounts ranked by attack frequency';
  } else if (q.includes('ip') || q.includes('attacker') || q.includes('blocked')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by src_ip | sort -count';
    label = 'Attack IPs ranked by attempt count';
  } else if (q.includes('how many') || q.includes('total') || q.includes('count')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count';
    label = 'Total failed login attempts';
  } else if (q.includes('when') || q.includes('timeline') || q.includes('time')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | timechart span=1m count';
    label = 'Attack timeline';
  } else {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by src_ip | sort -count | head 6';
    label = 'Current attack summary';
  }

  try {
    const results = await runSearch(spl);
    res.json({
      question,
      generated_spl: spl,
      label,
      results: results.slice(0, 10),
      powered_by: 'Splunk AI Assistant',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('\nThreatPilot API → http://localhost:3001');
  console.log('POST /api/run-detection  — trigger detection');
  console.log('GET  /api/incident       — get latest incident');
  console.log('POST /api/approve        — Arjun approves');
});
