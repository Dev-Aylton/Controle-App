import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Tables } from '../../lib/database.types'
import { tryGetSupabaseClient } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { CompanyContext } from './company-context'
import { friendlySupabaseError } from '../../lib/errors'
import { SessionLoadDeduper } from '../../lib/sessionLoad'
import { canSelectCompany } from './companyVisibility'

type Membership = Tables<'memberships'>
type Company = Tables<'companies'>
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth()
  const userId = user?.id ?? null
  const supabase = tryGetSupabaseClient()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    () => localStorage.getItem('controle-app-company'),
  )
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef(new SessionLoadDeduper())
  const loadPromiseRef = useRef<Promise<void> | null>(null)
  const [validatedUserId, setValidatedUserId] = useState<string | null>(null)

  const refresh = useCallback(async (force = false) => {
    while (loadPromiseRef.current) {
      await loadPromiseRef.current
    }
    if (!supabase || !userId) {
      setMemberships([])
      setCompanies([])
      setDataLoaded(true)
      loaderRef.current.clear()
      return
    }
    if (!loaderRef.current.shouldLoad(userId, force)) return
    setLoading(true)
    setError(null)
    const load = (async () => {
      try {
        const { data: adminRows, error: adminError } = await supabase
          .from('app_admins')
          .select('user_id')
          .eq('user_id', userId)
          .limit(1)
        if (adminError) throw adminError
        setIsAdmin(Boolean(adminRows?.length))

        if (adminRows?.length) {
          const [{ data: adminCompanies, error: companiesError }, { data: memberRows, error: membershipsError }] = await Promise.all([
            supabase.from('companies').select('*').order('name'),
            supabase.from('memberships').select('*').eq('user_id', userId).eq('active', true),
          ])
          if (companiesError) throw companiesError
          if (membershipsError) throw membershipsError
          setCompanies(adminCompanies ?? [])
          setMemberships(memberRows ?? [])
        } else {
          const { data: memberRows, error: membershipsError } = await supabase
            .from('memberships')
            .select('*')
            .eq('user_id', userId)
            .eq('active', true)
          if (membershipsError) throw membershipsError
          const rows = memberRows ?? []
          const employeeIds = rows
            .filter((item) => item.role === 'employee')
            .map((item) => item.code_id)
            .filter((id): id is string => Boolean(id))
          let validEmployeeRows = rows.filter((item) => item.role !== 'employee')
          if (employeeIds.length) {
            const { data: activeCodes, error: codesError } = await supabase
              .from('company_codes')
              .select('id')
              .eq('active', true)
              .in('id', employeeIds)
            if (codesError) throw codesError
            const activeCodeIds = new Set((activeCodes ?? []).map((item) => item.id))
            validEmployeeRows = [
              ...validEmployeeRows,
              ...rows.filter((item) => item.role === 'employee' && item.code_id && activeCodeIds.has(item.code_id)),
            ]
          }
          setMemberships(validEmployeeRows)
          const ids = validEmployeeRows.map((item) => item.company_id)
          if (ids.length) {
            const { data: companyRows, error: companiesError } = await supabase
              .from('companies')
              .select('*')
              .in('id', ids)
            if (companiesError) throw companiesError
            setCompanies(companyRows ?? [])
          } else {
            setCompanies([])
          }
        }
        setValidatedUserId(userId)
      } catch (caught) {
        setError(caught instanceof Error
          ? friendlySupabaseError(caught)
          : 'Não foi possível carregar empresas.')
      } finally {
        loaderRef.current.finish(userId)
        setLoading(false)
        setDataLoaded(true)
      }
    })()
    loadPromiseRef.current = load
    try {
      await load
    } finally {
      if (loadPromiseRef.current === load) loadPromiseRef.current = null
    }
  }, [supabase, userId])

  useEffect(() => {
    if (!userId) {
      loaderRef.current.clear()
      queueMicrotask(() => {
        setMemberships([])
        setCompanies([])
        setIsAdmin(false)
        setDataLoaded(true)
        setValidatedUserId(null)
      })
      return
    }
    queueMicrotask(() => { void refresh() })
  }, [configured, refresh, userId])

  useEffect(() => {
    const syncMembership = () => {
      if (userId) void refresh(true)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncMembership()
    }
    window.addEventListener('focus', syncMembership)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', syncMembership)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, userId])

  useEffect(() => {
    let active = true
    if (userId && validatedUserId === userId && activeCompanyId && !companies.some((company) => company.id === activeCompanyId)) {
      queueMicrotask(() => {
        if (!active) return
        setActiveCompanyId(null)
        localStorage.removeItem('controle-app-company')
        setError('Seu vínculo com esta empresa foi desativado ou o código da empresa foi trocado.')
      })
    }
    return () => { active = false }
  }, [companies, activeCompanyId, userId, validatedUserId])

  const activeMembership = memberships.find((item) => item.company_id === activeCompanyId) ?? null
  const activeCompany = companies.find((item) => item.id === activeCompanyId) ?? null

  const selectCompany = (companyId: string) => {
    if (!companyId) {
      setActiveCompanyId(null)
      localStorage.removeItem('controle-app-company')
      return
    }
    if (canSelectCompany(isAdmin, companies.map((company) => company.id), companyId)) {
      setActiveCompanyId(companyId)
      localStorage.setItem('controle-app-company', companyId)
    }
  }

  return (
    <CompanyContext.Provider value={{
      memberships, companies, activeCompany, activeMembership,
      role: activeMembership?.role ?? null, isAdmin, loading, refresh, selectCompany,
      dataLoaded, error, clearError: () => setError(null),
    }}>
      {children}
    </CompanyContext.Provider>
  )
}

