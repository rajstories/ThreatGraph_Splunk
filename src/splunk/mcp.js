const axios = require('axios');
const https = require('https');
require('dotenv').config();

const splunk = axios.create({
  baseURL: 'https://localhost:8089',
  auth: {
    username: process.env.SPLUNK_USER,
    password: process.env.SPLUNK_PASSWORD
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

async function runSearch(spl) {
  // Create search job — exec_mode=blocking waits for results automatically
  const params = new URLSearchParams();
  params.append('search', spl);
  params.append('output_mode', 'json');
  params.append('exec_mode', 'blocking');

  const jobRes = await splunk.post(
    '/services/search/jobs',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const sid = jobRes.data.sid;

  // Get results
  const results = await splunk.get(`/services/search/jobs/${sid}/results`, {
    params: { output_mode: 'json', count: 100 }
  });

  return results.data.results;
}

async function findAttackClusters() {
  try {
    return await runSearch(
      'search index=main sourcetype=auth_events status=FAILURE earliest=-60m ' +
      '| stats count, values(username) as targeted_users by src_ip ' +
      '| where count > 15 ' +
      '| eval severity=if(count>50,"HIGH","MEDIUM") ' +
      '| sort -count'
    );
  } catch (err) {
    console.error('[MCP] Splunk query failed:', err.message);
    return [];
  }
}

async function getAlertCount() {
  const r = await runSearch(
    'search index=main sourcetype=auth_events status=FAILURE earliest=-60m ' +
    '| stats count'
  );
  return r[0]?.count || 0;
}

module.exports = { runSearch, findAttackClusters, getAlertCount };
