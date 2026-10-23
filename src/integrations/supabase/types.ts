export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          user_id?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string
          business_name: string
          currency: string
          id: number
          phone: string
          report_deadline: string
        }
        Insert: {
          address?: string
          business_name?: string
          currency?: string
          id?: number
          phone?: string
          report_deadline?: string
        }
        Update: {
          address?: string
          business_name?: string
          currency?: string
          id?: number
          phone?: string
          report_deadline?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          admin_comment: string
          business_date: string
          cash_counted: number
          cash_expected: number
          cogs: number
          drinks_sales: number
          id: string
          kitchen_sales: number
          notes: string
          other_income: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          total_expenses: number
          total_purchases: number
          total_sales: number
        }
        Insert: {
          admin_comment?: string
          business_date: string
          cash_counted?: number
          cash_expected?: number
          cogs?: number
          drinks_sales?: number
          id?: string
          kitchen_sales?: number
          notes?: string
          other_income?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          total_expenses?: number
          total_purchases?: number
          total_sales?: number
        }
        Update: {
          admin_comment?: string
          business_date?: string
          cash_counted?: number
          cash_expected?: number
          cogs?: number
          drinks_sales?: number
          id?: string
          kitchen_sales?: number
          notes?: string
          other_income?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          total_expenses?: number
          total_purchases?: number
          total_sales?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_date: string
          category: string
          created_at: string
          description: string
          employee_id: string
          id: string
          payment_method: string
          status: string
        }
        Insert: {
          amount: number
          business_date?: string
          category: string
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          payment_method?: string
          status?: string
        }
        Update: {
          amount?: number
          business_date?: string
          category?: string
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          payment_method?: string
          status?: string
        }
        Relationships: []
      }
      other_income: {
        Row: {
          amount: number
          business_date: string
          created_at: string
          description: string
          employee_id: string
          id: string
          payment_method: string
          source: string
        }
        Insert: {
          amount: number
          business_date?: string
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          payment_method?: string
          source: string
        }
        Update: {
          amount?: number
          business_date?: string
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          payment_method?: string
          source?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          archived: boolean
          avg_cost: number
          category: string
          cost_price: number | null
          created_at: string
          current_stock: number
          id: string
          min_stock: number
          name: string
          selling_price: number | null
          sku: string | null
          sort_order: number
          unit: string
        }
        Insert: {
          archived?: boolean
          avg_cost?: number
          category: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name: string
          selling_price?: number | null
          sku?: string | null
          sort_order?: number
          unit?: string
        }
        Update: {
          archived?: boolean
          avg_cost?: number
          category?: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name?: string
          selling_price?: number | null
          sku?: string | null
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          can_export: boolean
          can_receive_stock: boolean
          can_record_expenses: boolean
          created_at: string
          department: string
          full_name: string
          id: string
          language: string | null
          must_change_password: boolean
          username: string
        }
        Insert: {
          active?: boolean
          can_export?: boolean
          can_receive_stock?: boolean
          can_record_expenses?: boolean
          created_at?: string
          department?: string
          full_name?: string
          id: string
          language?: string | null
          must_change_password?: boolean
          username: string
        }
        Update: {
          active?: boolean
          can_export?: boolean
          can_receive_stock?: boolean
          can_record_expenses?: boolean
          created_at?: string
          department?: string
          full_name?: string
          id?: string
          language?: string | null
          must_change_password?: boolean
          username?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          line_total: number | null
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          line_total?: number | null
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          id?: string
          line_total?: number | null
          product_id?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          business_date: string
          created_at: string
          created_by: string
          id: string
          invoice_no: string
          payment_method: string
          payment_status: string
          received_at: string | null
          received_by: string | null
          status: string
          supplier_id: string | null
          total: number
        }
        Insert: {
          business_date?: string
          created_at?: string
          created_by?: string
          id?: string
          invoice_no?: string
          payment_method?: string
          payment_status?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Update: {
          business_date?: string
          created_at?: string
          created_by?: string
          id?: string
          invoice_no?: string
          payment_method?: string
          payment_status?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_items: {
        Row: {
          adjustments: number
          expected: number
          id: string
          opening: number
          physical: number | null
          product_id: string
          purchased: number
          report_id: string
          sold: number
          total: number
          unit_price: number
        }
        Insert: {
          adjustments: number
          expected: number
          id?: string
          opening: number
          physical?: number | null
          product_id: string
          purchased: number
          report_id: string
          sold: number
          total?: number
          unit_price?: number
        }
        Update: {
          adjustments?: number
          expected?: number
          id?: string
          opening?: number
          physical?: number | null
          product_id?: string
          purchased?: number
          report_id?: string
          sold?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_cost?: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_date: string
          cost_total: number
          created_at: string
          employee_id: string
          id: string
          notes: string
          payment_method: string
          reference: string
          total: number
        }
        Insert: {
          business_date?: string
          cost_total?: number
          created_at?: string
          employee_id: string
          id?: string
          notes?: string
          payment_method?: string
          reference?: string
          total?: number
        }
        Update: {
          business_date?: string
          cost_total?: number
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string
          payment_method?: string
          reference?: string
          total?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          business_date: string
          created_at: string
          created_by: string | null
          id: number
          movement_type: string
          product_id: string
          quantity: number
          reason: string | null
          ref_id: string | null
          ref_table: string | null
          unit_cost: number
        }
        Insert: {
          business_date?: string
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type: string
          product_id: string
          quantity: number
          reason?: string | null
          ref_id?: string | null
          ref_table?: string | null
          unit_cost?: number
        }
        Update: {
          business_date?: string
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          ref_id?: string | null
          ref_table?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string
          phone: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_movement: {
        Args: {
          _allow_negative: boolean
          _cost: number
          _date: string
          _product: string
          _qty: number
          _reason: string
          _ref_id: string
          _ref_table: string
          _type: string
        }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          _cost: number
          _product: string
          _qty: number
          _reason: string
          _type: string
        }
        Returns: undefined
      }
      closing_sheet: {
        Args: { _date: string }
        Returns: {
          adjustments: number
          category: string
          expected: number
          name: string
          opening: number
          product_id: string
          purchased: number
          sold: number
          total: number
          unit_price: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _details: Json
          _entity: string
          _entity_id: string
        }
        Returns: undefined
      }
      mark_password_changed: { Args: never; Returns: undefined }
      my_perm: { Args: { _perm: string }; Returns: boolean }
      receive_purchase: { Args: { _purchase: string }; Returns: undefined }
      record_sale: {
        Args: {
          _items: Json
          _notes: string
          _payment_method: string
          _reference: string
        }
        Returns: string
      }
      reopen_daily_report: {
        Args: { _comment: string; _report: string }
        Returns: undefined
      }
      review_daily_report: {
        Args: { _approve: boolean; _comment: string; _report: string }
        Returns: undefined
      }
      submit_daily_report: {
        Args: { _cash: number; _counts: Json; _date: string; _notes: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "sales_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "sales_manager"],
    },
  },
} as const
