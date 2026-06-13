const identityAgent = require('./identity-agent');
const networkAgent  = require('./network-agent');
const infraAgent    = require('./infra-agent');

async function processFindings(finding) {
  if (!finding) return null;
  console.log('\n[Immediator] Dispatching to domain agents...');

  const [id, net, infra] = await Promise.all([
    identityAgent.respond(finding),
    networkAgent.respond(finding),
    infraAgent.respond(finding)
  ]);

  const incident = {
    ...finding,
    dispatched_at: new Date().toISOString(),
    actions_taken: [...id.actions, ...net.actions, ...infra.actions],
    remediation_complete: true,
    approved: false
  };

  console.log(`[Immediator] Done — ${incident.actions_taken.length} actions taken`);
  return incident;
}

module.exports = { processFindings };
