const { checkIPInGraph } = require('../src/graph/queries');
const { findAttackClusters } = require('../src/splunk/mcp');

async function test() {
  console.log('Testing Neo4j...');
  const result = await checkIPInGraph('203.0.113.10');
  console.log('Graph result:', result);

  console.log('\nTesting Splunk...');
  const clusters = await findAttackClusters();
  console.log('Attack clusters found:', clusters.length);
  console.log('Top IP:', clusters[0]);
}

test().catch(console.error);
