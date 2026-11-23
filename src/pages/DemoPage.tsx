import { useEffect, useRef, useState } from 'react'
import { Container, Card, Avatar } from '../components'
import { DemoProvider } from '../features/demo/DemoProvider'
import { useDemo } from '../features/demo/DemoContext'
import {
  canLaunchDemo, canUseSensitiveDemoData, registerDemoMovement, reverseDemoMovement,
  zeroDemoStock, finishDemoInventory, getDemoPurchaseItems, importDemoSales, undoDemoSales,
  registerDemoDoseMovement,
  DEMO_ENVIRONMENTS,
} from '../features/demo/demoData'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'
import type { DemoRole } from '../features/demo/demoData'
import { applyTheme, getSavedTheme, type ThemeMode } from '../lib/theme'
import { NavigationIcon } from '../components/NavigationIcon'
import { getMobileNavItems, getNavigationIconLabel } from '../components/mobileNavigation'
import wordmarkLight from '../../docs/logos/opcao-a/wordmark-light.svg'
import wordmarkDark from '../../docs/logos/opcao-a/wordmark-dark.svg'

function DemoContent() {
  const { state, setRole, reset, deactivateEmployee, rotateCode } = useDemo()
  const [productId, setProductId] = useState(state.products[0]?.id ?? '')
  const [environmentId, setEnvironmentId] = useState<(typeof DEMO_ENVIRONMENTS)[number]['id']>(DEMO_ENVIRONMENTS[0].id)
  const [type, setType] = useState<'entrada' | 'saida' | 'perda'>('entrada')
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [zeroReason, setZeroReason] = useState('')
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({})
  const [doseMode, setDoseMode] = useState(false)
  const [doses, setDoses] = useState(1)
  const [accountOpen, setAccountOpen] = useState(false)
  const [demoMoreOpen, setDemoMoreOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme)
  const accountRef = useRef<HTMLElement>(null)

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => {
    if (!accountOpen) return
    const previous = document.activeElement as HTMLElement | null
    accountRef.current?.querySelector<HTMLElement>('button,select')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
      if (event.key !== 'Tab' || !accountRef.current) return
      const items = [...accountRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),select')]
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
      if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [accountOpen])

  const launch = () => {
    try {
      if (doseMode) registerDemoDoseMovement(state, productId, environmentId, type, doses)
      else registerDemoMovement(state, productId, environmentId, type, quantity)
      setMessage('Movimentação fictícia registrada.')
    } catch (caught) {
      setMessage(traduzirErro(caught, 'Não foi possível registrar.'))
    }
  }

  const sensitive = canUseSensitiveDemoData(state.role)
  const belowMinimum = state.products.filter((product) => product.balance < product.minStock)
  const zero = state.products.filter((product) => product.balance === 0)
  const negative = state.products.filter((product) => product.balance < 0)
  const pendingLosses = state.movements.filter((movement) => movement.type === 'perda' && !movement.lossReasonId)
  const demoRole = state.role === 'admin' ? null : state.role
  const demoMobileItems = getMobileNavItems(demoRole, state.role === 'admin')

  const scrollToDemoSection = (key: string) => {
    const sectionIds: Record<string, string> = {
      home: 'demo-home',
      movements: 'demo-movements',
      stock: 'demo-stock',
      inventory: 'demo-inventory',
      alerts: 'demo-alerts',
    }
    const id = sectionIds[key]
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="demo-page">
    <Container>
      <section id="demo-home" data-demo-capture>
        <Card>
          <strong>Modo demonstração: dados fictícios, nada é salvo no servidor</strong>
          <div className="member-actions">
            <button className="secondary-button" type="button" onClick={reset}>Reiniciar demonstração</button>
            <button className="secondary-button demo-account-button" type="button" onClick={() => setAccountOpen(true)}>Minha conta</button>
          </div>
        </Card>
        <h1>Bar Demonstração</h1>
      </section>
      <Card>
        <label>Entrar como
          <select value={state.role} onChange={(event) => setRole(event.target.value as DemoRole)}>
            <option value="admin">Admin</option>
            <option value="owner">Proprietário</option>
            <option value="manager">Gerente</option>
            <option value="employee">Funcionário</option>
          </select>
        </label>
        <p>Código fictício: DEMO-{String(state.codeVersion).padStart(2, '0')}</p>
        <button className="secondary-button" type="button" onClick={rotateCode}>Trocar código fictício</button>
        {state.role === 'owner' && (
          <button className="danger-button" type="button" onClick={deactivateEmployee}>Desativar funcionário fictício</button>
        )}
      </Card>

      {sensitive ? (
        <section id="demo-alerts" data-demo-capture>
          <h2>Alertas fictícios</h2>
          <div className="form-grid">
            <Card><strong>Abaixo do mínimo</strong><p>{belowMinimum.length}</p></Card>
            <Card><strong>Sem estoque</strong><p>{zero.length}</p></Card>
            <Card><strong>Saldo negativo</strong><p>{negative.length}</p></Card>
            <Card><strong>Perdas sem motivo</strong><p>{pendingLosses.length}</p></Card>
          </div>
        </section>
      ) : (
        <Card><p>Visão restrita do funcionário: sem saldo, custo, mínimo, máximo ou histórico.</p></Card>
      )}

      {sensitive && (
        <section id="demo-products" data-demo-capture>
          <Card>
            <h2>Produtos fictícios</h2>
            <p>Catálogo demonstrativo, sem dados de empresas reais.</p>
            <div className="member-list">
              {state.products.slice(0, 8).map((product) => (
                <article className="member-row" key={product.id}>
                  <div><strong>{product.name}</strong><span>Saldo {product.balance} {product.unit} • mínimo {product.minStock}</span></div>
                </article>
              ))}
            </div>
          </Card>
        </section>
      )}

      {canLaunchDemo(state.role) && state.employeeActive && (
        <Card>
          <h2>Lançamento fictício</h2>
          {message && <p role="status">{message}</p>}
          <div className="form-grid">
            <label>Ambiente
              <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value as (typeof DEMO_ENVIRONMENTS)[number]['id'])}>
                {DEMO_ENVIRONMENTS.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
              </select>
            </label>
            <label>Produto
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                {state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label>Tipo
              <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="perda">Perda</option>
              </select>
            </label>
            <label>Quantidade<input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
            {type !== 'perda' && (
              <label className="check-label"><input type="checkbox" checked={doseMode} onChange={(event) => setDoseMode(event.target.checked)} /> Informar em doses</label>
            )}
            {doseMode && <label>Doses<input type="number" min="1" step="1" value={doses} onChange={(event) => setDoses(Number(event.target.value))} /></label>}
          </div>
          <button className="primary-button" type="button" onClick={launch}>Registrar</button>
        </Card>
      )}

      {!state.employeeActive && state.role === 'employee' && (
        <Card><p>Este funcionário fictício foi desativado e perdeu o acesso.</p></Card>
      )}

      {sensitive && (
        <section id="demo-stock" data-demo-capture>
          <Card>
            <h2>Mapa de produtos e compras</h2>
          {state.salesMap.map((row) => (
            <p key={row.externalName}>{row.externalName} → {state.products.find((product) => product.id === row.productId)?.name}</p>
          ))}
          <div className="member-list">
            {getDemoPurchaseItems(state).map((item) => (
              <article className="member-row" key={item.productId}>
                <div><strong>{item.name}</strong><span>Saldo {item.balance} • mínimo {item.minimum} • sugerido {item.suggestion}</span></div>
              </article>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={() => downloadCsv(
            `Bar-Demonstracao-compras-${new Date().toISOString().slice(0,10)}.csv`,
            [['Produto','Saldo','Mínimo','Sugestão'], ...getDemoPurchaseItems(state).map((item) => [item.name,item.balance,item.minimum,item.suggestion])],
          )}>Exportar lista de compras</button>
          </Card>
        </section>
      )}

      {sensitive && (
        <section id="demo-inventory" data-demo-capture>
          <Card>
            <h2>Inventário cego fictício</h2>
          {state.products.slice(0, 6).map((product) => (
            <label key={product.id}>{product.name}
              <input type="number" min="0" step="0.001" value={inventoryCounts[product.id] ?? ''} onChange={(event) => setInventoryCounts((current) => ({ ...current, [product.id]: Number(event.target.value) }))} />
            </label>
          ))}
          {(state.role === 'owner' || state.role === 'manager') && (
            <button className="primary-button" type="button" onClick={() => {
              try { finishDemoInventory(state, state.role, inventoryCounts); setMessage('Inventário fictício finalizado.') } catch (caught) { setMessage(traduzirErro(caught, 'Não foi possível finalizar.')) }
            }}>Finalizar inventário</button>
          )}
          </Card>
        </section>
      )}

      {sensitive && (
        <Card>
          <h2>Importação de vendas fictícia</h2>
          <button className="primary-button" type="button" onClick={() => {
            try {
              const batchId = importDemoSales(state, [{ externalName: 'Vodka Premium', productId: state.products[0].id, quantity: 19, saleType: 'dose' }])
              setMessage(`Importação fictícia aplicada: ${batchId}`)
            } catch (caught) { setMessage(traduzirErro(caught, 'Não foi possível importar.')) }
          }}>Aplicar prévia fictícia</button>
          {state.salesBatches.map((batch) => (
            <article className="member-row" key={batch.id}>
              <div><strong>{batch.label}</strong><span>{batch.status === 'applied' ? 'Aplicada' : 'Desfeita'} • quantidade {batch.quantity}</span></div>
              {batch.status === 'applied' && <button className="danger-button" type="button" onClick={() => {
                try { undoDemoSales(state, batch.id); setMessage('Importação fictícia desfeita.') } catch (caught) { setMessage(traduzirErro(caught, 'Não foi possível desfazer.')) }
              }}>Desfazer</button>}
            </article>
          ))}
        </Card>
      )}

      {(state.role === 'owner' || state.role === 'manager') && (
        <Card>
          <h2>Zeragem fictícia</h2>
          <label>Motivo<input value={zeroReason} onChange={(event) => setZeroReason(event.target.value)} /></label>
          <button className="danger-button" type="button" disabled={!zeroReason.trim()} onClick={() => {
            try {
              const adjusted = zeroDemoStock(state, null, zeroReason, state.role)
              setMessage(`Zeragem confirmada: ${adjusted} produto(s).`)
              setZeroReason('')
            } catch (caught) { setMessage(traduzirErro(caught, 'Não foi possível zerar.')) }
          }}>Confirmar zeragem em duas etapas</button>
        </Card>
      )}

      {sensitive && (
        <Card>
          <h2>Equipe fictícia</h2>
          <p><strong>Ana Souza</strong> • Proprietária • Ativa</p>
          <p><strong>Bruno Lima</strong> • Gerente • Ativo</p>
          <p><strong>Carla Dias</strong> • Funcionária • {state.employeeActive ? 'Ativa' : 'Desativada'}</p>
          {(state.role === 'owner' || state.role === 'manager') && (
            <div className="member-actions">
              <button className="secondary-button" type="button" onClick={() => setMessage('Funcionário fictício promovido a gerente.')}>Promover funcionário</button>
              {state.role === 'owner' && <button className="danger-button" type="button" onClick={deactivateEmployee}>Desativar funcionário</button>}
            </div>
          )}
        </Card>
      )}

      {sensitive && (
        <Card>
          <h2>Auditoria fictícia</h2>
          {state.audit.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
        </Card>
      )}

      {sensitive && (
        <section id="demo-movements" data-demo-capture>
          <Card>
            <h2>Movimentações fictícias recentes</h2>
            {state.movements.slice(0, 8).map((movement) => (
              <article className="member-row" key={movement.id}>
                <div><strong>{movement.type}</strong><span>{state.products.find((product) => product.id === movement.productId)?.name}</span></div>
                {(state.role === 'owner' || state.role === 'manager') && movement.type !== 'estorno' && (
                  <button className="secondary-button" type="button" onClick={() => {
                    try {
                      reverseDemoMovement(state, movement.id, state.role, state.employeeActive)
                      setMessage('Movimentação estornada.')
                    } catch (caught) {
                      setMessage(traduzirErro(caught, 'Não foi possível estornar.'))
                    }
                  }}>Estornar</button>
                )}
              </article>
            ))}
          </Card>
        </section>
      )}
    </Container>
    <nav className="bottom-nav demo-bottom-nav" aria-label="Navegação da demonstração">
      {demoMobileItems.map((item) => item.key === 'more'
        ? (
          <button
            key={item.key}
            className={`nav-link-button bottom-nav-more${demoMoreOpen ? ' active' : ''}`}
            type="button"
            aria-expanded={demoMoreOpen}
            aria-haspopup="dialog"
            onClick={() => setDemoMoreOpen(true)}
          >
            <span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span>
            <span>Mais</span>
          </button>
        )
        : (
          <button
            key={item.key}
            className="nav-link-button"
            type="button"
            onClick={() => scrollToDemoSection(item.key)}
          >
            <span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span>
            <span>{item.label}</span>
          </button>
        ))}
    </nav>
    {demoMoreOpen && (
      <div className="mobile-menu-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setDemoMoreOpen(false)
      }}>
        <aside className="mobile-sidebar" role="dialog" aria-modal="true" aria-label="Menu lateral">
          <div className="mobile-sidebar-heading">
            <div className="mobile-sidebar-brand">
              <img className="mobile-wordmark light-logo" src={wordmarkLight} alt="Controle-App" />
              <img className="mobile-wordmark dark-logo" src={wordmarkDark} alt="Controle-App" />
            </div>
            <button className="secondary-button" type="button" onClick={() => setDemoMoreOpen(false)}>Fechar</button>
          </div>
          <button className="mobile-sidebar-profile" type="button" onClick={() => { setDemoMoreOpen(false); setAccountOpen(true) }}>
            <Avatar name="Usuário de demonstração" size={44} />
            <span><strong>Minha conta</strong><small>{state.role === 'admin' ? 'Administrador' : state.role === 'owner' ? 'Proprietário' : state.role === 'manager' ? 'Gerente' : 'Funcionário'}</small></span>
          </button>
          <nav className="mobile-sidebar-nav" aria-label="Navegação lateral móvel">
            <button type="button" onClick={() => { setDemoMoreOpen(false); scrollToDemoSection('home') }}>
              <span className="nav-icon" aria-hidden="true"><NavigationIcon label="Início" /></span><span>Início</span>
            </button>
            {sensitive && (
              <>
                <button type="button" onClick={() => { setDemoMoreOpen(false); scrollToDemoSection('stock') }}>
                  <span className="nav-icon" aria-hidden="true"><NavigationIcon label="Saldo por ambiente" /></span><span>Saldo</span>
                </button>
                <button type="button" onClick={() => { setDemoMoreOpen(false); scrollToDemoSection('inventory') }}>
                  <span className="nav-icon" aria-hidden="true"><NavigationIcon label="Inventário" /></span><span>Inventário</span>
                </button>
              </>
            )}
            <button type="button" onClick={() => { setDemoMoreOpen(false); scrollToDemoSection('movements') }}>
              <span className="nav-icon" aria-hidden="true"><NavigationIcon label="Movimentações" /></span><span>Movimentações</span>
            </button>
            {sensitive && (
              <button type="button" onClick={() => { setDemoMoreOpen(false); scrollToDemoSection('alerts') }}>
                <span className="nav-icon" aria-hidden="true"><NavigationIcon label="Alertas" /></span><span>Alertas</span>
              </button>
            )}
          </nav>
        </aside>
      </div>
    )}
    {accountOpen && (
      <div className="account-drawer-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAccountOpen(false)
      }}>
        <aside className="account-drawer demo-account-drawer" ref={accountRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Minha conta — demonstração">
          <header className="account-drawer-header">
            <h2>Minha conta</h2>
            <button className="secondary-button" type="button" onClick={() => setAccountOpen(false)}>Fechar</button>
          </header>
          <section className="account-drawer-section">
            <div className="member-identity">
              <Avatar name="Usuário de demonstração" size={64} />
              <span><strong>Usuário de demonstração</strong><small>{state.role === 'admin' ? 'Administrador' : state.role === 'owner' ? 'Proprietário' : state.role === 'manager' ? 'Gerente' : 'Funcionário'}</small></span>
            </div>
            <p className="account-section-description">Perfil fictício. Nenhuma sessão ou dado pessoal é usado neste modo.</p>
          </section>
          <section className="account-drawer-section">
            <h3 className="account-drawer-section-title">Preferências</h3>
            <label>Tema
              <select aria-label="Tema do modo demonstração" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>
                <option value="light">Claro</option><option value="dark">Escuro</option>
              </select>
            </label>
          </section>
          <p className="account-section-description">Modo demonstração: dados fictícios e operações apenas em memória.</p>
        </aside>
      </div>
    )}
    </main>
  )
}

export function DemoPage() {
  return <DemoProvider><DemoContent /></DemoProvider>
}
