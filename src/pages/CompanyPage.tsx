import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { recordTechnicalError } from '../lib/diagnostics'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card, PhotoPicker, Avatar, ActionButton } from '../components'

export function CompanyPage() {
  const supabase = tryGetSupabaseClient()
  const { activeCompany, role, isAdmin, refresh, selectCompany } = useCompanies()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [photo, setPhoto] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [, setTechnicalError] = useState('')
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createLogoBlob, setCreateLogoBlob] = useState<Blob | null>(null)
  const [createLogoPreview, setCreateLogoPreview] = useState('')
  const [pendingLogoBlob, setPendingLogoBlob] = useState<Blob | null>(null)
  const [pendingLogoPreview, setPendingLogoPreview] = useState('')
  const canEdit = canManageCompany(role, isAdmin)

  const maskPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
  }

  useEffect(() => {
    queueMicrotask(() => {
      setName(activeCompany?.name ?? '')
      setPhone(activeCompany?.phone ?? '')
      setPhoto(activeCompany?.photo ?? '')
    })
  }, [activeCompany])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeCompany) return
    setError('')
    setMessage('')
    setTechnicalError('')
    try {
      let photoPath = photo
      if (pendingLogoBlob) {
        photoPath = `companies/${activeCompany.id}/logo.webp`
        const { error: uploadError } = await supabase.storage
          .from('company-photos')
          .upload(photoPath, pendingLogoBlob, { upsert: true, contentType: 'image/webp' })
        if (uploadError) throw uploadError
      }
      const { error: updateError } = await supabase
        .from('companies')
        .update({ name, phone: phone || null, photo: photoPath || null })
        .eq('id', activeCompany.id)
      if (updateError) throw updateError
      setPhoto(photoPath)
      setMessage('Empresa atualizada.')
      await refresh()
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(friendlySupabaseError(caught))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
      recordTechnicalError('CompanyPage.submit', caught)
    }
  }

  const createCompany = async () => {
    setError('')
    setMessage('')
    setTechnicalError('')
    if (!supabase) {
      setError('Supabase não configurado. Preencha as variáveis de ambiente.')
      return
    }
    if (!createName.trim()) {
      setError('Informe o nome da empresa.')
      return
    }
    try {
      const { data, error: createError } = await supabase
        .from('companies')
        .insert({
          name: createName.trim(),
          phone: createPhone.replace(/\D/g, '') || null,
        })
        .select('*')
        .single()
      if (createError) throw createError
      if (!data?.id) throw new Error('A criação não retornou o identificador da empresa.')

      let photoPath: string | null = null
      if (createLogoBlob) {
        photoPath = `companies/${data.id}/logo.webp`
        const { error: uploadError } = await supabase.storage
          .from('company-photos')
          .upload(photoPath, createLogoBlob, { upsert: true, contentType: 'image/webp' })
        if (uploadError) {
          setTechnicalError(uploadError.message)
        } else {
          const { error: photoError } = await supabase
            .from('companies')
            .update({ photo: photoPath })
            .eq('id', data.id)
          if (photoError) setTechnicalError(photoError.message)
        }
      }

      const { data: code, error: codeError } = await supabase.rpc('rotate_company_code', {
        p_company_id: data.id,
      })
      if (codeError) throw codeError
      if (!code) throw new Error('A empresa foi criada, mas o código não foi gerado.')

      await refresh(true)
      selectCompany(data.id)
      setMessage('Empresa criada.')
      navigate('/empresa', { replace: true })
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(friendlySupabaseError(caught))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
      recordTechnicalError('CompanyPage.createCompany', caught)
    }
  }

  if (!activeCompany) {
    return (
      <Container>
        <h1>Criar empresa</h1>
        {isAdmin ? (
          <Card>
            <form onSubmit={(event) => event.preventDefault()} className="form-stack">
              <label>Nome da empresa *
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} required />
              </label>
              <label>Telefone
                <input value={createPhone} onChange={(event) => setCreatePhone(maskPhone(event.target.value))} inputMode="tel" placeholder="(11) 99999-9999" />
              </label>
              {createLogoPreview && <img className="company-photo-preview" src={createLogoPreview} alt="Prévia da logo" />}
              <PhotoPicker
                shape="square"
                label="Escolher logo"
                onConfirm={(blob, previewUrl) => {
                  setCreateLogoBlob(blob)
                  setCreateLogoPreview(previewUrl)
                }}
              />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
              <ActionButton className="primary-button" disabled={!createName.trim()} busyLabel="Criando..." onAction={createCompany}>Criar empresa</ActionButton>
            </form>
          </Card>
        ) : (
          <Card><p>Você ainda não possui uma empresa ativa.</p></Card>
        )}
      </Container>
    )
  }

  return (
    <Container>
      <h1>Empresa</h1>
      <Card>
        <Avatar
          name={name}
          uploadedUrl={pendingLogoPreview || undefined}
          storageBucket="company-photos"
          storagePath={photo || null}
          shape="square"
          size={160}
          alt={`Logo de ${name}`}
          companyLogoFallback
        />
        {canEdit ? (
          <form onSubmit={(event) => event.preventDefault()} className="form-stack">
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <PhotoPicker
              shape="square"
              label="Trocar logo"
              onConfirm={(blob, previewUrl) => {
                setPendingLogoBlob(blob)
                setPendingLogoPreview(previewUrl)
              }}
            />
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-success" role="status">{message}</p>}
            <ActionButton className="primary-button" busyLabel="Salvando..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>Salvar empresa</ActionButton>
          </form>
        ) : (
          <div className="data-list"><p><strong>Nome:</strong> {name}</p><p><strong>Telefone:</strong> {phone || 'Não informado'}</p></div>
        )}
      </Card>
    </Container>
  )
}
