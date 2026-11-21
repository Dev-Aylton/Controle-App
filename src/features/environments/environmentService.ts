import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export async function listEnvironments(companyId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('environments')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw new Error(friendlySupabaseError(error))
  return data ?? []
}

export async function saveEnvironment(companyId: string, id: string | null, name: string, description: string, active = true) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const payload = { company_id: companyId, name: name.trim(), description: description.trim() || null, active }
  const result = id
    ? await supabase.from('environments').update(payload).eq('id', id).select('*').single()
    : await supabase.from('environments').insert(payload).select('*').single()
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data
}
