import { useEffect, useRef, useState } from 'react'
import { Container, Card, Avatar } from '../components'
import { DemoProvider } from '../features/demo/DemoProvider'
import { useDemo } from '../features/demo/DemoContext'
import {
  canLaunchDemo, canUseSensitiveDemoData, registerDemoMovement, reverseDemoMovement,
  zeroDemoStock, finishDemoInventory, getDemoPurchaseItems, importDemoSales, undoDemoSales,
  registerDemoDoseMovement,
  DEMO_COMPANY_NAME,
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
      company: 'demo-company',
      environments: 'demo-environments',
      products: 'demo-products',
      movements: 'demo-movements',
      stock: 'demo-stock',
      inventory: 'demo-inventory',
      alerts: 'demo-alerts',
      purchases: 'demo-purchases',
      sales: 'demo-sales',
      salesPrices: 'demo-sales-prices',
      reports: 'demo-reports',
      audit: 'demo-audit',
      team: 'demo-team',
      profile: 'demo-profile',
      support: 'demo-support',
      offline: 'demo-offline',
      privacy: 'demo-privacy',
    }
    const id = sectionIds[key]
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="demo-page">
    <aside className="demo-desktop-sidebar" aria-label="Navegação da demonstração">
      <div className="demo-desktop-brand">
        <img className="demo-desktop-logo light-logo" src={wordmarkLight} alt="Controle-App" />
        <img className="demo-desktop-logo dark-logo" src={wordmarkDark} alt="Controle-App" />
      </div>
      <div className="demo-desktop-company">
        <strong>{DEMO_COMPANY_NAME}</strong>
        <span>{state.role === 'admin' ? 'Administrador' : state.role === 'owner' ? 'Proprietário' : state.role === 'manager' ? 'Gerente' : 'Funcionário'}</span>
      </div>
      <nav className="demo-desktop-nav" aria-label="Telas da demonstração">
        <button type="button" onClick={() => scrollToDemoSection('home')}>Início</button>
        {sensitive && <>
          <button type="button" onClick={() => scrollToDemoSection('company')}>Empresa</button>
          <button type="button" onClick={() => scrollToDemoSection('environments')}>Ambientes</button>
          <button type="button" onClick={() => scrollToDemoSection('products')}>Produtos</button>
        </>}
        <button type="button" onClick={() => scrollToDemoSection('movements')}>Movimentações</button>
        {sensitive && <button type="button" onClick={() => scrollToDemoSection('sales')}>Vendas</button>}
        {sensitive && <button type="button" onClick={() => scrollToDemoSection('salesPrices')}>Preços de venda</button>}
        <button type="button" onClick={() => scrollToDemoSection('stock')}>Saldo por ambiente</button>
        <button type="button" onClick={() => scrollToDemoSection('inventory')}>Inventário</button>
        {sensitive && <>
          <button type="button" onClick={() => scrollToDemoSection('alerts')}>Alertas</button>
          <button type="button" onClick={() => scrollToDemoSection('purchases')}>Lista de compras</button>
          <button type="button" onClick={() => scrollToDemoSection('reports')}>Relatórios</button>
          <button type="button" onClick={() => scrollToDemoSection('audit')}>Auditoria</button>
          <button type="button" onClick={() => scrollToDemoSection('team')}>Equipe</button>
        </>}
        <button type="button" onClick={() => scrollToDemoSection('profile')}>Meu perfil</button>
        <button type="button" onClick={() => scrollToDemoSection('support')}>Suporte</button>
        <button type="button" onClick={() => scrollToDemoSection('offline')}>Offline</button>
        <button type="button" onClick={() => scrollToDemoSection('privacy')}>Privacidade</button>
      </nav>
    </aside>
    <header className="demo-desktop-header" aria-label="Cabeçalho da demonstração">
      <select value={state.role} onChange={(event) => setRole(event.target.value as DemoRole)} aria-label="Cargo da demonstração no cabeçalho">
        <option value="owner">Proprietário</option>
        <option value="manager">Gerente</option>
        <option value="employee">Funcionário</option>
        <option value="admin">Administrador</option>
      </select>
      <button className="secondary-button" type="button" onClick={() => setAccountOpen(true)}>Minha conta</button>
    </header>
    <div className="demo-desktop-main">
    <Container>
      <section id="demo-home" data-demo-capture>
        <Card>
          <strong>Modo demonstração: dados fictícios, nada é salvo no servidor</strong>
          <div className="member-actions">
            <button className="secondary-button" type="button" onClick={reset}>Reiniciar demonstração</button>
            <button className="secondary-button demo-account-button" type="button" onClick={() => setAccountOpen(true)}>Minha conta</button>
          </div>
        </Card>
        <h1>{DEMO_COMPANY_NAME}</h1>
      </section>
      {sensitive && (
        <>
          <section id="demo-company" data-demo-capture>
            <Card>
              <h2>Empresa</h2>
              <div className="member-list">
                <article className="member-row"><div><strong>{DEMO_COMPANY_NAME}</strong><span>Ambientes fictícios • cadastro e telefone demonstrativos</span></div></article>
              </div>
              <div className="form-grid">
                <label>Nome da empresa<input value={DEMO_COMPANY_NAME} readOnly /></label>
                <label>Telefone<input value="(83) 99999-0000" readOnly /></label>
              </div>
              <button className="primary-button" type="button">Salvar dados fictícios</button>
            </Card>
          </section>
          <section id="demo-environments" data-demo-capture>
            <Card>
              <h2>Ambientes</h2>
              <div className="member-list">
                {DEMO_ENVIRONMENTS.map((environment) => (
                  <article className="member-row" key={environment.id}><div><strong>{environment.name}</strong><span>Ambiente ativo • saldo rastreável</span></div></article>
                ))}
              </div>
              <button className="primary-button" type="button">Adicionar ambiente fictício</button>
            </Card>
          </section>
        </>
      )}
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

      <section id="demo-stock" data-demo-capture>
          <Card>
            <h2>Saldo por ambiente</h2>
            {DEMO_ENVIRONMENTS.map((environment) => (
              <article className="member-row" key={environment.id}>
                <div><strong>{environment.name}</strong><span>{state.products.reduce((total, product) => total + product.balance, 0)} unidades fictícias no ambiente</span></div>
              </article>
            ))}
          </Card>
      </section>

      <section id="demo-purchases" data-demo-capture>
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

      {sensitive && (
        <section id="demo-sales" data-demo-capture>
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
        </section>
      )}

      {sensitive && (
        <section id="demo-sales-prices" data-demo-capture>
          <Card>
            <h2>Preços de venda e custos por ambiente</h2>
            <div className="member-list">
              {state.products.slice(0, 8).map((product) => (
                <article className="member-row" key={product.id}>
                  <div><strong>{product.name}</strong><span>Custo base R$ {product.cost.toFixed(2)} • preço por unidade fictício • preço por dose calculado</span></div>
                </article>
              ))}
            </div>
          </Card>
        </section>
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
        <section id="demo-reports" data-demo-capture>
          <Card>
            <h2>Relatórios fictícios</h2>
            <div className="form-grid">
              <Card><strong>Movimentações de hoje</strong><p>{state.movements.length}</p></Card>
              <Card><strong>Produtos ativos</strong><p>{state.products.length}</p></Card>
              <Card><strong>Ambientes</strong><p>{DEMO_ENVIRONMENTS.length}</p></Card>
              <Card><strong>Itens abaixo do mínimo</strong><p>{belowMinimum.length}</p></Card>
            </div>
            <button className="secondary-button" type="button">Exportar relatório fictício</button>
          </Card>
        </section>
      )}

      {sensitive && (
        <section id="demo-team" data-demo-capture>
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
        </section>
      )}

      {sensitive && (
        <section id="demo-audit" data-demo-capture>
        <Card>
          <h2>Auditoria fictícia</h2>
          {state.audit.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
        </Card>
        </section>
      )}

      <section id="demo-profile" data-demo-capture>
        <Card>
          <h2>Meu perfil</h2>
          <div className="member-identity">
            <Avatar name="Usuário de demonstração" size={64} />
            <span><strong>Usuário de demonstração</strong><small>{state.role === 'owner' ? 'Proprietário' : state.role === 'manager' ? 'Gerente' : state.role === 'employee' ? 'Funcionário' : 'Administrador'}</small></span>
          </div>
          <label>Nome<input value="Usuário de demonstração" readOnly /></label>
          <label>Foto <input type="file" /></label>
          <button className="primary-button" type="button">Salvar perfil fictício</button>
        </Card>
      </section>

      <section id="demo-support" data-demo-capture>
        <Card>
          <h2>Suporte privado fictício</h2>
          <div className="member-list">
            <article className="member-row"><div><strong>Atendimento de demonstração</strong><span>Conversa privada usuário-administrador</span></div></article>
            <article className="member-row"><div><strong>Você</strong><span>Como confirmar o estoque inicial?</span></div></article>
            <article className="member-row"><div><strong>Administrador</strong><span>Use o inventário inicial e revise a prévia antes de finalizar.</span></div></article>
          </div>
          <label>Mensagem<textarea value="" readOnly placeholder="Escreva uma mensagem fictícia" /></label>
          <button className="primary-button" type="button">Enviar mensagem fictícia</button>
        </Card>
      </section>

      <section id="demo-offline" data-demo-capture>
        <Card>
          <h2>Modo offline</h2>
          <p><strong>Fila local fictícia:</strong> 2 lançamentos aguardando conexão.</p>
          <div className="member-list">
            <article className="member-row"><div><strong>Entrada • Vodka Premium</strong><span>Pendente • 10 unidades</span></div></article>
            <article className="member-row"><div><strong>Transferência • Estoque Central → Espaço Jardim</strong><span>Pendente • 5 unidades</span></div></article>
          </div>
          <button className="secondary-button" type="button">Sincronizar ao reconectar</button>
        </Card>
      </section>

      <section id="demo-privacy" data-demo-capture>
        <Card>
          <h2>Privacidade e conta</h2>
          <p>Política versão 1.3.0 • Exportação de dados • Solicitação reversível de exclusão em até 90 dias.</p>
          <button className="secondary-button" type="button">Exportar dados fictícios</button>
          <button className="danger-button" type="button">Solicitar exclusão fictícia</button>
        </Card>
      </section>

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
    </Container>
    </div>
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
