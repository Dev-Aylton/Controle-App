import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton, PageGuide } from '../components'

export function JoinCompanyPage() {
  const supabase = tryGetSupabaseClient()
  const navigate = useNavigate()
  const { refresh } = useCompanies()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setError('Não foi possível conectar ao servidor. Recarregue a página e tente novamente.')
    setLoading(true)
    setError('')
    try {
      await supabase.rpc('join_company_with_code', { p_code: code.trim() })
      await refresh(true)
      setSuccess(true)
      setCode('')
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <h1>Entrar com código</h1>
      <PageGuide
        purpose="Vincular sua conta a uma empresa existente."
        doNext="Digite exatamente o código informado pelo proprietário ou gerente e confirme."
        result="Os ambientes, produtos e ações disponíveis aparecerão conforme seu cargo."
        roleNote="Não compartilhe o código fora da equipe autorizada."
      />
      <Card>
        {success ? (
          <div className="join-company-success" role="status">
            <h2>Vínculo realizado</h2>
            <p>Você entrou como funcionário da empresa e já pode consultar produtos, saldo e registrar movimentações conforme as regras do seu ambiente.</p>
            <ActionButton className="primary-button" onAction={async () => navigate('/')}>Abrir o aplicativo</ActionButton>
          </div>
        ) : (
          <form onSubmit={(event) => event.preventDefault()} className="form-stack">
            <label>Código da empresa
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, '').replace(/(.{5})(.{5})/, '$1-$2'))} placeholder="XXXXX-XXXXX" required />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <ActionButton className="primary-button" disabled={loading || code.trim().length < 5} busyLabel="Entrando..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>Entrar na empresa</ActionButton>
          </form>
        )}
      </Card>
      {!success && (
        <Card>
          <h2>Como funciona</h2>
          <ol className="join-company-steps">
            <li><strong>1. Crie sua conta</strong><span>Use e-mail/senha ou Google.</span></li>
            <li><strong>2. Solicite o código</strong><span>Peça ao proprietário ou gerente da empresa.</span></li>
            <li><strong>3. Informe o código</strong><span>A conta será vinculada como funcionário imediatamente.</span></li>
          </ol>
          <p className="field-help">O código pode ser trocado pela gestão. A troca impede o uso do código antigo por contas novas.</p>
        </Card>
      )}
    </Container>
  )
}
