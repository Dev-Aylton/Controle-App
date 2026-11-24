import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type SupportConversation = {
  id: string
  userId: string
  status: 'open' | 'closed'
  archivedByUser: boolean
  archivedByAdmin: boolean
  createdAt: string
  updatedAt: string
  userName: string | null
  userEmail: string | null
  unreadCount: number
}

export type SupportMessage = {
  id: string
  senderId: string
  body: string | null
  attachmentPath: string | null
  attachmentName: string | null
  attachmentType: string | null
  attachmentSize: number | null
  sentAt: string
  readByUserAt: string | null
  readByAdminAt: string | null
  hiddenByUser: boolean
  hiddenByAdmin: boolean
}

export async function getOrCreateSupportConversation() {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_get_or_create_conversation')
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return String(result.data)
}

export async function listSupportConversations(): Promise<SupportConversation[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_list_conversations')
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  const rows = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
  return ((Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status === 'closed' ? 'closed' : 'open',
    archivedByUser: Boolean(row.archived_by_user),
    archivedByAdmin: Boolean(row.archived_by_admin),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    userName: row.user_name == null ? null : String(row.user_name),
    userEmail: row.user_email == null ? null : String(row.user_email),
    unreadCount: Number(row.unread_count ?? 0),
  }))
}

export async function listSupportMessages(conversationId: string): Promise<SupportMessage[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_list_messages', { p_conversation_id: conversationId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  const rows = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
  return ((Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    senderId: String(row.sender_id),
    body: row.body == null ? null : String(row.body),
    attachmentPath: row.attachment_path == null ? null : String(row.attachment_path),
    attachmentName: row.attachment_name == null ? null : String(row.attachment_name),
    attachmentType: row.attachment_type == null ? null : String(row.attachment_type),
    attachmentSize: row.attachment_size == null ? null : Number(row.attachment_size),
    sentAt: String(row.sent_at),
    readByUserAt: row.read_by_user_at == null ? null : String(row.read_by_user_at),
    readByAdminAt: row.read_by_admin_at == null ? null : String(row.read_by_admin_at),
    hiddenByUser: Boolean(row.hidden_by_user),
    hiddenByAdmin: Boolean(row.hidden_by_admin),
  }))
}

export async function sendSupportMessage(
  conversationId: string,
  body: string,
  attachment: { path: string | null; name: string | null; type: string | null; size: number | null },
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_send_message', {
    p_conversation_id: conversationId,
    p_body: body.trim() || null,
    p_attachment_path: attachment.path,
    p_attachment_name: attachment.name,
    p_attachment_type: attachment.type,
    p_attachment_size: attachment.size,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return String(result.data)
}

export async function uploadSupportAttachment(conversationId: string, file: File) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${conversationId}/${crypto.randomUUID()}-${safeName}`
  const result = await supabase.storage.from('support-attachments').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return { path: result.data.path, name: file.name, type: file.type || null, size: file.size }
}

export async function getSupportAttachmentUrl(path: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.storage.from('support-attachments').createSignedUrl(path, 60 * 10)
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data.signedUrl
}

export async function markSupportRead(conversationId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_mark_read', { p_conversation_id: conversationId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function archiveSupportConversation(conversationId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_archive_conversation', { p_conversation_id: conversationId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function unarchiveSupportConversation(conversationId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_unarchive_conversation', { p_conversation_id: conversationId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function hideSupportMessage(messageId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_hide_message', { p_message_id: messageId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function getSupportUnreadCount() {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('support_unread_count')
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return Number(result.data ?? 0)
}
