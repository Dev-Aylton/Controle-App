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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setError('Não foi possível conectar ao servidor. Recarregue a página e tente novamente.')
    setLoading(true)
    setError('')
    try {
      await supabase.rpc('join_company_with_code', { p_code: code })
      await refresh()
      navigate('/')
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
        <form onSubmit={(event) => event.preventDefault()} className="form-stack">
          <label>Código da empresa
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX" required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <ActionButton className="primary-button" disabled={loading} busyLabel="Entrando..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>Entrar na empresa</ActionButton>
        </form>
      </Card>
    </Container>
  )
}
