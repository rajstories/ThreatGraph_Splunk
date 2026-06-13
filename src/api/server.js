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

app.listen(3001, () => {
  console.log('\nThreatPilot API → http://localhost:3001');
  console.log('POST /api/run-detection  — trigger detection');
  console.log('GET  /api/incident       — get latest incident');
  console.log('POST /api/approve        — Arjun approves');
});
