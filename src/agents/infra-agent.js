async function respond(incident) {
  console.log('[Infra Agent] Escalating monitoring...');

  const actions = [
    {
      type: 'MONITORING_ESCALATED',
      target: 'auth-service',
      level: 'HIGH_ALERT',
      timestamp: new Date().toISOString(),
      agent: 'infra'
    },
    {
      type: 'LOG_VERBOSITY_INCREASED',
      target: 'all_services',
      duration_minutes: 60,
      timestamp: new Date().toISOString(),
      agent: 'infra'
    }
  ];

  console.log(`[Infra Agent] ${actions.length} actions complete`);
  return { actions };
}

module.exports = { respond };
