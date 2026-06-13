const driver = require('./neo4j');

async function checkIPInGraph(ip) {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (ip:IP {address: $ip})-[:USED_IN]->(c:Campaign)
      RETURN ip, c
    `, { ip });

    if (result.records.length > 0) {
      const campaign = result.records[0].get('c').properties;
      return {
        found: true,
        campaign,
        message: `IP ${ip} was used in: "${campaign.name}" on ${campaign.date}`
      };
    }
    return { found: false };
  } finally {
    await session.close();
  }
}

async function addThreatToGraph(incident) {
  const session = driver.session();
  try {
    await session.run(`
      MERGE (c:Campaign {id: $id})
      SET c.name = $name, c.date = $date, c.type = 'credential_stuffing'
    `, {
      id: incident.execution_id,
      name: `Credential stuffing — ${new Date().toISOString().split('T')[0]}`,
      date: new Date().toISOString().split('T')[0]
    });

    for (const ip of incident.offenderIPs) {
      await session.run(`
        MERGE (ip:IP {address: $ip})
        SET ip.last_seen = $date, ip.threat_score = 95
        WITH ip
        MATCH (c:Campaign {id: $id})
        MERGE (ip)-[:USED_IN]->(c)
      `, { ip, date: new Date().toISOString(), id: incident.execution_id });
    }
  } finally {
    await session.close();
  }
}

module.exports = { checkIPInGraph, addThreatToGraph };
