import {createClient} from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Cuba semula hanya untuk ralat rangkaian/pelayan; selamat kerana check-in ada UNIQUE(student_id, checkin_date)
export async function rpcRetry(fn, args, tries = 5) {
  let r
  for (let i = 0; i < tries; i++) {
    r = await supabase.rpc(fn, args)
    if (!r.error || !/fetch|network|timeout|too many|429|50\d/i.test(r.error.message || '')) return { ...r, attempt: i }
    await new Promise(x => setTimeout(x, 600 * 2 ** i + Math.random() * 500))
  }
  return r
}
