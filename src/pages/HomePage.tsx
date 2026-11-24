import { useBreakpoint } from '../hooks/useBreakpoint'
import { Avatar, Container } from '../components'
import { Grid } from '../components/Grid'
import { Card } from '../components/Card'
import { useCompanies } from '../features/company/company-context'
import { useEffect, useState } from 'react'
import { tryGetSupabaseClient } from '../lib/supabase'
import { getLowStockAlerts, getNegativeBalances, getPendingLossReasons, getInventoryValuation, getDashboardStockMetrics } from '../features/management/management'
import { NavLink } from 'react-router-dom'
import { TutorialModal } from '../features/tutorial/TutorialModal'
import { dismissTutorial, getTutorialStorage, wasTutorialDismissed } from '../features/tutorial/tutorial'
import { listPurchaseRequests, type PurchaseRequest } from '../features/management/purchaseRequests'

export function HomePage() {
  useBreakpoint()
  const { activeCompany, role, isAdmin } = useCompanies()
  const activeCompanyId = activeCompany?.id
  const [activeProducts, setActiveProducts] = useState<number | null>(null)
  const [stockValue, setStockValue] = useState<number | null>(null)
  const [stockValueErrorCompanyId, setStockValueErrorCompanyId] = useState<string | null>(null)
  const [movementsToday, setMovementsToday] = useState<number | null>(null)
  const [lowCount, setLowCount] = useState(0)
  const [zeroCount, setZeroCount] = useState(0)
  const [neverMovedCount, setNeverMovedCount] = useState(0)
  const [negativeCount, setNegativeCount] = useState(0)
  const [pendingLossCount, setPendingLossCount] = useState(0)
  const [employeeMovementsToday, setEmployeeMovementsToday] = useState<number | null>(null)
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([])
  const [environmentCount, setEnvironmentCount] = useState(0)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const tutorialRole = isAdmin ? 'admin' : role ?? 'sem-vinculo'
  const [tutorialDismissed, setTutorialDismissed] = useState(() => wasTutorialDismissed(getTutorialStorage(), tutorialRole))
  useEffect(() => {
    if (!activeCompanyId) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) {
      queueMicrotask(() => setDashboardError('O aplicativo não conseguiu consultar o resumo da empresa.'))
      return
    }
    queueMicrotask(() => setDashboardError(''))
    void Promise.resolve(supabase.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', activeCompanyId)
      .eq('active', true))
      .then((productCount) => {
      if (productCount.error) throw productCount.error
      setActiveProducts(productCount.count ?? 0)
      if (isAdmin || role === 'owner' || role === 'manager') {
        void Promise.all([
          getLowStockAlerts(activeCompanyId),
          getNegativeBalances(activeCompanyId),
          getPendingLossReasons(activeCompanyId),
          getDashboardStockMetrics(activeCompanyId),
        ]).then(([low, negative, pending, metrics]) => {
          setLowCount(low.length)
          setNegativeCount(negative.length)
          setPendingLossCount(pending.length)
          setZeroCount(metrics.products_without_stock)
          setNeverMovedCount(metrics.products_without_movements)
        }).catch(() => undefined)
        void getInventoryValuation(activeCompanyId)
          .then((value) => {
            setStockValue(value)
            setStockValueErrorCompanyId(null)
          })
          .catch(() => setStockValueErrorCompanyId(activeCompanyId))
        void supabase.from('environments').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId).eq('active', true)
          .then((result) => setEnvironmentCount(result.count ?? 0))
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        void supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId).gte('created_at', start.toISOString()).then((result) => setMovementsToday(result.count ?? 0))
      }
      if (role === 'employee' && !isAdmin) {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        void Promise.resolve(supabase
          .from('stock_movements')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', activeCompanyId)
          .gte('created_at', start.toISOString()))
          .then((result) => setEmployeeMovementsToday(result.count ?? 0))
          .catch(() => setEmployeeMovementsToday(null))
        void listPurchaseRequests(activeCompanyId)
          .then(setPurchaseRequests)
          .catch(() => setPurchaseRequests([]))
      }
    }).catch(() => {
      setActiveProducts(null)
      setDashboardError('Não foi possível carregar todos os indicadores. Tente atualizar esta tela.')
    })
  }, [activeCompanyId, isAdmin, role])
  const showStockValue = isAdmin || role === 'owner' || role === 'manager'
  const displayedActiveProducts = activeCompanyId ? activeProducts : null
  const displayedStockValue = activeCompanyId ? stockValue : null
  const stockValueFailed = Boolean(activeCompanyId && stockValueErrorCompanyId === activeCompanyId)
  const displayedMovementsToday = activeCompanyId ? movementsToday : null
  const displayedLowCount = activeCompanyId ? lowCount : 0
  const displayedZeroCount = activeCompanyId ? zeroCount : 0
  const displayedNeverMovedCount = activeCompanyId ? neverMovedCount : 0
  const displayedNegativeCount = activeCompanyId ? negativeCount : 0
  const displayedPendingLossCount = activeCompanyId ? pendingLossCount : 0
  return (
    <Container>
      <header className="company-home-header" aria-label="Empresa selecionada">
        {activeCompany ? (
          <Avatar
            name={activeCompany.name}
            storageBucket="company-photos"
            storagePath={activeCompany.photo}
            shape="square"
            size={112}
            alt={`Logo de ${activeCompany.name}`}
            companyLogoFallback
            fallbackUrl="/Controle-App/company-placeholder.svg"
          />
        ) : (
          <img
            className="company-placeholder-logo"
            src="/Controle-App/company-placeholder.svg"
            alt="Empresa não selecionada"
          />
        )}
        <div className="company-home-heading">
          <h1>{activeCompany?.name ?? 'Selecione uma empresa'}</h1>
        </div>
      </header>
      {!tutorialDismissed && (
        <Card>
          <p>Conhecer como usar o aplicativo?</p>
          <div className="member-actions">
            <button className="secondary-button" type="button" onClick={() => setTutorialOpen(true)}>Ver tutorial</button>
            <button className="secondary-button" type="button" onClick={() => {
              dismissTutorial(getTutorialStorage(), tutorialRole)
              setTutorialDismissed(true)
            }}>Não mostrar novamente</button>
          </div>
        </Card>
      )}
      {activeCompanyId && dashboardError && <p className="form-error" role="alert">{dashboardError}</p>}
      {activeCompanyId && showStockValue && (environmentCount === 0 || activeProducts === 0) && (
        <Card>
          <h2>Primeiros passos</h2>
          <p>Complete o cadastro inicial para começar o controle com segurança.</p>
          <div className="home-onboarding-list">
            {environmentCount === 0 && (
              <NavLink className="dashboard-action-button" to="/ambientes">
                <span>1. Criar o primeiro ambiente</span><span aria-hidden="true">→</span>
              </NavLink>
            )}
            {activeProducts === 0 && (
              <NavLink className="dashboard-action-button" to="/produtos">
                <span>2. Cadastrar produtos ou insumos</span><span aria-hidden="true">→</span>
              </NavLink>
            )}
            {environmentCount > 0 && activeProducts !== 0 && (
              <NavLink className="dashboard-action-button" to="/movimentacoes">
                <span>3. Registrar o estoque inicial</span><span aria-hidden="true">→</span>
              </NavLink>
            )}
          </div>
        </Card>
      )}
      {activeCompanyId && showStockValue && (
        <Card>
          <h2>Fluxo diário do estoque</h2>
          <p>Oriente a equipe nessa ordem para manter os saldos rastreáveis.</p>
          <div className="home-onboarding-list">
            <NavLink className="dashboard-action-button" to="/movimentacoes">
              <span>Antes: retirar ou comprar diretamente no ambiente de destino</span><span aria-hidden="true">→</span>
            </NavLink>
            <NavLink className="dashboard-action-button" to="/vendas/importar">
              <span>Durante: registrar vendas e consumir no ambiente correto</span><span aria-hidden="true">→</span>
            </NavLink>
            <NavLink className="dashboard-action-button" to="/inventario">
              <span>Depois: devolver o restante e conciliar o ambiente</span><span aria-hidden="true">→</span>
            </NavLink>
          </div>
        </Card>
      )}
      {activeCompanyId && role === 'employee' && !isAdmin && (
        <Card>
          <h2>Meu fluxo do dia</h2>
          <p>Use estas ações para executar o turno sem precisar aguardar aprovação de uma solicitação.</p>
          <div className="home-onboarding-list">
            <NavLink className="dashboard-action-button" to="/movimentacoes">
              <span>Registrar entrada, saída ou perda</span><span aria-hidden="true">→</span>
            </NavLink>
            <NavLink className="dashboard-action-button" to="/estoque/saldo">
              <span>Conferir onde cada insumo está registrado</span><span aria-hidden="true">→</span>
            </NavLink>
            <NavLink className="dashboard-action-button" to="/inventario">
              <span>Contar ou conferir um ambiente</span><span aria-hidden="true">→</span>
            </NavLink>
            <NavLink className="dashboard-action-button" to="/compras">
              <span>Solicitar reposição sem bloquear o turno</span><span aria-hidden="true">→</span>
            </NavLink>
          </div>
        </Card>
      )}
      <Grid>
        <Card><p><strong>Produtos ativos</strong><br />{displayedActiveProducts ?? '—'}</p></Card>
        {activeCompanyId && role === 'employee' && !isAdmin && (
          <>
            <Card>
              <p><strong>Movimentações minhas hoje</strong><br />{employeeMovementsToday ?? '—'}</p>
            </Card>
            <Card>
              <p><strong>Solicitações de reposição</strong><br />{purchaseRequests.length}</p>
              <small>
                {purchaseRequests.filter((request) => request.status === 'pendente').length} aguardando gestão
                {' • '}
                {purchaseRequests.filter((request) => request.status === 'aprovada').length} aprovadas
              </small>
            </Card>
          </>
        )}
        {showStockValue && (
          <>
          <Card>
            <div className="dashboard-metric">
              <strong>Abaixo do mínimo</strong>
              <span className="dashboard-metric-value">{displayedLowCount}</span>
              <NavLink className="dashboard-action-button" to="/alertas">
                <span>Ver central de alertas</span><span className="dashboard-action-arrow" aria-hidden="true">→</span>
              </NavLink>
            </div>
          </Card>
          <Card>
            <p><strong>Produtos sem saldo</strong><br />{displayedZeroCount}</p>
            <small>Saldo total igual a zero, somando todos os ambientes.</small>
          </Card>
          <Card><p><strong>Nunca movimentados</strong><br />{displayedNeverMovedCount}</p><small>Produtos ativos sem entrada, saída, perda ou transferência registrada.</small></Card>
          <Card><p><strong>Saldos negativos</strong><br />{displayedNegativeCount}</p></Card>
          <Card><p><strong>Perdas sem motivo</strong><br />{displayedPendingLossCount}</p></Card>
          <Card><p><strong>Valor de estoque parado</strong><br />{stockValueFailed ? 'Falha ao carregar' : displayedStockValue === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(displayedStockValue)}<br /><small>{stockValueFailed ? 'Não foi possível consultar a avaliação do estoque.' : displayedStockValue === null ? 'Cadastre os custos dos produtos com saldo para calcular o valor completo.' : 'Calculado com custo por ambiente ou custo base.'}</small></p></Card>
          <Card><p><strong>Movimentações de hoje</strong><br />{displayedMovementsToday ?? '—'}</p></Card>
          </>
        )}
      </Grid>
      {tutorialOpen && <TutorialModal role={role} isAdmin={isAdmin} onClose={() => setTutorialOpen(false)} />}
    </Container>
  )
}
