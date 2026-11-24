import { useState, type ChangeEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { canManageCompany } from '../lib/uiPermissions'
import { tryGetSupabaseClient } from '../lib/supabase'
import { parseProductRows, type ParsedProductRow } from '../features/products/import/parseProductsCsv'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { traduzirErro } from '../lib/errors'
import {
  generateProductSku,
  prepareProductImportResolutions,
  type ImportExistingProduct,
  type ImportProductMatch,
  type ProductImportResolution,
} from '../features/products/import/productImportResolution'

type ResolvedImportRow = ParsedProductRow & ProductImportResolution

export function ProductImportPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const allowed = canManageCompany(role, isAdmin) && role !== 'employee'
  const [rows, setRows] = useState<ParsedProductRow[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [resolvedRows, setResolvedRows] = useState<ResolvedImportRow[]>([])
  const [excludedLines, setExcludedLines] = useState<Set<number>>(new Set())

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!activeCompany) {
      setError('Selecione uma empresa antes de importar produtos.')
      return
    }
    const companyId = activeCompany.id
    setError('')
    setResult('')
    setExcludedLines(new Set())
    try {
      if (/\.xlsx?$/.test(file.name.toLowerCase())) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const catalogRows: Record<string, unknown>[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' })
          if (String(matrix[0]?.[0] ?? '').trim() !== 'Controle-App'
            || String(matrix[1]?.[0] ?? '').trim() !== 'Modelo oficial de produtos') {
            continue
          }
          const headerIndex = matrix.findIndex((row) =>
            row.includes('nome')
            && row.includes('codigo')
            && row.includes('unidade'),
          )
          if (headerIndex < 0) continue
          const header = matrix[headerIndex].map((cell) => String(cell ?? '').trim())
          for (const row of matrix.slice(headerIndex + 1)) {
            if (!row.some((cell) => String(cell ?? '').trim() !== '')) continue
            catalogRows.push(Object.fromEntries(header.map((title, columnIndex) => [title, row[columnIndex] ?? ''])))
          }
        }
        if (catalogRows.length === 0) throw new Error('Este arquivo não contém uma tabela oficial de produtos do Controle-App.')
        const supabase = tryGetSupabaseClient()
        if (!supabase) throw new Error('Supabase não configurado.')
        const existingResult = await supabase
          .from('products')
          .select('id,name,sku,unit,volume_ml,dose_ml,weight_g')
          .eq('company_id', companyId)
          .eq('active', true)
        if (existingResult.error) throw existingResult.error
        const existingNames = (existingResult.data ?? []).map((item) => item.name)
        const existingSkus = (existingResult.data ?? []).map((item) => item.sku ?? '')
        const existingProducts: ImportExistingProduct[] = (existingResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          volumeMl: item.volume_ml,
          doseMl: item.dose_ml,
          weightG: item.weight_g ?? null,
        }))
        const existingVariants = existingProducts.map((item) => ({
          name: item.name,
          unit: item.unit,
          volumeMl: item.volumeMl,
          doseMl: item.doseMl,
        }))
        const uniqueCatalogRows = new Map<string, Record<string, unknown>>()
        for (const row of catalogRows) {
          const skuKey = Object.keys(row).find((key) => /^(cód\.?|codig|codigo|sku|code)$/i.test(key.trim()))
          const nameKey = Object.keys(row).find((key) => /^(produto|nome|name)$/i.test(key.trim()))
          const unitKey = Object.keys(row).find((key) => /^unidade$/i.test(key.trim()))
          const volumeKey = Object.keys(row).find((key) => /^(volume|volume_ml|volume ml)$/i.test(key.trim()))
          const doseKey = Object.keys(row).find((key) => /^(dose|dose_ml|dose ml)$/i.test(key.trim()))
          const sku = skuKey ? String(row[skuKey] ?? '').trim().toLowerCase() : ''
          const name = nameKey ? String(row[nameKey] ?? '').trim().toLowerCase() : ''
          const unit = unitKey ? String(row[unitKey] ?? '').trim().toLowerCase() : ''
          const volume = volumeKey ? String(row[volumeKey] ?? '').trim() : ''
          const dose = doseKey ? String(row[doseKey] ?? '').trim() : ''
          const key = sku ? `sku:${sku}` : name ? `variant:${name}|${unit}|${volume}|${dose}` : ''
          if (key && !uniqueCatalogRows.has(key)) uniqueCatalogRows.set(key, row)
        }
        const parsed = parseProductRows([...uniqueCatalogRows.values()], existingNames, existingSkus, existingVariants)
        setRows(parsed)
        setResolvedRows(prepareProductImportResolutions(parsed, existingProducts))
      } else if (/\.csv$/i.test(file.name)) {
        let text = new TextDecoder('utf-8', { fatal: false }).decode(await file.arrayBuffer())
        if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
        text = text.replace(/^\uFEFF/, '')
        if (!text.includes('Modelo oficial de produtos')) {
          throw new Error('Use somente o modelo CSV oficial gerado pelo Controle-App.')
        }
        const lines = text.split(/\r?\n/)
        const headerIndex = lines.findIndex((line) => {
          const normalized = line.toLowerCase()
          return normalized.includes('nome') && normalized.includes('codigo') && normalized.includes('unidade')
        })
        if (headerIndex < 0) throw new Error('O cabeçalho oficial de produtos não foi encontrado.')
        const tableText = lines.slice(headerIndex).join('\n')
        const table = Papa.parse<Record<string, unknown>>(tableText, {
          header: true,
          skipEmptyLines: true,
          delimiter: tableText.includes(';') ? ';' : ',',
        })
        if (table.errors.length > 0) throw new Error('Não foi possível interpretar o modelo CSV de produtos.')
        const supabase = tryGetSupabaseClient()
        if (!supabase) throw new Error('Supabase não configurado.')
        const existingResult = await supabase
          .from('products')
          .select('id,name,sku,unit,volume_ml,dose_ml,weight_g')
          .eq('company_id', companyId)
          .eq('active', true)
        if (existingResult.error) throw existingResult.error
        const existingNames = (existingResult.data ?? []).map((item) => item.name)
        const existingSkus = (existingResult.data ?? []).map((item) => item.sku ?? '')
        const existingVariants = (existingResult.data ?? []).map((item) => ({
          name: item.name,
          unit: item.unit,
          volumeMl: item.volume_ml,
          doseMl: item.dose_ml,
        }))
        const existingProducts: ImportExistingProduct[] = (existingResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          volumeMl: item.volume_ml,
          doseMl: item.dose_ml,
          weightG: item.weight_g ?? null,
        }))
        const parsed = parseProductRows(table.data, existingNames, existingSkus, existingVariants)
        setRows(parsed)
        setResolvedRows(prepareProductImportResolutions(parsed, existingProducts))
      } else {
        throw new Error('Use um modelo XLSX ou CSV oficial gerado pelo Controle-App.')
      }
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível ler o arquivo.'))
    }
  }

  const importRows = async () => {
    const supabase = tryGetSupabaseClient()
    if (!supabase || !activeCompany) return
    const sourceRows = resolvedRows.length > 0 ? resolvedRows : rows.map((row) => ({
      ...row,
      action: null,
      matchedProductId: null,
      resolvedSku: row.sku,
      resolvedUnit: row.unit,
      resolvedCategory: row.category,
      resolvedVolumeMl: row.volumeMl,
      resolvedDoseMl: row.doseMl,
      resolvedWeightG: row.weight,
      resolvedCost: row.cost,
      reviewed: false,
      matches: [],
    } satisfies ParsedProductRow & ProductImportResolution))
    const invalidUnresolved = sourceRows.filter((row) =>
      !row.valid && !excludedLines.has(row.line),
    )
    if (invalidUnresolved.length > 0) {
      setError(`Corrija ou remova explicitamente ${invalidUnresolved.length} linha(s) inválida(s) antes de importar.`)
      return
    }
    const unresolved = sourceRows.filter((row) =>
      row.valid && !excludedLines.has(row.line) && (
        row.action === null
        || (row.action === 'update' && !row.matchedProductId)
      )
    )
    if (unresolved.length > 0) {
      setError(`Revise ${unresolved.length} linha(s) antes de importar. Escolha atualizar um item existente ou cadastrar uma variante nova.`)
      return
    }
    const valid = sourceRows.filter((row) =>
      row.valid
      && !excludedLines.has(row.line)
      && row.action !== null,
    )
    const payload = valid.map((row) => ({
      import_action: row.action,
      existing_product_id: row.action === 'update' ? row.matchedProductId : null,
      name: row.name,
      sku: row.resolvedSku || null,
      category: row.resolvedCategory,
      unit: row.resolvedUnit,
      min_stock: row.minStock,
      max_stock: row.maxStock,
      volume_ml: row.resolvedVolumeMl,
      dose_ml: row.resolvedDoseMl,
      weight_g: row.resolvedWeightG,
      unit_cost: row.resolvedCost,
    }))
    const response = await supabase.rpc('import_products', { p_company_id: activeCompany.id, p_rows: payload })
    if (response.error) setError(traduzirErro(response.error, 'Não foi possível importar os produtos. Confira o arquivo e tente novamente.'))
    else if (response.data) {
      const resultData = response.data as { created?: number; updated?: number; ignored?: number }
      setResult(`Importação concluída: ${resultData.created ?? 0} criado(s), ${resultData.updated ?? 0} atualizado(s) e ${resultData.ignored ?? 0} ignorado(s).`)
    } else {
      setResult('Importação concluída.')
    }
  }

  if (!allowed) return <Container><h1>Importar produtos</h1><Card><p>Somente administradores, proprietários e gerentes podem importar produtos.</p></Card></Container>

  const sourceRows = resolvedRows.length > 0
    ? resolvedRows
    : rows.map((row) => ({
      ...row,
      action: null,
      matchedProductId: null,
      resolvedSku: row.sku,
      resolvedUnit: row.unit,
      resolvedCategory: row.category,
      resolvedVolumeMl: row.volumeMl,
      resolvedDoseMl: row.doseMl,
      resolvedWeightG: row.weight,
      resolvedCost: row.cost,
      reviewed: false,
      matches: [],
    } satisfies ParsedProductRow & ProductImportResolution))
  const validCount = sourceRows.filter((row) =>
    row.valid && !excludedLines.has(row.line),
  ).length
  const reviewedCount = sourceRows.filter((row) =>
    excludedLines.has(row.line)
    || (row.action === 'create' || (row.action === 'update' && row.matchedProductId)),
  ).length

  const chooseCreate = (line: number) => {
    setResolvedRows((current) => current.map((row) => row.line === line
      ? {
        ...row,
        action: 'create',
        matchedProductId: null,
        resolvedSku: row.resolvedSku || generateProductSku(row.name, row.resolvedUnit, row.resolvedVolumeMl, row.resolvedWeightG),
        reviewed: true,
      }
      : row))
  }

  const chooseUpdate = (line: number, match: ImportProductMatch) => {
    setResolvedRows((current) => current.map((row) => row.line === line
      ? {
        ...row,
        action: 'update',
        matchedProductId: match.id,
        resolvedSku: row.resolvedSku || match.sku || generateProductSku(row.name, row.resolvedUnit, row.resolvedVolumeMl, row.resolvedWeightG),
        resolvedUnit: row.resolvedUnit || match.unit,
        resolvedVolumeMl: row.resolvedVolumeMl ?? match.volumeMl,
        resolvedDoseMl: row.resolvedDoseMl ?? match.doseMl,
        resolvedWeightG: row.resolvedWeightG ?? match.weightG,
        reviewed: true,
      }
      : row))
  }
  return (
    <Container>
      <h1>Importar produtos</h1>
      <PageGuide
        purpose="Cadastrar ou atualizar muitos produtos de uma vez sem perder correspondências."
        doNext="Baixe o modelo, preencha uma linha por variante e revise cada correspondência antes de importar."
        result="Produtos válidos entram no catálogo e variantes semelhantes não são gravadas por engano."
        roleNote="Somente proprietários, gerentes e administradores podem importar."
      />
      <ContextHelp
        title="Como funciona a importação de produtos?"
        description="A planilha inicia ou atualiza o catálogo da empresa. O sistema compara nome, SKU, unidade e variante antes de sugerir uma ação."
        steps={[
          'Baixe ou visualize o modelo da planilha.',
          'Preencha nome, unidade, categoria e medidas.',
          'Na prévia, escolha atualizar um item existente ou cadastrar outro novo.',
          'Confirme somente depois de revisar todas as linhas.',
        ]}
        result="Nenhum item é gravado sem que dados válidos e decisões de correspondência estejam confirmados."
      />
      <Card>
        <div className="member-actions">
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}modelo-produtos.xlsx`} target="_blank" rel="noreferrer">Visualizar modelo XLSX</a>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}modelo-produtos.xlsx`} download="modelo-produtos.xlsx">Baixar modelo XLSX</a>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}modelo-produtos.csv`} download="modelo-produtos.csv">Baixar modelo CSV</a>
        </div>
        <label className="file-upload-label">Modelo XLSX ou CSV oficial
          <input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={loadFile} />
        </label>
        <p className="field-help">Selecione um modelo oficial XLSX ou CSV gerado pelo Controle-App. O sistema compara nome, SKU, unidade e variante antes de permitir a importação.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && <p className="form-success" role="status">{result}</p>}
      </Card>
      {rows.length > 0 && (
        <Card>
          <div className="product-import-review-header">
            <div>
              <small>Prévia inteligente</small>
              <strong>{reviewedCount} de {sourceRows.length} linha(s) resolvida(s)</strong>
            </div>
            <p>O app não grava automaticamente. Confirme cada item novo ou correspondência existente.</p>
          </div>
          <div className="product-import-review-list">
            {sourceRows.map((row) => (
              <article className={`product-import-review-row${row.valid ? '' : ' is-invalid'}`} key={row.line}>
                <header>
                  <div>
                    <small>Linha {row.line}</small>
                    <strong>{row.name || '(nome não informado)'}</strong>
                  </div>
                  <span>{row.valid ? 'Dados válidos' : 'Dados incompletos'}</span>
                </header>
                {!row.valid ? (
                  excludedLines.has(row.line) ? (
                    <div>
                      <p className="form-success">Linha removida explicitamente desta importação.</p>
                      <button className="secondary-button" type="button" onClick={() => setExcludedLines((current) => {
                        const next = new Set(current)
                        next.delete(row.line)
                        return next
                      })}>Restaurar linha</button>
                    </div>
                  ) : (
                    <div>
                      <p className="form-error">{row.errors.join('; ')}</p>
                      <button className="secondary-button" type="button" onClick={() => setExcludedLines((current) => new Set(current).add(row.line))}>
                        Remover esta linha explicitamente
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <dl>
                      <div><dt>Código/SKU</dt><dd>{row.resolvedSku || 'Não informado — será gerado por decisão sua'}</dd></div>
                      <div><dt>Unidade</dt><dd>{row.resolvedUnit || 'Não informada'}</dd></div>
                      <div><dt>Volume / peso</dt><dd>{row.resolvedVolumeMl ? `${row.resolvedVolumeMl} ml` : row.resolvedWeightG ? `${row.resolvedWeightG} g` : 'Não informado'}</dd></div>
                      <div><dt>Custo</dt><dd>{row.resolvedCost == null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.resolvedCost)}</dd></div>
                    </dl>
                    {row.matches.length > 0 && (
                      <div className="product-import-matches">
                        <strong>Possíveis correspondências já cadastradas</strong>
                        {row.matches.map((match) => (
                          <button
                            className={row.matchedProductId === match.id ? 'secondary-button is-selected' : 'secondary-button'}
                            type="button"
                            key={match.id}
                            onClick={() => chooseUpdate(row.line, match)}
                          >
                            <span>
                              <strong>{match.name}</strong>
                              <small>{match.reason} • {match.sku || 'sem SKU'} • {match.unit}{match.volumeMl ? ` • ${match.volumeMl} ml` : match.weightG ? ` • ${match.weightG} g` : ''}</small>
                            </span>
                            <span>Atualizar</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="product-import-actions">
                      <button className={row.action === 'create' ? 'primary-button is-selected' : 'secondary-button'} type="button" onClick={() => chooseCreate(row.line)}>
                        Cadastrar como novo item
                      </button>
                      {row.action === 'create' && <p>O SKU sugerido será <strong>{row.resolvedSku}</strong>. Você pode revisar no formulário antes da importação.</p>}
                      {row.action === 'update' && <p>O item selecionado será atualizado. SKU e variante permanecem sob seu controle.</p>}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          <ActionButton
            className="primary-button"
            disabled={
              validCount === 0
              || reviewedCount !== sourceRows.length
              || sourceRows.some((row) => !row.valid && !excludedLines.has(row.line))
            }
            busyLabel="Importando..."
            confirmMessage={`Confirmar a importação revisada de ${validCount} produto(s)? Linhas aprovadas serão criadas ou atualizadas conforme suas decisões.`}
            onAction={importRows}
          >
            Importar {validCount} produto(s)
          </ActionButton>
        </Card>
      )}
    </Container>
  )
}
