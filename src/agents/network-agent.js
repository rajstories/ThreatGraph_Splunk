const fs = require('fs');

async function respond(incident) {
  console.log('[Network Agent] Blocking IPs + applying rate limits...');
  const actions = [];

  for (const ip of incident.offenderIPs) {
    actions.push({
      type: 'IP_BLOCKED',
      target: ip,
      method: 'WAF_RULE',
      rule_id: `WAF-${Date.now()}-${ip.replace(/\./g, '')}`,
      timestamp: new Date().toISOString(),
      agent: 'network'
    });
    console.log(`  ✓ Blocked IP: ${ip}`);
  }

  actions.push({
    type: 'RATE_LIMIT_APPLIED',
    target: 'auth-service',
    limit: '5 req/min per IP',
    timestamp: new Date().toISOString(),
    agent: 'network'
  });

  fs.writeFileSync('./blocked-ips.txt', incident.offenderIPs.join('\n'));
  console.log(`[Network Agent] ${actions.length} actions complete`);
  return { actions };
}

module.exports = { respond };
