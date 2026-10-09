import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runTestSuite() {
  console.log('================================================================');
  console.log('BNPS ERP v0.3 — MODULE 1 STEP 4C');
  console.log('TARGETED RUNTIME VERIFICATION SUITE: get_dashboard_summary()');
  console.log('Supabase Target:', SUPABASE_URL);
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: ANONYMOUS EXECUTION VERIFICATION (SECURITY INVARIANT)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: ANONYMOUS RPC EXECUTION ---');
  await supabase.auth.signOut();
  const { data: anonData, error: anonError } = await supabase.rpc('get_dashboard_summary');
  
  if (anonError) {
    console.log('Status: PASS (Strictly Denied)');
    console.log('Error Code:', anonError.code);
    console.log('Error Message:', anonError.message);
  } else {
    console.error('Status: FAIL (Anonymous call unexpectedly succeeded)');
    console.error('Data:', anonData);
  }
  console.log('---------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // TEST 2: AUTHENTICATED ADMIN EXECUTION VERIFICATION
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: AUTHENTICATED ADMIN EXECUTION ---');
  const adminEmail = 'admin.test@bnps.local';
  const adminPassword = 'BnpsAdmin@2026!';
  
  console.log(`Authenticating as Admin: ${adminEmail}...`);
  const { data: adminAuthData, error: adminAuthError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (adminAuthError) {
    console.log('Admin Authentication Status: PENDING_DEPLOYMENT');
    console.log('Auth Message:', adminAuthError.message);
    console.log('Prerequisite: Execute database/09_test_accounts_provisioning.sql in Supabase SQL Editor.');
  } else {
    console.log('Admin Authentication Status: SUCCESS');
    console.log('User ID:', adminAuthData.user?.id);
    console.log('Calling get_dashboard_summary() as Admin...');
    
    const { data: adminRpcData, error: adminRpcError } = await supabase.rpc('get_dashboard_summary');
    if (adminRpcError) {
      console.error('Admin RPC Status: FAIL');
      console.error('RPC Error:', adminRpcError);
    } else {
      console.log('Admin RPC Status: PASS');
      console.log('Admin Profile Scope:', JSON.stringify(adminRpcData.profile, null, 2));
      console.log('Admin KPIs:', JSON.stringify(adminRpcData.kpis, null, 2));
      console.log('Monthly Installations:', JSON.stringify(adminRpcData.monthly_installations, null, 2));
      console.log('Top Agents Leaderboard:', JSON.stringify(adminRpcData.top_agents, null, 2));
    }
    await supabase.auth.signOut();
  }
  console.log('---------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // TEST 3: AUTHENTICATED AGENT EXECUTION VERIFICATION
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: AUTHENTICATED AGENT EXECUTION ---');
  const agentEmail = 'agent.test@bnps.local';
  const agentPassword = 'BnpsAgent@2026!';

  console.log(`Authenticating as Agent: ${agentEmail}...`);
  const { data: agentAuthData, error: agentAuthError } = await supabase.auth.signInWithPassword({
    email: agentEmail,
    password: agentPassword,
  });

  if (agentAuthError) {
    console.log('Agent Authentication Status: PENDING_DEPLOYMENT');
    console.log('Auth Message:', agentAuthError.message);
    console.log('Prerequisite: Execute database/09_test_accounts_provisioning.sql in Supabase SQL Editor.');
  } else {
    console.log('Agent Authentication Status: SUCCESS');
    console.log('User ID:', agentAuthData.user?.id);
    console.log('Calling get_dashboard_summary() as Agent...');

    const { data: agentRpcData, error: agentRpcError } = await supabase.rpc('get_dashboard_summary');
    if (agentRpcError) {
      console.error('Agent RPC Status: FAIL');
      console.error('RPC Error:', agentRpcError);
    } else {
      console.log('Agent RPC Status: PASS');
      console.log('Agent Profile Scope:', JSON.stringify(agentRpcData.profile, null, 2));
      console.log('Agent KPIs:', JSON.stringify(agentRpcData.kpis, null, 2));
      console.log('Redaction Check - Vendor Payments Count (Expected 0):', agentRpcData.kpis?.vendor_payments_pending_count);
      console.log('Redaction Check - Vendor Payments Amount (Expected 0.00):', agentRpcData.kpis?.vendor_payments_paid_amount);
      console.log('Redaction Check - Top Agents Redacted (Expected []):', JSON.stringify(agentRpcData.top_agents));
    }
    await supabase.auth.signOut();
  }
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Verification Suite Error:', err);
  process.exit(1);
});
