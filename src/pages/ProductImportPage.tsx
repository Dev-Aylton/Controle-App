import { useState, type ChangeEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { canManageCompany } from '../lib/uiPermissions'
import { tryGetSupabaseClient } from '../lib/supabase'
import { parseProductsCsv, type ParsedProductRow } from '../features/products/import/parseProductsCsv'
import { Container, Card, ActionButton } from '../components'
import { traduzirErro } from '../lib/errors'

export function ProductImportPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const allowed = canManageCompany(role, isAdmin) && role !== 'employee'
  const [rows, setRows] = useState<ParsedProductRow[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setResult('')
    try {
      const buffer = await file.arrayBuffer()
      let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
      setRows(parseProductsCsv(text))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível ler o arquivo.'))
    }
  }

  const importRows = async () => {
    const supabase = tryGetSupabaseClient()
    if (!supabase || !activeCompany) return
    const valid = rows.filter((row) => row.valid)
    const payload = valid.map((row) => ({
      name: row.name,
      sku: row.sku || null,
      category: row.category,
      unit: row.unit,
      min_stock: row.minStock,
      unit_cost: row.cost,
    }))
    const response = await supabase.rpc('import_products', { p_company_id: activeCompany.id, p_rows: payload })
    if (response.error) setError(traduzirErro(response.error, 'Não foi possível importar produtos.'))
    else setResult(JSON.stringify(response.data))
  }

  if (!allowed) return <Container><h1>Importar produtos</h1><Card><p>Somente administradores, proprietários e gerentes podem importar produtos.</p></Card></Container>

  const validCount = rows.filter((row) => row.valid).length
  return (
    <Container>
      <h1>Importar produtos</h1>
      <Card>
        <a className="secondary-button" href={'data:text/csv;charset=utf-8,nome;codigo;categoria;unidade;estoque_minimo;custo%0ACerveja;CEV-1;Bebidas;un;10;12,50'} download="modelo-produtos.csv">Baixar modelo CSV</a>
        <label className="file-upload-label">Arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={loadFile} />
        </label>
        <p className="field-help">Selecione um arquivo CSV para visualizar e importar os produtos.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && <p className="form-success" role="status">{result}</p>}
      </Card>
      {rows.length > 0 && (
        <Card>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Linha</th><th>Produto</th><th>Status</th><th>Detalhes</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.line}><td>{row.line}</td><td>{row.name || '(sem nome)'}</td><td>{row.valid ? 'Válida' : 'Inválida'}</td><td>{row.errors.join('; ')}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <ActionButton className="primary-button" disabled={validCount === 0} busyLabel="Importando..." onAction={importRows}>Importar {validCount} produto(s)</ActionButton>
        </Card>
      )}
    </Container>
  )
}
