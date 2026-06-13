const { findAttackClusters, getAlertCount } = require('../splunk/mcp');
const { checkIPInGraph, addThreatToGraph } = require('../graph/queries');

let lastFindings = null;

async function runCommanderCycle() {
  console.log('\n[Commander] Querying Splunk via MCP...');

  const clusters = await findAttackClusters();
  const totalAlerts = await getAlertCount();

  if (clusters.length === 0) {
    console.log('[Commander] No threats detected');
    return null;
  }

  console.log(`[Commander] ${clusters.length} suspicious IPs — ${totalAlerts} total alerts`);

  let campaignMatch = null;
  const enriched = [];

  for (const cluster of clusters) {
    const graphResult = await checkIPInGraph(cluster.src_ip);
    if (graphResult.found) {
      console.log(`[Commander] ⚠️  GRAPH MATCH: ${cluster.src_ip} → "${graphResult.campaign.name}"`);
      campaignMatch = graphResult.campaign;
    }
    enriched.push({
      src_ip: cluster.src_ip,
      count: parseInt(cluster.count),
      severity: cluster.severity,
      targeted_users: Array.isArray(cluster.targeted_users)
        ? cluster.targeted_users
        : (cluster.targeted_users ? cluster.targeted_users.split(',').map(u => u.trim()) : []),
      graph_match: graphResult.found,
      campaign: graphResult.campaign || null
    });
  }

  const allUsers = [...new Set(enriched.flatMap(c => c.targeted_users))];
  const severity = campaignMatch ? 'CRITICAL' : 'HIGH';

  const finding = {
    execution_id: `exec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    severity,
    total_alerts: parseInt(totalAlerts),
    offenderIPs: enriched.map(c => c.src_ip),
    targeted_accounts: allUsers,
    campaign_match: !!campaignMatch,
    campaign: campaignMatch,
    clusters: enriched,
    verdict: campaignMatch
      ? `CRITICAL: ${enriched.length} IPs from known campaign "${campaignMatch.name}" now credential-stuffing. ${allUsers.length} accounts at risk.`
      : `HIGH: Coordinated attack from ${enriched.length} IPs targeting ${allUsers.length} accounts.`
  };

  console.log(`[Commander] Campaign match: ${finding.campaign_match ? '⚠️  YES — ' + finding.campaign?.name : 'No'}`);
  console.log(`[Commander] Total targeted accounts: ${finding.targeted_accounts.length}`);

  console.log(`[Commander] Verdict: ${finding.verdict}`);
  await addThreatToGraph(finding);
  lastFindings = finding;
  return finding;
}

function getLastFindings() { return lastFindings; }

module.exports = { runCommanderCycle, getLastFindings };
