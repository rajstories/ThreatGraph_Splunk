const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password123')
);

async function seedGraph() {
  const session = driver.session();
  
  try {
    // Clear existing data first
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Cleared existing graph data');

    // Create the OLD phishing campaign from 3 days ago
    await session.run(`
      CREATE (c:Campaign {
        id: 'CAMP-2024-001',
        name: 'Phishing wave — June 11',
        date: '2024-06-11',
        type: 'phishing',
        confirmed: true,
        accounts_compromised: 34,
        description: 'Mass phishing campaign targeting bank customers'
      })
    `);
    console.log('Created phishing campaign node');

    // Create all 6 attack IPs (same IPs now attacking again)
    const attackIPs = [
      '203.0.113.10', '203.0.113.11', '203.0.113.12',
      '203.0.113.13', '203.0.113.14', '203.0.113.15'
    ];

    for (const ip of attackIPs) {
      await session.run(`
        MATCH (c:Campaign {id: 'CAMP-2024-001'})
        CREATE (ip:IP {
          address: $ip,
          country: 'RU',
          threat_score: 92,
          first_seen: '2024-06-11',
          last_seen: '2024-06-11'
        })
        CREATE (ip)-[:USED_IN {role: 'sender'}]->(c)
      `, { ip });
      console.log(`Created IP node: ${ip}`);
    }

    // Add some victim accounts from the OLD campaign
    const oldVictims = ['rajesh.kumar', 'sunita.sharma', 'mohan.das'];
    for (const user of oldVictims) {
      await session.run(`
        MATCH (c:Campaign {id: 'CAMP-2024-001'})
        CREATE (a:Account {username: $user, status: 'compromised'})
        CREATE (a)-[:TARGETED_IN]->(c)
      `, { user });
    }
    console.log('Created victim account nodes');

    console.log('\n✅ Graph seeded successfully!');
    console.log('Campaign: Phishing wave from 3 days ago');
    console.log('IPs linked: 203.0.113.10 → 203.0.113.15');
    console.log('Open http://localhost:7474 to see the graph visually');

  } catch (err) {
    console.error('Error seeding graph:', err);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedGraph();
