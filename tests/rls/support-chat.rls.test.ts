import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient,
  createTestUser,
  getAdminSession,
  loggedClient,
  loginUser,
  randomEmail,
  rlsConfig,
  testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS chat privado de suporte', () => {
  const admin = rlsConfig ? adminClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  let conversationA = ''
  let conversationB = ''
  let messageA = ''
  let temporaryAdminUserId: string | null = null

  function client(name: string) {
    const value = clients.get(name)
    if (!value) throw new Error(`Cliente de suporte não encontrado: ${name}`)
    return value
  }

  async function addUser(name: string) {
    if (!admin) throw new Error('Admin RLS ausente')
    const email = randomEmail(`rls-test-support-${name}`)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    const session = await loginUser(email, password)
    clients.set(name, loggedClient(session.access_token))
  }

  beforeAll(async () => {
    if (!admin) throw new Error('Admin RLS ausente')
    await addUser('user-a')
    await addUser('user-b')
    const adminSession = await getAdminSession()
    temporaryAdminUserId = adminSession.temporaryAdminUserId
    clients.set('admin', adminSession.client)

    const ownA = await client('user-a').rpc('support_get_or_create_conversation')
    const ownB = await client('user-b').rpc('support_get_or_create_conversation')
    if (ownA.error || ownB.error) {
      throw new Error(`Falha ao criar conversas: ${ownA.error?.message ?? ownB.error?.message}`)
    }
    conversationA = String(ownA.data)
    conversationB = String(ownB.data)

    const sentA = await client('user-a').rpc('support_send_message', {
      p_conversation_id: conversationA,
      p_body: 'Mensagem privada A',
      p_attachment_path: null,
      p_attachment_name: null,
      p_attachment_type: null,
      p_attachment_size: null,
    })
    if (sentA.error) throw new Error(`Falha ao enviar mensagem A: ${sentA.error.message}`)
    messageA = String(sentA.data)
  })

  afterAll(async () => {
    if (!admin) return
    if (temporaryAdminUserId) {
      await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      await admin.auth.admin.deleteUser(temporaryAdminUserId)
    }
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
  })

  it('cada usuário cria uma conversa única', async () => {
    const secondA = await client('user-a').rpc('support_get_or_create_conversation')
    expect(secondA.error).toBeNull()
    expect(String(secondA.data)).toBe(conversationA)
  })

  it('usuário não lista ou lê conversa de outro usuário', async () => {
    const attackList = await client('user-b').rpc('support_list_messages', {
      p_conversation_id: conversationA,
    })
    expect(attackList.error).not.toBeNull()

    const attackSend = await client('user-b').rpc('support_send_message', {
      p_conversation_id: conversationA,
      p_body: 'Tentativa indevida',
      p_attachment_path: null,
      p_attachment_name: null,
      p_attachment_type: null,
      p_attachment_size: null,
    })
    expect(attackSend.error).not.toBeNull()
  })

  it('usuário vê somente sua própria conversa e mensagens', async () => {
    const own = await client('user-a').rpc('support_list_messages', {
      p_conversation_id: conversationA,
    })
    expect(own.error).toBeNull()
    expect((own.data ?? []).some((row: { id: string }) => row.id === messageA)).toBe(true)

    const other = await client('user-b').rpc('support_list_messages', {
      p_conversation_id: conversationB,
    })
    expect(other.error).toBeNull()
  })

  it('administrador lista conversas e pode ler a conversa do usuário', async () => {
    const conversations = await client('admin').rpc('support_list_conversations')
    expect(conversations.error).toBeNull()
    expect((conversations.data ?? []).some((row: { id: string }) => row.id === conversationA)).toBe(true)

    const messages = await client('admin').rpc('support_list_messages', {
      p_conversation_id: conversationA,
    })
    expect(messages.error).toBeNull()
  })

  it('limita tamanho e conversa do anexo enviado pela RPC', async () => {
    const tooLarge = await client('user-a').rpc('support_send_message', {
      p_conversation_id: conversationA,
      p_body: 'Arquivo',
      p_attachment_path: `${conversationA}/arquivo.txt`,
      p_attachment_name: 'arquivo.txt',
      p_attachment_type: 'text/plain',
      p_attachment_size: 11 * 1024 * 1024,
    })
    expect(tooLarge.error).not.toBeNull()

    const wrongConversation = await client('user-a').rpc('support_send_message', {
      p_conversation_id: conversationA,
      p_body: 'Arquivo',
      p_attachment_path: `${conversationB}/arquivo.txt`,
      p_attachment_name: 'arquivo.txt',
      p_attachment_type: 'text/plain',
      p_attachment_size: 1024,
    })
    expect(wrongConversation.error).not.toBeNull()
  })

  it('marcação de leitura e ocultação são respeitadas pela conversa', async () => {
    const markUser = await client('user-a').rpc('support_mark_read', {
      p_conversation_id: conversationA,
    })
    expect(markUser.error).toBeNull()

    const hide = await client('user-a').rpc('support_hide_message', {
      p_message_id: messageA,
    })
    expect(hide.error).toBeNull()

    const unread = await client('user-a').rpc('support_unread_count')
    expect(unread.error).toBeNull()
  })
})
