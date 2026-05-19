import 'server-only';

import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
  }
  return supabaseClient;
}

export function getSupabaseStorage() {
  return getSupabase().storage;
}

export const STORAGE_BUCKETS = {
  reports: 'research-reports',
  workbooks: 'research-workbooks',
  uploads: 'research-uploads',
} as const;
