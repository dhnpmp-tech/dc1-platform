const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const db = new Database('/root/dc1-platform/backend/data/providers.db');
const supabase = createClient(
  'https://rwxqcqgjszvbwcyjfpec.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3eHFjcWdqc3p2YndjeWpmcGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzOTk1MCwiZXhwIjoyMDg3NDE1OTUwfQ.kP0iTloRCi7LgQ1ZqjtYC3qpZICwDujDnF8Z7RqIAV4'
);

async function sync() {
  const providers = db.prepare('SELECT * FROM providers').all();
  console.log(`Found ${providers.length} providers in SQLite`);
  
  const records = providers.map(p => ({
    email: p.email,
    name: p.name,
    type: 'provider'
  }));
  
  const { data, error } = await supabase
    .from('users')
    .upsert(records, { onConflict: 'email' });
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Successfully synced', providers.length, 'providers');
  }
  
  // Verify count
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
  console.log('Total users in Supabase now:', count);
}

sync().catch(console.error);
