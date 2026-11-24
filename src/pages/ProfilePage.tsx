import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { Container, Card, PhotoPicker, Avatar, ActionButton, ContextHelp, PageGuide } from '../components'
import { profileUploadErrorMessage } from '../lib/profileUploadError'
import { recordTechnicalError } from '../lib/diagnostics'
import { removeProfilePhoto } from '../features/account/profilePhoto'
import { useCompanies } from '../features/company/company-context'
import { markProfilePhotoHidden } from '../features/account/useProfilePhotoHidden'

export function ProfilePage() {
  const { user } = useAuth()
  const supabase = tryGetSupabaseClient()
  const { activeCompany, role, isAdmin } = useCompanies()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [uploadedPreview, setUploadedPreview] = useState('')
  const [uploadedBlob, setUploadedBlob] = useState<Blob | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [, setTechnicalError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      setName(data?.name ?? user.user_metadata.full_name ?? '')
      setAvatarUrl(data?.avatar_url ?? '')
      setAvatarKey(data?.avatar_key ?? '')
      setPhotoRemoved(false)
    })
  }, [supabase, user])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !user) return
    setError('')
    setMessage('')
    setTechnicalError('')
    let savedAvatarUrl = avatarUrl
    try {
      if (uploadedBlob) {
        const path = `${user.id}/avatar.webp`
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(path, uploadedBlob, { upsert: true, contentType: 'image/webp' })
        if (uploadError) throw uploadError
        savedAvatarUrl = path
      }
      let { error: saveError } = await supabase
        .from('profiles')
        .update({ name, avatar_url: savedAvatarUrl || null, avatar_key: avatarKey || null })
        .eq('id', user.id)
      if (saveError && /avatar_key|column.*does not exist/i.test(saveError.message)) {
        const fallback = await supabase
          .from('profiles')
          .update({ name, avatar_url: savedAvatarUrl || null })
          .eq('id', user.id)
        saveError = fallback.error
        if (!saveError) setTechnicalError('Não foi possível confirmar a atualização completa da foto. Tente novamente.')
      }
      if (saveError) throw saveError
      setAvatarUrl(savedAvatarUrl)
      setUploadedBlob(null)
      setUploadedPreview('')
      setPhotoRemoved(false)
      setMessage('Perfil atualizado.')
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(profileUploadErrorMessage(caught) ?? friendlySupabaseError(caught))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
      recordTechnicalError('ProfilePage.submit', caught)
    }
  }

  const removePhoto = async () => {
    if (!supabase || !user) {
      setError('Entre novamente antes de alterar sua foto.')
      return
    }
    setError('')
    setMessage('')
    setTechnicalError('')
    try {
      const result = await removeProfilePhoto(user.id, avatarUrl, Boolean(user.user_metadata.avatar_url), {
        removeStorageObject: async (path) => {
          const { error: removeError } = await supabase.storage.from('profile-photos').remove([path])
          if (removeError) throw removeError
        },
        clearProfilePhoto: async (fields) => {
          let { error: saveError } = await supabase
            .from('profiles')
            .update(fields)
            .eq('id', user.id)
          if (saveError && /avatar_key|column.*does not exist/i.test(saveError.message)) {
            const fallback = await supabase
              .from('profiles')
              .update({ avatar_url: null })
              .eq('id', user.id)
            saveError = fallback.error
          }
          if (saveError) throw saveError
          setAvatarUrl('')
          setAvatarKey('default-male')
          setUploadedBlob(null)
          setPhotoRemoved(true)
          if (uploadedPreview) URL.revokeObjectURL(uploadedPreview)
          setUploadedPreview('')
        },
        clearProviderAvatar: async () => {
          const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: null } })
          if (updateError) throw updateError
        },
      })
      markProfilePhotoHidden(user.id)
      setMessage(result.storageRemoved
        ? 'Foto de perfil removida.'
        : 'Foto removida do perfil. O arquivo antigo permanece no armazenamento.')
      if (!result.providerAvatarCleared) {
        setError('A foto saiu do perfil. A limpeza no login do Google não foi concluída, mas não será exibida novamente neste aparelho.')
      }
    } catch (caught) {
      const friendlyMessage = profileUploadErrorMessage(caught) ?? friendlySupabaseError(caught)
      setError(friendlyMessage)
      setTechnicalError(`${(caught as { message?: string }).message ?? String(caught)}`)
      recordTechnicalError('ProfilePage.removePhoto', caught)
      throw caught
    }
  }

  return (
    <Container>
      <h1>Meu perfil</h1>
      <PageGuide
        purpose="Manter sua identificação correta em auditorias e lançamentos."
        doNext="Confirme nome, foto ou avatar padrão e salve antes de sair da página."
        result="A equipe consegue reconhecer quem fez cada operação."
        roleNote="Esta página é individual e não altera seu cargo ou vínculo."
      />
      <ContextHelp
        title="Por que manter o perfil atualizado?"
        description="Seu nome identifica quem fez movimentações, vendas, contagens e alterações registradas."
        steps={[
          'Use seu nome profissional ou nome completo.',
          'Adicione uma foto clara se quiser.',
          'Não compartilhe sua senha ou sessão.',
        ]}
        result="A equipe e a auditoria conseguem reconhecer o responsável por cada ação."
      />
      <Card>
        <h2>Informações da conta</h2>
        <dl className="profile-summary">
          <div><dt>E-mail</dt><dd>{user?.email ?? 'Não informado'}</dd></div>
          <div><dt>Empresa ativa</dt><dd>{activeCompany?.name ?? 'Nenhuma empresa selecionada'}</dd></div>
          <div><dt>Cargo</dt><dd>{isAdmin ? 'Administrador do app' : role === 'owner' ? 'Proprietário' : role === 'manager' ? 'Gerente' : role === 'employee' ? 'Funcionário' : 'Sem vínculo'}</dd></div>
          <div><dt>Data da conta</dt><dd>{user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Não disponível'}</dd></div>
        </dl>
      </Card>
      <Card>
        <form onSubmit={(event) => event.preventDefault()} className="form-stack">
          <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome de exibição" /></label>
          <Avatar
            name={name}
            uploadedUrl={uploadedPreview || (avatarUrl && /^https?:/.test(avatarUrl) ? avatarUrl : undefined)}
            googleUrl={photoRemoved ? null : user?.user_metadata.avatar_url}
            avatarKey={avatarKey}
            storageBucket="profile-photos"
            storagePath={avatarUrl && !/^https?:/.test(avatarUrl) ? avatarUrl : null}
            size={160}
            alt="Meu avatar"
          />
          <PhotoPicker
            shape="round"
            label="Trocar foto"
            onConfirm={(blob, previewUrl) => {
              setUploadedBlob(blob)
              setUploadedPreview(previewUrl)
              setPhotoRemoved(false)
              setError('')
              setMessage('')
            }}
          />
          {(avatarUrl || avatarKey || user?.user_metadata.avatar_url || uploadedPreview) && (
            <ActionButton
              className="danger-button"
              busyLabel="Removendo..."
              successLabel="Foto removida"
              errorLabel="Tente novamente"
              confirmMessage="A foto será removida do seu perfil e do Storage do aplicativo, se tiver sido enviada por você."
              onAction={removePhoto}
            >
              Remover foto
            </ActionButton>
          )}
          <fieldset className="avatar-options">
            <legend>Avatar padrão</legend>
            <button type="button" className={avatarKey === 'default-male' ? 'avatar-choice active' : 'avatar-choice'} onClick={() => setAvatarKey('default-male')}>
              <Avatar avatarKey="default-male" size={72} alt="Avatar masculino" />
            </button>
            <button type="button" className={avatarKey === 'default-female' ? 'avatar-choice active' : 'avatar-choice'} onClick={() => setAvatarKey('default-female')}>
              <Avatar avatarKey="default-female" size={72} alt="Avatar feminino" />
            </button>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <ActionButton className="primary-button" busyLabel="Salvando..." confirmMessage="Confirmar as alterações do seu perfil?" onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>Salvar perfil</ActionButton>
        </form>
      </Card>
    </Container>
  )
}
