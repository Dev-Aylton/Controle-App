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
        Row: { id: number; user_id: string | null; company_id: string | null; action: string; data: Json; created_at: string }
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
        Row: { id: string; company_id: string; category_id: string | null; name: string; sku: string | null; unit: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'; min_stock: number; photo_path: string | null; active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; company_id: string; category_id?: string | null; name: string; sku?: string | null; unit?: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'; min_stock?: number; photo_path?: string | null; active?: boolean; created_at?: string; created_by?: string | null }
        Update: { category_id?: string | null; name?: string; sku?: string | null; unit?: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'; min_stock?: number; photo_path?: string | null; active?: boolean }
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
      stock_movements: {
        Row: { id: string; company_id: string; product_id: string; environment_id: string; type: 'entrada'|'saida'|'perda'|'ajuste_inventario'|'transferencia_saida'|'transferencia_entrada'|'estorno'; quantity: number; signed_quantity: number; note: string | null; transfer_group_id: string | null; reverses_movement_id: string | null; inventory_session_id: string | null; created_by: string | null; created_at: string }
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
      get_stock_balance: { Args: { p_company_id: string; p_environment_id?: string }; Returns: Array<{ product_id: string; environment_id: string; balance: number }> }
      register_movement: { Args: { p_company_id: string; p_product_id: string; p_environment_id: string; p_type: string; p_quantity: number; p_note?: string }; Returns: string }
      register_transfer: { Args: { p_company_id: string; p_product_id: string; p_from_environment_id: string; p_to_environment_id: string; p_quantity: number; p_note?: string }; Returns: string }
      reverse_movement: { Args: { p_movement_id: string; p_note?: string }; Returns: string }
      open_inventory_session: { Args: { p_company_id: string; p_environment_id: string }; Returns: string }
      submit_inventory_count: { Args: { p_session_id: string; p_product_id: string; p_counted_quantity: number }; Returns: undefined }
      finish_inventory_session: { Args: { p_session_id: string }; Returns: Json }
    }
    Relationships: []
  }
}
