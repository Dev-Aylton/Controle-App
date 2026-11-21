import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { Container, Card, PhotoPicker, Avatar } from '../components'
import { profileUploadErrorMessage } from '../lib/profileUploadError'

export function ProfilePage() {
  const { user } = useAuth()
  const supabase = tryGetSupabaseClient()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [uploadedPreview, setUploadedPreview] = useState('')
  const [uploadedBlob, setUploadedBlob] = useState<Blob | null>(null)
  const [technicalError, setTechnicalError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      setName(data?.name ?? user.user_metadata.full_name ?? '')
      setAvatarUrl(data?.avatar_url ?? '')
      setAvatarKey(data?.avatar_key ?? '')
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
        if (!saveError) setTechnicalError('avatar_key ainda não existe no banco; aplique o patch 004-avatar-key.sql.')
      }
      if (saveError) throw saveError
      setAvatarUrl(savedAvatarUrl)
      setUploadedBlob(null)
      setUploadedPreview('')
      setMessage('Perfil atualizado.')
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(profileUploadErrorMessage(caught) ?? friendlySupabaseError(caught))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
    }
  }

  return (
    <Container>
      <h1>Meu perfil</h1>
      <Card>
        <form onSubmit={submit} className="form-stack">
          <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <Avatar
            name={name}
            uploadedUrl={uploadedPreview || (avatarUrl && /^https?:/.test(avatarUrl) ? avatarUrl : undefined)}
            googleUrl={user?.user_metadata.avatar_url}
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
            }}
          />
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
          {import.meta.env.DEV && technicalError && <p className="technical-error">Detalhe técnico: {technicalError}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="primary-button" type="submit">Salvar perfil</button>
        </form>
      </Card>
    </Container>
  )
}
