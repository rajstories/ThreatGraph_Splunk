const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

let mcpClient = null;

// ── Official Splunk MCP Server Connection ─────────────────────
async function getMCPClient() {
  if (mcpClient) return mcpClient;

  try {
    const token = process.env.SPLUNK_MCP_TOKEN;
    if (!token) throw new Error('No MCP token');

    const transport = new SSEClientTransport(
      new URL('https://localhost:8089/services/mcp/sse'),
      {
        requestInit: {
          headers: { 'Authorization': `Bearer ${token}` },
          // Allow self-signed cert on localhost
          agent: new https.Agent({ rejectUnauthorized: false })
        }
      }
    );

    mcpClient = new Client(
      { name: 'threatpilot-commander', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    console.log('\x1b[32m[MCP] ✓ Connected to official Splunk MCP Server\x1b[0m');
    return mcpClient;

  } catch (err) {
    console.log('\x1b[33m[MCP] Splunk MCP Server unavailable — using REST fallback\x1b[0m');
    mcpClient = null;
    return null;
  }
}

// ── REST API Fallback ─────────────────────────────────────────
const splunkREST = axios.create({
  baseURL: 'https://localhost:8089',
  auth: {
    username: process.env.SPLUNK_USER || 'rajstories',
    password: process.env.SPLUNK_PASSWORD
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

async function runSearchREST(spl) {
  const params = new URLSearchParams();
  params.append('search', spl);
  params.append('output_mode', 'json');
  params.append('exec_mode', 'blocking');

  const jobRes = await splunkREST.post(
    '/services/search/jobs',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const sid = jobRes.data.sid;
  const results = await splunkREST.get(
    `/services/search/jobs/${sid}/results`,
    { params: { output_mode: 'json', count: 100 } }
  );
  return results.data.results;
}

// ── Main Search — MCP first, REST fallback ────────────────────
async function runSearch(spl) {
  const client = await getMCPClient();

  if (client) {
    try {
      const result = await client.callTool({
        name: 'search',
        arguments: {
          query: spl,
          earliest_time: '-60m',
          latest_time: 'now',
          max_count: 100
        }
      });

      console.log('\x1b[32m[MCP] ✓ Query via Splunk MCP Server\x1b[0m');

      const text = result.content[0]?.text;
      if (text) {
        try { return JSON.parse(text); }
        catch { return []; }
      }
      return [];

    } catch (err) {
      console.log('[MCP] Tool call failed, switching to REST');
      mcpClient = null;
      return await runSearchREST(spl);
    }
  }

  return await runSearchREST(spl);
}

// ── Agent Query Functions ─────────────────────────────────────
async function findAttackClusters() {
  return await runSearch(
    'search index=main sourcetype=auth_events earliest=-60m ' +
    '| spath ' +
    '| search status=FAILURE ' +
    '| stats count, values(username) as targeted_users by src_ip ' +
    '| where count > 15 ' +
    '| eval severity=if(count>50,"HIGH","MEDIUM") ' +
    '| sort -count'
  );
}

async function getAlertCount() {
  const r = await runSearch(
    'search index=main sourcetype=auth_events earliest=-60m ' +
    '| spath ' +
    '| search status=FAILURE ' +
    '| stats count'
  );
  return r[0]?.count || 0;
}

module.exports = { runSearch, findAttackClusters, getAlertCount, getMCPClient };
