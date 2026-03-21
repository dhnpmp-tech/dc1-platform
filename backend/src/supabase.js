const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rwxqcqgjszvbwcyjfpec.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3eHFjcWdqc3p2YndjeWpmcGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzOTk1MCwiZXhwIjoyMDg3NDE1OTUwfQ.kP0iTloRCi7LgQ1ZqjtYC3qpZICwDujDnF8Z7RqIAV4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncProviderToSupabase(name, email, gpu_model, os, api_key) {
  try {
    // 1. Upsert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ email, name, type: 'provider' }, { onConflict: 'email' })
      .select()
      .single();

    if (userError) {
      console.error('Supabase user sync error:', userError);
      return;
    }

    // 2. Insert machine
    const { error: machineError } = await supabase
      .from('machines')
      .insert({
        provider_id: user.id,
        model: gpu_model,
        api_key: api_key,
        os: os,
        status: 'available',
        hourly_rate: 0.50
      });

    if (machineError) {
      console.error('Supabase machine sync error:', machineError);
      return;
    }

    // 3. Create wallet for user if not exists
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingWallet) {
      await supabase
        .from('wallets')
        .insert({ user_id: user.id, balance: 0, currency: 'USD' });
    }

    console.log(`Supabase sync OK: ${email} -> user ${user.id}`);
  } catch (err) {
    console.error('Supabase sync failed (non-blocking):', err.message);
  }
}

module.exports = { supabase, syncProviderToSupabase };
