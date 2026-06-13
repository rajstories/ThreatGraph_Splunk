const axios = require('axios');
const { execSync } = require('child_process');

async function runDemo() {
  console.log('\n🎬 ThreatPilot Demo Starting...\n');
  
  // Step 1: Clear old Splunk data and re-flood
  console.log('📡 Step 1: Flooding Splunk with 847 attack events...');
  execSync('python3 scripts/generate-logs.py', { stdio: 'inherit' });
  console.log('✅ 847 events sent to Splunk\n');

  // Step 2: Wait 3 seconds (so Splunk indexes them)
  console.log('⏳ Indexing...');
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Trigger Commander Agent
  console.log('🤖 Step 2: Commander Agent querying Splunk via MCP...');
  const res = await axios.post('http://localhost:3001/api/run-detection');
  const incident = res.data.incident;
  
  console.log(`\n⚠️  DETECTION COMPLETE`);
  console.log(`Severity: ${incident.severity}`);
  console.log(`Campaign Match: ${incident.campaign_match ? '✅ YES — ' + incident.campaign?.name : 'No'}`);
  console.log(`Accounts at risk: ${incident.targeted_accounts?.length}`);
  console.log(`Actions taken: ${incident.actions_taken?.length}`);
  console.log('\n🖥️  Open http://localhost:5173 to see the live dashboard');
  console.log('📋 Then click Approve as Arjun to complete the demo\n');
}

runDemo().catch(console.error);
