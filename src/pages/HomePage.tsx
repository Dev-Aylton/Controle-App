import { useBreakpoint } from '../hooks/useBreakpoint'
import { Avatar, Container } from '../components'
import { Grid } from '../components/Grid'
import { Card } from '../components/Card'
import { useCompanies } from '../features/company/company-context'
import { useEffect, useState } from 'react'
import { listProductData } from '../features/products/productService'
import { tryGetSupabaseClient } from '../lib/supabase'
import { getLowStockAlerts, getNegativeBalances, getPendingLossReasons, getEnvironmentLowStock, getInventoryValuation } from '../features/management/management'
import { NavLink } from 'react-router-dom'
import { TutorialModal } from '../features/tutorial/TutorialModal'
import { dismissTutorial, getTutorialStorage, wasTutorialDismissed } from '../features/tutorial/tutorial'

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
  const [negativeCount, setNegativeCount] = useState(0)
  const [pendingLossCount, setPendingLossCount] = useState(0)
  const [environmentCount, setEnvironmentCount] = useState(0)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const tutorialRole = isAdmin ? 'admin' : role ?? 'sem-vinculo'
  const [tutorialDismissed, setTutorialDismissed] = useState(() => wasTutorialDismissed(getTutorialStorage(), tutorialRole))
  useEffect(() => {
    if (!activeCompanyId) return
    void listProductData(activeCompanyId, isAdmin || role === 'owner' || role === 'manager').then((data) => {
      setActiveProducts(data.products.filter((product) => product.active).length)
      if (isAdmin || role === 'owner' || role === 'manager') {
        void Promise.all([
          getLowStockAlerts(activeCompanyId),
          getNegativeBalances(activeCompanyId),
          getPendingLossReasons(activeCompanyId),
          getEnvironmentLowStock(activeCompanyId),
        ]).then(([low, negative, pending, environments]) => {
          setLowCount(low.length)
          setNegativeCount(negative.length)
          setPendingLossCount(pending.length)
          setZeroCount(environments.filter((row) => Number(row.balance) === 0).length)
        }).catch(() => undefined)
        void getInventoryValuation(activeCompanyId)
          .then((value) => {
            setStockValue(value)
            setStockValueErrorCompanyId(null)
          })
          .catch(() => setStockValueErrorCompanyId(activeCompanyId))
        const supabase = tryGetSupabaseClient()
        if (supabase) {
          void supabase.from('environments').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId).eq('active', true)
            .then((result) => setEnvironmentCount(result.count ?? 0))
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          void supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId).gte('created_at', start.toISOString()).then((result) => setMovementsToday(result.count ?? 0))
        }
      }
    }).catch(() => setActiveProducts(0))
  }, [activeCompanyId, isAdmin, role])
  const showStockValue = isAdmin || role === 'owner' || role === 'manager'
  const displayedActiveProducts = activeCompanyId ? activeProducts : null
  const displayedStockValue = activeCompanyId ? stockValue : null
  const stockValueFailed = Boolean(activeCompanyId && stockValueErrorCompanyId === activeCompanyId)
  const displayedMovementsToday = activeCompanyId ? movementsToday : null
  const displayedLowCount = activeCompanyId ? lowCount : 0
  const displayedZeroCount = activeCompanyId ? zeroCount : 0
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
      <Grid>
        <Card><p><strong>Produtos ativos</strong><br />{displayedActiveProducts ?? '—'}</p></Card>
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
          <Card><p><strong>Sem estoque</strong><br />{displayedZeroCount}</p></Card>
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
