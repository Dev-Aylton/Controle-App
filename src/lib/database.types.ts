export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type CompanyRole = 'owner' | 'manager' | 'employee'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string | null; avatar_url: string | null; avatar_key: string | null; created_at: string }
        Insert: { id: string; name?: string | null; avatar_url?: string | null; avatar_key?: string | null; created_at?: string }
        Update: { name?: string | null; avatar_url?: string | null; avatar_key?: string | null }
      }
      app_admins: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string }
      }
      companies: {
        Row: { id: string; name: string; phone: string | null; photo: string | null; created_at: string }
        Insert: { id?: string; name: string; phone?: string | null; photo?: string | null; created_at?: string }
        Update: { name?: string; phone?: string | null; photo?: string | null }
      }
      company_codes: {
        Row: { id: string; company_id: string; code: string; version: number; active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; company_id: string; code: string; version?: number; active?: boolean; created_at?: string; created_by?: string | null }
        Update: { code?: string; version?: number; active?: boolean }
      }
      memberships: {
        Row: { id: string; user_id: string; company_id: string; role: CompanyRole; active: boolean; code_id: string | null; deactivated_at: string | null; deactivated_by: string | null; created_at: string }
        Insert: { id?: string; user_id: string; company_id: string; role: CompanyRole; active?: boolean; code_id?: string | null; deactivated_at?: string | null; deactivated_by?: string | null; created_at?: string }
        Update: { role?: CompanyRole; active?: boolean; code_id?: string | null; deactivated_at?: string | null; deactivated_by?: string | null }
      }
      company_invites: {
        Row: { id: string; company_id: string; email: string; role: 'owner' | 'manager'; invited_by: string; used_at: string | null; created_at: string }
        Insert: { id?: string; company_id: string; email: string; role: 'owner' | 'manager'; invited_by: string; used_at?: string | null; created_at?: string }
        Update: { email?: string; role?: 'owner' | 'manager'; used_at?: string | null }
      }
      audit_log: {
        Row: { id: number; user_id: string | null; company_id: string | null; action: string; data: Json; acted_as_support: boolean; created_at: string }
        Insert: never
        Update: never
      }
      environments: {
        Row: { id: string; company_id: string; name: string; description: string | null; active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; company_id: string; name: string; description?: string | null; active?: boolean; created_at?: string; created_by?: string | null }
        Update: { name?: string; description?: string | null; active?: boolean }
      }
      product_categories: {
        Row: { id: string; company_id: string; name: string; active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; company_id: string; name: string; active?: boolean; created_at?: string; created_by?: string | null }
        Update: { name?: string; active?: boolean }
      }
      products: {
        Row: { id: string; company_id: string; category_id: string | null; name: string; sku: string | null; unit: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'|'garrafa'|'lata'|'maço'|'porcao'|'duzia'|'bandeja'|'pacote'|'saco'|'ramo'|'peca'|'fardo'|'frasco'; weight_g?: number | null; min_stock: number | null; max_stock: number | null; volume_ml: number | null; dose_ml: number | null; photo_path: string | null; active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; company_id: string; category_id?: string | null; name: string; sku?: string | null; unit?: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'|'garrafa'|'lata'|'maço'|'porcao'|'duzia'|'bandeja'|'pacote'|'saco'|'ramo'|'peca'|'fardo'|'frasco'; weight_g?: number | null; min_stock?: number | null; max_stock?: number | null; volume_ml?: number | null; dose_ml?: number | null; photo_path?: string | null; active?: boolean; created_at?: string; created_by?: string | null }
        Update: { category_id?: string | null; name?: string; sku?: string | null; unit?: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'|'garrafa'|'lata'|'maço'|'porcao'|'duzia'|'bandeja'|'pacote'|'saco'|'ramo'|'peca'|'fardo'|'frasco'; weight_g?: number | null; min_stock?: number | null; max_stock?: number | null; volume_ml?: number | null; dose_ml?: number | null; photo_path?: string | null; active?: boolean }
      }
      product_costs: {
        Row: { product_id: string; company_id: string; unit_cost: number; updated_at: string; updated_by: string | null }
        Insert: never
        Update: never
      }
      product_cost_history: {
        Row: { id: number; product_id: string; company_id: string; unit_cost: number; changed_at: string; changed_by: string | null }
        Insert: never
        Update: never
      }
      product_environment_pricing: {
        Row: { product_id: string; company_id: string; environment_id: string; unit_cost: number | null; unit_price: number | null; dose_price: number | null; updated_at: string; updated_by: string | null }
        Insert: never
        Update: never
      }
      stock_movements: {
        Row: { id: string; company_id: string; product_id: string; environment_id: string; type: 'entrada'|'saida'|'perda'|'ajuste_inventario'|'transferencia_saida'|'transferencia_entrada'|'estorno'|'zeragem'; quantity: number; signed_quantity: number; note: string | null; transfer_group_id: string | null; reverses_movement_id: string | null; inventory_session_id: string | null; created_by: string | null; created_at: string }
        Insert: never
        Update: never
      }
      inventory_sessions: {
        Row: { id: string; company_id: string; environment_id: string; status: 'aberta'|'finalizada'|'cancelada'; opened_by: string | null; opened_at: string; finished_at: string | null }
        Insert: never
        Update: never
      }
      inventory_counts: {
        Row: { id: string; session_id: string; product_id: string; counted_quantity: number; counted_by: string | null; counted_at: string }
        Insert: never
        Update: never
      }
    }
    Views: Record<string, never>
    Enums: { company_role: CompanyRole }
    CompositeTypes: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_active_member: { Args: { p_company_id: string }; Returns: boolean }
      member_role: { Args: { p_company_id: string }; Returns: CompanyRole }
      is_manager_or_owner: { Args: { p_company_id: string }; Returns: boolean }
      rotate_company_code: { Args: { p_company_id: string }; Returns: string }
      join_company_with_code: { Args: { p_code: string }; Returns: string }
      claim_invites: { Args: Record<string, never>; Returns: number }
      create_invite: { Args: { p_company_id: string; p_email: string; p_role: CompanyRole }; Returns: string }
      promote_to_manager: { Args: { p_membership_id: string }; Returns: undefined }
      deactivate_member: { Args: { p_membership_id: string }; Returns: undefined }
      upsert_product_cost: { Args: { p_product_id: string; p_unit_cost: number }; Returns: undefined }
      import_products: { Args: { p_company_id: string; p_rows: Json }; Returns: Json }
      get_product_stock_limits: { Args: { p_company_id: string }; Returns: Array<{ product_id: string; min_stock: number | null; max_stock: number | null }> }
      get_team_members: { Args: { p_company_id: string }; Returns: Array<{ membership_id: string; user_id: string; name: string; email: string | null; role: CompanyRole; active: boolean; created_at: string }> }
      get_audit_log: { Args: { p_company_id: string; p_from: string; p_to: string; p_limit?: number }; Returns: Array<{ action: string; object_name: string; user_name: string; created_at: string; summary: string; acted_as_support: boolean }> }
      delete_my_account: { Args: Record<string, never>; Returns: undefined }
      request_account_deletion: { Args: Record<string, never>; Returns: string }
      get_account_deletion_status: { Args: Record<string, never>; Returns: Array<{ request_id: string; status: 'pending' | 'finalizing'; requested_at: string; scheduled_for: string; can_reactivate: boolean }> }
      reactivate_my_account: { Args: Record<string, never>; Returns: undefined }
      get_privacy_policy_status: { Args: Record<string, never>; Returns: Array<{ policy_version: string; published_at: string; accepted_at: string | null }> }
      accept_current_privacy_policy: { Args: Record<string, never>; Returns: string }
      claim_expired_account_deletions: { Args: { p_limit?: number }; Returns: Array<{ request_id: string; user_id: string }> }
      release_expired_account_deletion: { Args: { p_request_id: string }; Returns: undefined }
      finalize_expired_account_deletion: { Args: { p_request_id: string }; Returns: boolean }
      get_stock_balance: { Args: { p_company_id: string; p_environment_id?: string }; Returns: Array<{ product_id: string; environment_id: string; balance: number }> }
      register_movement: { Args: { p_company_id: string; p_product_id: string; p_environment_id: string; p_type: string; p_quantity: number; p_note?: string }; Returns: string }
      register_transfer: { Args: { p_company_id: string; p_product_id: string; p_from_environment_id: string; p_to_environment_id: string; p_quantity: number; p_note?: string }; Returns: string }
      reverse_movement: { Args: { p_movement_id: string; p_note?: string }; Returns: string }
      open_inventory_session: { Args: { p_company_id: string; p_environment_id: string }; Returns: string }
      submit_inventory_count: { Args: { p_session_id: string; p_product_id: string; p_counted_quantity: number }; Returns: undefined }
      finish_inventory_session: { Args: { p_session_id: string }; Returns: Json }
      list_loss_reasons: { Args: { p_company_id: string }; Returns: Array<{ reason_id: string; name: string }> }
      get_pending_loss_reasons: { Args: { p_company_id: string }; Returns: Json }
      get_my_pending_loss_reasons: { Args: { p_company_id: string }; Returns: Json }
      complete_pending_loss_reason: { Args: { p_movement_id: string; p_reason_id: string }; Returns: undefined }
      seed_loss_reasons: { Args: { p_company_id: string }; Returns: number }
      get_purchase_list: { Args: { p_company_id: string; p_environment_id?: string }; Returns: Json }
      list_product_environment_pricing: { Args: { p_company_id: string; p_environment_id: string }; Returns: Array<{ product_id: string; product_name: string; sku: string | null; unit: string; volume_ml: number | null; dose_ml: number | null; unit_cost: number | null; base_unit_cost: number | null; unit_price: number | null; dose_price: number | null }> }
      upsert_product_environment_pricing: { Args: { p_company_id: string; p_environment_id: string; p_product_id: string; p_unit_cost: number | null; p_unit_price: number | null; p_dose_price: number | null }; Returns: undefined }
      get_inventory_valuation: { Args: { p_company_id: string }; Returns: number | null }
      import_sales_batch: { Args: { p_company_id: string; p_environment_id: string; p_label: string; p_items: Json }; Returns: string }
      list_sales_imports: { Args: { p_company_id: string }; Returns: Array<{ batch_id: string; label: string; status: string; total_items: number; total_quantity: number; total_revenue: number | null; total_cogs: number | null; total_gross_profit: number | null; imported_at: string; imported_by_name: string }> }
    }
    Relationships: []
  }
}
