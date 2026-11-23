import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listEnvironments, saveEnvironment } from '../features/environments/environmentService'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card, ActionButton, ContextHelp } from '../components'
import { traduzirErro } from '../lib/errors'

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
      setError(traduzirErro(caught, 'Não foi possível carregar ambientes.'))
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
      setError(traduzirErro(caught, 'Não foi possível salvar o ambiente. Confira o nome e tente novamente.'))
    }
  }

  return (
    <Container>
      <h1>Ambientes</h1>
      <ContextHelp
        title="O que é um ambiente?"
        description="Ambiente representa um local onde o estoque é guardado ou usado, como estoque central, cozinha, bar principal ou camarote."
        steps={[
          'Crie um ambiente para cada local físico que precisa de controle.',
          'Atribua movimentações e contagens ao ambiente correto.',
          'Desative ambientes antigos sem apagar o histórico.',
        ]}
        result="Um produto pode ter saldos diferentes em cada ambiente."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {canManage && (
        <Card>
          <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ambiente de destino" required /></label>
            <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional: estoque de saída direta" /></label>
            <ActionButton
              className="primary-button"
              busyLabel="Salvando..."
              confirmMessage={editingId ? 'Confirmar a alteração deste ambiente?' : `Criar o ambiente "${name.trim()}"?`}
              onAction={() => save({ preventDefault: () => undefined } as FormEvent)}
            >
              {editingId ? 'Salvar ambiente' : 'Criar ambiente'}
            </ActionButton>
          </form>
        </Card>
      )}
      <Card>
        {items.length === 0 && <p>Nenhum ambiente cadastrado ainda. Crie o primeiro ambiente.</p>}
        <div className="member-list">
          {items.map((item) => (
            <article className="member-row" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.active ? 'Ativo' : 'Inativo'}</span></div>
              {canManage && (
                <div className="member-actions">
                  <button className="secondary-button" type="button" onClick={() => { setEditingId(item.id); setName(item.name); setDescription(item.description ?? '') }}>Editar</button>
                  <ActionButton className="danger-button" busyLabel="Alterando..." confirmMessage={item.active ? 'Desativar este ambiente?' : undefined} onAction={async () => {
                    if (!activeCompany) return
                    await saveEnvironment(activeCompany.id, item.id, item.name, item.description ?? '', !item.active)
                    await load()
                  }}>{item.active ? 'Desativar' : 'Reativar'}</ActionButton>
                </div>
              )}
            </article>
          ))}
        </div>
      </Card>
    </Container>
  )
}
