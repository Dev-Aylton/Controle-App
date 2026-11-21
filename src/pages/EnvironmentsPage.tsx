import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listEnvironments, saveEnvironment } from '../features/environments/environmentService'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card } from '../components'

export function EnvironmentsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const activeCompanyId = activeCompany?.id
  const canManage = canManageCompany(role, isAdmin)
  const [items, setItems] = useState<Array<{ id: string; name: string; description: string | null; active: boolean }>>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      setItems(await listEnvironments(activeCompanyId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar ambientes.')
    }
  }, [activeCompanyId])

  useEffect(() => {
    if (activeCompanyId) queueMicrotask(() => { void load() })
  }, [activeCompanyId, load])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeCompany || !name.trim()) return
    try {
      await saveEnvironment(activeCompany.id, editingId, name, description)
      setName('')
      setDescription('')
      setEditingId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o ambiente.')
    }
  }

  return (
    <Container>
      <h1>Ambientes</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {canManage && (
        <Card>
          <form className="form-stack" onSubmit={save}>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <button className="primary-button" type="submit">{editingId ? 'Salvar ambiente' : 'Criar ambiente'}</button>
          </form>
        </Card>
      )}
      <Card>
        <div className="member-list">
          {items.map((item) => (
            <article className="member-row" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.active ? 'Ativo' : 'Inativo'}</span></div>
              {canManage && (
                <div className="member-actions">
                  <button className="secondary-button" type="button" onClick={() => { setEditingId(item.id); setName(item.name); setDescription(item.description ?? '') }}>Editar</button>
                  <button className="danger-button" type="button" onClick={async () => {
                    if (!activeCompany) return
                    await saveEnvironment(activeCompany.id, item.id, item.name, item.description ?? '', !item.active)
                    await load()
                  }}>{item.active ? 'Desativar' : 'Reativar'}</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </Card>
    </Container>
  )
}
