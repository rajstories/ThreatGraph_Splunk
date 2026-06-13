async function respond(incident) {
  console.log('[Identity Agent] Locking accounts + revoking tokens...');
  const actions = [];

  for (const account of incident.targeted_accounts) {
    actions.push({
      type: 'ACCOUNT_LOCKED',
      target: account,
      timestamp: new Date().toISOString(),
      reason: `Targeted in ${incident.severity} credential stuffing attack`,
      agent: 'identity'
    });
    console.log(`  ✓ Locked: ${account}`);
  }

  actions.push({
    type: 'TOKENS_REVOKED',
    target: 'all_affected_sessions',
    count: incident.targeted_accounts.length,
    timestamp: new Date().toISOString(),
    agent: 'identity'
  });

  console.log(`[Identity Agent] ${actions.length} actions complete`);
  return { actions };
}

module.exports = { respond };
