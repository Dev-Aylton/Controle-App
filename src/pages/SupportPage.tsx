import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton, PageGuide } from '../components'
import { traduzirErro } from '../lib/errors'
import { formatSupportFileSize, validateSupportDraft } from '../features/support/supportRules'
import {
  archiveSupportConversation,
  getOrCreateSupportConversation,
  getSupportAttachmentUrl,
  hideSupportMessage,
  listSupportConversations,
  listSupportMessages,
  markSupportRead,
  sendSupportMessage,
  unarchiveSupportConversation,
  uploadSupportAttachment,
  type SupportConversation,
  type SupportMessage,
} from '../features/support/supportService'

export function SupportPage() {
  const { user } = useAuth()
  const { isAdmin } = useCompanies()
  const [conversationId, setConversationId] = useState('')
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [conversationSearch, setConversationSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const userId = user?.id ?? null

  const load = useCallback(async (background = false) => {
    if (!userId || loadingRef.current) return
    loadingRef.current = true
    if (!background) setLoading(true)
    if (!background) setError('')
    try {
      if (isAdmin) {
        const rows = await listSupportConversations()
        setConversations(rows)
        if (!conversationId && rows.length) setConversationId(rows[0].id)
        if (conversationId) setSelectedConversation(rows.find((row) => row.id === conversationId) ?? null)
        if (conversationId) {
          setMessages(await listSupportMessages(conversationId))
          await markSupportRead(conversationId)
        }
      } else {
        const ownId = await getOrCreateSupportConversation()
        setConversationId(ownId)
        setMessages(await listSupportMessages(ownId))
        await markSupportRead(ownId)
      }
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar o suporte.'))
    } finally {
      if (!background) setLoading(false)
      loadingRef.current = false
    }
  }, [conversationId, isAdmin, userId])

  useEffect(() => {
    if (!userId) return
    queueMicrotask(() => { void load() })
    let interval = 0
    const startPolling = () => {
      window.clearInterval(interval)
      interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') void load(true)
      }, 12000)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load(true)
        startPolling()
      } else {
        window.clearInterval(interval)
      }
    }
    startPolling()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [load, userId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  const selectConversation = (conversation: SupportConversation) => {
    setConversationId(conversation.id)
    setSelectedConversation(conversation)
  }

  const chooseAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    setAttachment(event.target.files?.[0] ?? null)
  }

  const send = async () => {
    if (!conversationId) return
    const draftError = validateSupportDraft({
      body,
      attachmentName: attachment?.name ?? null,
      attachmentSize: attachment?.size ?? null,
    })
    if (draftError) {
      setError(draftError)
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      let uploaded: { path: string | null; name: string | null; type: string | null; size: number | null } = {
        path: null,
        name: null,
        type: null,
        size: null,
      }
      if (attachment) {
        uploaded = await uploadSupportAttachment(conversationId, attachment)
      }
      await sendSupportMessage(conversationId, body, uploaded)
      setBody('')
      setAttachment(null)
      setMessage('Mensagem enviada.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível enviar a mensagem.'))
    } finally {
      setLoading(false)
    }
  }

  const openAttachment = async (path: string) => {
    try {
      const url = await getSupportAttachmentUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível abrir o anexo.'))
    }
  }

  const archive = async () => {
    if (!conversationId) return
    try {
      await archiveSupportConversation(conversationId)
      setMessage('Conversa arquivada.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível arquivar a conversa.'))
    }
  }

  const unarchive = async () => {
    if (!conversationId) return
    try {
      await unarchiveSupportConversation(conversationId)
      setMessage('Conversa restaurada.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível restaurar a conversa.'))
    }
  }

  const hideMessage = async (messageId: string) => {
    try {
      await hideSupportMessage(messageId)
      setMessage('Mensagem ocultada da sua visão.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível ocultar a mensagem.'))
    }
  }

  const visibleConversations = conversations
    .filter((conversation) => showArchived ? conversation.archivedByAdmin : !conversation.archivedByAdmin)
    .filter((conversation) => !unreadOnly || conversation.unreadCount > 0)
    .filter((conversation) => {
      const search = conversationSearch.trim().toLocaleLowerCase('pt-BR')
      if (!search) return true
      return `${conversation.userName ?? ''} ${conversation.userEmail ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search)
    })
    .sort((left, right) => right.unreadCount - left.unreadCount || right.updatedAt.localeCompare(left.updatedAt))

  return (
    <Container>
      <h1>Suporte</h1>
      <PageGuide
        purpose="Conversar diretamente com o administrador do aplicativo."
        doNext="Escreva o problema, inclua diagnóstico ou anexo e aguarde a resposta."
        result="Somente você e o administrador têm acesso à conversa."
        roleNote={isAdmin ? 'Como administrador, você pode atender todas as conversas.' : 'Como usuário, você vê somente sua conversa.'}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {loading && <p className="page-state">Carregando suporte...</p>}
      {isAdmin ? (
        <div className="support-layout">
          <Card>
            <div className="support-inbox-header">
              <h2>Conversas</h2>
              <button className="secondary-button" type="button" onClick={() => setShowArchived((value) => !value)}>
                {showArchived ? 'Ver abertas' : 'Ver arquivadas'}
              </button>
            </div>
            <div className="support-inbox-filters">
              <label>
                Buscar pessoa
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="Nome ou e-mail"
                />
              </label>
              <label className="support-unread-filter">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                Somente não lidas
              </label>
            </div>
            <div className="support-conversation-list">
              {visibleConversations.length === 0 && <p>Nenhuma conversa encontrada.</p>}
              {visibleConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`support-conversation${conversation.id === conversationId ? ' active' : ''}`}
                  onClick={() => selectConversation(conversation)}
                >
                  <strong>{conversation.userName ?? conversation.userEmail ?? 'Usuário'}</strong>
                  <span>{conversation.userEmail ?? 'Sem e-mail'}</span>
                  {conversation.unreadCount > 0 && <small>{conversation.unreadCount} não lida(s)</small>}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            {selectedConversation ? (
              <>
                <header className="support-chat-header">
                  <div>
                    <strong>{selectedConversation.userName ?? selectedConversation.userEmail ?? 'Usuário'}</strong>
                    <span>{selectedConversation.archivedByAdmin ? 'Arquivada por administrador' : 'Conversa ativa'}</span>
                  </div>
                  {selectedConversation.archivedByAdmin
                    ? <button className="secondary-button" type="button" onClick={unarchive}>Desarquivar</button>
                    : <button className="secondary-button" type="button" onClick={archive}>Arquivar</button>}
                </header>
                <SupportMessages
                  messages={messages}
                  currentUserId={user?.id ?? ''}
                  isAdmin={true}
                  onOpenAttachment={openAttachment}
                  onHide={hideMessage}
                />
                <SupportComposer body={body} attachment={attachment} onBodyChange={setBody} onAttachmentChange={chooseAttachment} onSend={send} />
              </>
            ) : <p>Selecione uma conversa.</p>}
          </Card>
        </div>
      ) : (
        <Card>
          <header className="support-chat-header">
            <div>
              <strong>Administrador do aplicativo</strong>
              <span>Conversa privada</span>
            </div>
          </header>
          <SupportMessages
            messages={messages}
            currentUserId={user?.id ?? ''}
            isAdmin={false}
            onOpenAttachment={openAttachment}
            onHide={hideMessage}
          />
          <SupportComposer body={body} attachment={attachment} onBodyChange={setBody} onAttachmentChange={chooseAttachment} onSend={send} />
        </Card>
      )}
    </Container>
  )
}

function SupportMessages({
  messages,
  currentUserId,
  isAdmin,
  onOpenAttachment,
  onHide,
}: {
  messages: SupportMessage[]
  currentUserId: string
  isAdmin: boolean
  onOpenAttachment: (path: string) => void
  onHide: (messageId: string) => void
}) {
  return (
    <div className="support-messages">
      {messages.length === 0 && <p className="field-help">Nenhuma mensagem ainda.</p>}
      {messages.map((supportMessage) => (
        <article
          key={supportMessage.id}
          className={`support-message${supportMessage.senderId === currentUserId ? ' own' : ' other'}`}
        >
          {supportMessage.body && <p>{supportMessage.body}</p>}
          {supportMessage.attachmentPath && (
            <button type="button" className="support-attachment" onClick={() => onOpenAttachment(supportMessage.attachmentPath!)}>
              <strong>{supportMessage.attachmentName ?? 'Anexo'}</strong>
              {supportMessage.attachmentSize != null && <span>{formatSupportFileSize(supportMessage.attachmentSize)}</span>}
            </button>
          )}
          <small>
            {new Date(supportMessage.sentAt).toLocaleString('pt-BR')}
            {supportMessage.senderId === currentUserId && (
              (isAdmin ? supportMessage.readByUserAt : supportMessage.readByAdminAt)
                ? ' • Visualizada'
                : ' • Enviada'
            )}
          </small>
          <button type="button" className="support-hide-message" onClick={() => onHide(supportMessage.id)}>Ocultar</button>
        </article>
      ))}
    </div>
  )
}

function SupportComposer({
  body,
  attachment,
  onBodyChange,
  onAttachmentChange,
  onSend,
}: {
  body: string
  attachment: File | null
  onBodyChange: (value: string) => void
  onAttachmentChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
}) {
  return (
    <div className="support-composer">
      <textarea
        value={body}
        maxLength={4000}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder="Escreva sua mensagem"
        rows={3}
      />
      <div className="support-composer-actions">
        <label className="secondary-button support-file-button">
          Anexar
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.xlsx,.xls,.zip" onChange={onAttachmentChange} />
        </label>
        {attachment && <span>{attachment.name} • {formatSupportFileSize(attachment.size)}</span>}
        <ActionButton className="primary-button" busyLabel="Enviando..." onAction={onSend}>Enviar</ActionButton>
      </div>
    </div>
  )
}
