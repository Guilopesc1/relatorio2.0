import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Cliente para operações server-side com service role
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)