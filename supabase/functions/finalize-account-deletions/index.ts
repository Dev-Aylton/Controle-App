import { createClient } from 'npm:@supabase/supabase-js@2'

type DeletionRequest = {
  request_id: string
  user_id: string
}

function matchesSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const encoder = new TextEncoder()
  const left = encoder.encode(provided)
  const right = encoder.encode(expected)
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

function response(status: number, body: Record<string, number | string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })

  const cronSecret = Deno.env.get('ACCOUNT_DELETION_CRON_SECRET')
  if (!cronSecret) return response(500, { error: 'cron_secret_not_configured' })
  if (!matchesSecret(request.headers.get('x-account-deletion-cron-secret'), cronSecret)) {
    return response(401, { error: 'unauthorized' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return response(500, { error: 'supabase_service_not_configured' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const claimed = await admin.rpc('claim_expired_account_deletions', { p_limit: 100 })
  if (claimed.error) {
    console.error('Unable to claim expired account deletion requests.')
    return response(500, { error: 'claim_failed' })
  }

  let completed = 0
  let failed = 0
  let releaseFailed = 0
  const releaseRequest = async (requestId: string) => {
    const released = await admin.rpc('release_expired_account_deletion', { p_request_id: requestId })
    if (released.error) {
      releaseFailed += 1
      console.error('Unable to release a failed account deletion request.')
      return false
    }
    return true
  }

  for (const deletion of (claimed.data ?? []) as DeletionRequest[]) {
    const paths: string[] = []
    let offset = 0
    let listingFailed = false
    while (true) {
      const listed = await admin.storage.from('profile-photos').list(deletion.user_id, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (listed.error) {
        listingFailed = true
        break
      }
      const files = listed.data ?? []
      paths.push(...files.map((file) => `${deletion.user_id}/${file.name}`))
      if (files.length < 1000) break
      offset += files.length
    }

    if (listingFailed) {
      await releaseRequest(deletion.request_id)
      console.error('Unable to list profile photos for an expired deletion request.')
      failed += 1
      continue
    }

    let removalFailed = false
    for (let index = 0; index < paths.length; index += 1000) {
      const removed = await admin.storage.from('profile-photos').remove(paths.slice(index, index + 1000))
      if (removed.error) {
        removalFailed = true
        break
      }
    }
    if (removalFailed) {
      await releaseRequest(deletion.request_id)
      console.error('Unable to remove profile photos for an expired deletion request.')
      failed += 1
      continue
    }

    const finalized = await admin.rpc('finalize_expired_account_deletion', {
      p_request_id: deletion.request_id,
    })
    if (finalized.error || finalized.data !== true) {
      await releaseRequest(deletion.request_id)
      console.error('Unable to finalize an expired account deletion request.')
      failed += 1
      continue
    }
    completed += 1
  }

  return response(failed > 0 ? 500 : 200, { completed, failed, release_failed: releaseFailed })
})
