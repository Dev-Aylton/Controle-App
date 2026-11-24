import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { traduzirErro } from '../lib/errors'
import { recordTechnicalError } from '../lib/diagnostics'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card, PhotoPicker, Avatar, ActionButton, ContextHelp, PageGuide } from '../components'

function companyLogoPath(companyId: string, blob: Blob) {
  const extensions: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
  const extension = extensions[blob.type]
  if (!extension) throw new Error('Formato da imagem não suportado.')
  return `companies/${companyId}/logo-${crypto.randomUUID()}.${extension}`
}

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
  const [suspensionReason, setSuspensionReason] = useState('')
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

  useEffect(() => {
    queueMicrotask(() => {
      setPendingLogoBlob(null)
      setPendingLogoPreview('')
    })
  }, [activeCompany?.id])

  useEffect(() => () => {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
  }, [pendingLogoPreview])

  useEffect(() => () => {
    if (createLogoPreview) URL.revokeObjectURL(createLogoPreview)
  }, [createLogoPreview])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeCompany) return
    setError('')
    setMessage('')
    setTechnicalError('')
    try {
      let photoPath = photo
      if (pendingLogoBlob) {
        photoPath = companyLogoPath(activeCompany.id, pendingLogoBlob)
        const { error: uploadError } = await supabase.storage
          .from('company-photos')
          .upload(photoPath, pendingLogoBlob, { contentType: pendingLogoBlob.type })
        if (uploadError) throw uploadError
      }
      const { error: updateError } = await supabase
        .from('companies')
        .update({ name, phone: phone || null, photo: photoPath || null })
        .eq('id', activeCompany.id)
        .select('id')
        .single()
      if (updateError) throw updateError
      setPhoto(photoPath)
      setPendingLogoBlob(null)
      setPendingLogoPreview('')
      await refresh(true)
      setMessage('Empresa atualizada.')
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(traduzirErro(caught, 'Não foi possível salvar as informações da empresa.'))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
      recordTechnicalError('CompanyPage.submit', caught)
      throw caught
    }
  }

  const createCompany = async () => {
    setError('')
    setMessage('')
    setTechnicalError('')
    if (!supabase) {
      setError('Não foi possível conectar ao servidor. Recarregue a página e tente novamente.')
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
      if (!data?.id) throw new Error('Empresa criada, mas não foi possível concluir a configuração.')

      let photoPath: string | null = null
      let photoFailed = false
      if (createLogoBlob) {
        photoPath = companyLogoPath(data.id, createLogoBlob)
        const { error: uploadError } = await supabase.storage
          .from('company-photos')
          .upload(photoPath, createLogoBlob, { contentType: createLogoBlob.type })
        if (uploadError) {
          photoFailed = true
          setTechnicalError(uploadError.message)
          recordTechnicalError('CompanyPage.createCompany.logoUpload', uploadError)
        } else {
          const { error: photoError } = await supabase
            .from('companies')
            .update({ photo: photoPath })
            .eq('id', data.id)
            .select('id')
            .single()
          if (photoError) {
            photoFailed = true
            setTechnicalError(photoError.message)
            recordTechnicalError('CompanyPage.createCompany.logoSave', photoError)
          }
        }
      }

      const { data: code, error: codeError } = await supabase.rpc('rotate_company_code', {
        p_company_id: data.id,
      })
      if (codeError) throw codeError
      if (!code) throw new Error('Empresa criada, mas o código de acesso ainda não está disponível.')

      await refresh(true)
      selectCompany(data.id)
      if (photoFailed) setError('Empresa criada, mas não foi possível salvar a logo. Tente novamente nesta página.')
      else setMessage('Empresa criada.')
      navigate('/empresa', { replace: true })
    } catch (caught) {
      const record = caught as { message?: string; code?: string }
      setError(traduzirErro(caught, 'Não foi possível criar a empresa. Confira os dados e tente novamente.'))
      setTechnicalError(`${record.message ?? String(caught)}${record.code ? ` [${record.code}]` : ''}`)
      recordTechnicalError('CompanyPage.createCompany', caught)
    }
  }

  const suspendCompany = async () => {
    if (!supabase || !activeCompany) return
    setError('')
    setMessage('')
    try {
      const { error: suspendError } = await supabase.rpc('suspend_company', {
        p_company_id: activeCompany.id,
        p_reason: suspensionReason,
      })
      if (suspendError) throw suspendError
      setSuspensionReason('')
      setMessage('Empresa suspensa. Operações estão bloqueadas até a reativação.')
      await refresh(true)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível suspender a empresa.'))
    }
  }

  const reactivateCompany = async () => {
    if (!supabase || !activeCompany) return
    setError('')
    setMessage('')
    try {
      const { error: reactivateError } = await supabase.rpc('reactivate_company', {
        p_company_id: activeCompany.id,
      })
      if (reactivateError) throw reactivateError
      setMessage('Empresa reativada. Operações foram liberadas.')
      await refresh(true)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível reativar a empresa.'))
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
      <PageGuide
        purpose="Identificar a empresa em documentos, relatórios, tela inicial e auditoria."
        doNext="Revise nome, telefone e logo e use Salvar empresa após as alterações."
        result="A seleção da empresa ficará clara para todos os membros autorizados."
        roleNote={canEdit ? 'Você pode alterar os dados da empresa.' : 'Você pode consultar os dados, mas não alterá-los.'}
      />
      <ContextHelp
        title="Dados que representam a operação"
        description="Nome, telefone e logo ajudam a identificar a empresa em PDF, relatórios e auditoria."
        steps={[
          'Use o nome oficial do estabelecimento.',
          'Informe um telefone de contato atualizado.',
          'Envie uma logo legível para documentos e modelos.',
        ]}
        result="Os dados identificam corretamente todos os registros da empresa."
      />
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
            <ActionButton className="primary-button" busyLabel="Salvando..." confirmMessage="Confirmar as alterações dos dados da empresa?" onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>Salvar empresa</ActionButton>
          </form>
        ) : (
          <div className="data-list"><p><strong>Nome:</strong> {name}</p><p><strong>Telefone:</strong> {phone || 'Não informado'}</p></div>
        )}
      </Card>
      {isAdmin && (
        <Card>
          <h2>Status administrativo da empresa</h2>
          {activeCompany.active ? (
            <>
              <p>Estado atual: <strong>Ativa</strong></p>
              <label>Motivo da suspensão
                <input value={suspensionReason} onChange={(event) => setSuspensionReason(event.target.value)} placeholder="Ex.: manutenção ou inadimplência" />
              </label>
              <ActionButton
                className="danger-button"
                busyLabel="Suspendendo..."
                disabled={!suspensionReason.trim()}
                confirmMessage={`Suspender a empresa "${activeCompany.name}"? Todos os membros perderão acesso às operações até a reativação.`}
                requireText={activeCompany.name}
                onAction={suspendCompany}
              >
                Suspender empresa
              </ActionButton>
            </>
          ) : (
            <>
              <p>Estado atual: <strong>Suspensa</strong></p>
              {activeCompany.suspended_reason && <p>Motivo: {activeCompany.suspended_reason}</p>}
              {activeCompany.suspended_at && <p>Suspensa em: {new Date(activeCompany.suspended_at).toLocaleString('pt-BR')}</p>}
              <ActionButton
                className="primary-button"
                busyLabel="Reativando..."
                confirmMessage={`Reativar a empresa "${activeCompany.name}" e liberar as operações dos membros?`}
                onAction={reactivateCompany}
              >
                Reativar empresa
              </ActionButton>
            </>
          )}
        </Card>
      )}
    </Container>
  )
}
