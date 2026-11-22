import { tryGetSupabaseClient } from '../../lib/supabase'
import { clearUserDeviceData } from './localDataCleanup'

type DeleteAccountDependencies = {
  callRpc: () => Promise<void>
  signOut: () => Promise<void>
  clearLocal: () => Promise<void>
}

export async function runDeleteAccountFlow(deps: DeleteAccountDependencies) {
  await deps.callRpc()
  let signOutError: unknown = null
  try {
    await deps.signOut()
  } catch (error) {
    signOutError = error
  }
  await deps.clearLocal()
  if (signOutError) throw signOutError
}

export async function deleteCurrentAccount(userId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  await runDeleteAccountFlow({
    callRpc: async () => {
      const result = await supabase.rpc('delete_my_account')
      if (result.error) throw result.error
    },
    signOut: async () => {
      const result = await supabase.auth.signOut({ scope: 'local' })
      if (result.error) throw result.error
    },
    clearLocal: () => clearUserDeviceData(userId, { discardPending: true }),
  })
}
