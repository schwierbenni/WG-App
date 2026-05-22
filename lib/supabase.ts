import { createClient } from '@supabase/supabase-js'

// Public credentials – the anon key is designed to be exposed in client code
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://enrdwsdrqjqfzpjtlvzo.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucmR3c2RycWpxZnpwanRsdnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzM1OTgsImV4cCI6MjA5NDgwOTU5OH0.MQv7ae_FmIScRHMTuRopnvgwqEQY31ukA3kZDDDChUE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const AVATAR_BUCKET = 'avatars'
