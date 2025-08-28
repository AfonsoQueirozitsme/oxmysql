import { createClient } from '@supabase/supabase-js'

const url = GetConvar('supabase_url', 'https://kphsbkkjhlnszlqewqnt.supabase.co')
const serviceKey = GetConvar('supabase_service_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaHNia2tqaGxuc3pscWV3cW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNzc0OTcsImV4cCI6MjA3MTk1MzQ5N30.q_AUY-3ONcz_qAQOC0lwAmRCcxFHYDvlQP8wpja7jlg')

if (!url || !serviceKey) {
  console.error('[oxmysql] Faltam CONVARs supabase_url / supabase_service_key no server.cfg')
}

export const supa = createClient(url, serviceKey, { auth: { persistSession: false } })

export async function upsertPlayer(row) {
  const { data, error } = await supa
    .from('players')
    .upsert(row, { onConflict: 'citizenid' })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getPlayerByCitizenId(citizenid) {
  const { data, error } = await supa
    .from('players').select('*').eq('citizenid', citizenid).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getBan({ license, discord, ip }) {
  const { data, error } = await supa
    .from('bans')
    .select('*')
    .or(`license.eq.${license},discord.eq.${discord},ip.eq.${ip}`)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function replaceGroups(citizenid, groups) {
  const del = await supa.from('player_groups').delete().eq('citizenid', citizenid)
  if (del.error) throw new Error(del.error.message)
  if (groups?.length) {
    const ins = await supa.from('player_groups')
      .insert(groups.map(g => ({ ...g, citizenid })))
    if (ins.error) throw new Error(ins.error.message)
  }
  return true
}
