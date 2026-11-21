import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { useCompanies } from '../features/company/company-context'
import { Container, Card } from '../components'

export function JoinCompanyPage() {
  const supabase = tryGetSupabaseClient()
  const navigate = useNavigate()
  const { refresh } = useCompanies()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setError('Supabase não configurado.')
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
      <Card>
        <form onSubmit={submit} className="form-stack">
          <label>Código da empresa
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX" required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar na empresa'}
          </button>
        </form>
      </Card>
    </Container>
  )
}
