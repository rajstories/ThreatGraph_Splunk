const express = require('express');
const cors    = require('cors');
const { runCommanderCycle, getLastFindings } = require('../agents/commander');
const { processFindings } = require('../agents/immediator');

const app = express();
app.use(cors());
app.use(express.json());

let latestIncident = null;
let isRunning = false;

// Trigger full detection cycle
app.post('/api/run-detection', async (req, res) => {
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
  if (!question) return res.status(400).json({ error: 'No question provided' });

  const { runSearch } = require('../splunk/mcp');
  const q = question.toLowerCase();
  let spl, label;

  if (q.includes('account') || q.includes('user') || q.includes('locked') || q.includes('targeted')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by username | sort -count | head 12';
    label = 'Targeted accounts ranked by attack frequency';
  } else if (q.includes('ip') || q.includes('attacker') || q.includes('blocked') || q.includes('source')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count by src_ip | sort -count';
    label = 'Attack IPs ranked by attempt count';
  } else if (q.includes('how many') || q.includes('total') || q.includes('count') || q.includes('volume')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | stats count';
    label = 'Total failed login attempts';
  } else if (q.includes('when') || q.includes('timeline') || q.includes('time') || q.includes('pattern')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | search status=FAILURE | timechart span=1m count';
    label = 'Attack timeline over last 60 minutes';
  } else if (q.includes('service') || q.includes('endpoint')) {
    spl = 'search index=main sourcetype=auth_events earliest=-60m | spath | stats count by service | sort -count';
    label = 'Services targeted by attackers';
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
