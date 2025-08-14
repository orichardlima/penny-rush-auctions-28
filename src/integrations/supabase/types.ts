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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      auctions: {
        Row: {
          bid_cost: number | null
          bid_increment: number | null
          company_revenue: number
          created_at: string
          current_price: number | null
          description: string | null
          ends_at: string | null
          finished_at: string | null
          id: string
          image_url: string | null
          market_value: number | null
          participants_count: number | null
          revenue_target: number | null
          starting_price: number | null
          starts_at: string | null
          status: string | null
          time_left: number | null
          title: string
          total_bids: number | null
          updated_at: string
          winner_id: string | null
          winner_name: string | null
        }
        Insert: {
          bid_cost?: number | null
          bid_increment?: number | null
          company_revenue?: number
          created_at?: string
          current_price?: number | null
          description?: string | null
          ends_at?: string | null
          finished_at?: string | null
          id?: string
          image_url?: string | null
          market_value?: number | null
          participants_count?: number | null
          revenue_target?: number | null
          starting_price?: number | null
          starts_at?: string | null
          status?: string | null
          time_left?: number | null
          title: string
          total_bids?: number | null
          updated_at?: string
          winner_id?: string | null
          winner_name?: string | null
        }
        Update: {
          bid_cost?: number | null
          bid_increment?: number | null
          company_revenue?: number
          created_at?: string
          current_price?: number | null
          description?: string | null
          ends_at?: string | null
          finished_at?: string | null
          id?: string
          image_url?: string | null
          market_value?: number | null
          participants_count?: number | null
          revenue_target?: number | null
          starting_price?: number | null
          starts_at?: string | null
          status?: string | null
          time_left?: number | null
          title?: string
          total_bids?: number | null
          updated_at?: string
          winner_id?: string | null
          winner_name?: string | null
        }
        Relationships: []
      }
      bid_packages: {
        Row: {
          bids_count: number
          created_at: string
          features: string[] | null
          icon: string | null
          id: string
          is_popular: boolean | null
          name: string
          original_price: number | null
          price: number
          updated_at: string
        }
        Insert: {
          bids_count: number
          created_at?: string
          features?: string[] | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name: string
          original_price?: number | null
          price: number
          updated_at?: string
        }
        Update: {
          bids_count?: number
          created_at?: string
          features?: string[] | null
          icon?: string | null
          id?: string
          is_popular?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      bid_purchases: {
        Row: {
          amount_paid: number
          bids_purchased: number
          created_at: string
          id: string
          package_id: string
          payment_status: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          bids_purchased: number
          created_at?: string
          id?: string
          package_id: string
          payment_status?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          bids_purchased?: number
          created_at?: string
          id?: string
          package_id?: string
          payment_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          auction_id: string
          bid_amount: number
          cost_paid: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          cost_paid: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          cost_paid?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_webhook_logs: {
        Row: {
          auction_id: string
          correlation_id: string | null
          created_at: string
          error: string | null
          http_status: number | null
          id: string
          response_body: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          auction_id: string
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          response_body?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          auction_id?: string
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          response_body?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bids_balance: number | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_bot: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bids_balance?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_bot?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bids_balance?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_bot?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_bid_system: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      auto_finalize_inactive_auctions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      current_server_time: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      finalize_expired_auctions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_admin_audit_log: {
        Args: { limit_count?: number }
        Returns: {
          action_type: string
          admin_name: string
          admin_user_id: string
          created_at: string
          description: string
          id: string
          target_id: string
          target_type: string
        }[]
      }
      get_auction_financials: {
        Args: { auction_uuid: string }
        Returns: {
          auction_id: string
          bot_bids_count: number
          bot_bids_percentage: number
          current_price: number
          market_value: number
          profit_margin: number
          real_revenue: number
          revenue_target: number
          roi_percentage: number
          status: string
          target_percentage: number
          title: string
          total_bids_count: number
          user_bids_count: number
          user_bids_percentage: number
        }[]
      }
      get_auction_participants: {
        Args: { auction_uuid: string }
        Returns: {
          avg_time_between_bids: unknown
          bid_count: number
          first_bid_at: string
          is_bot: boolean
          last_bid_at: string
          total_spent: number
          user_id: string
          user_name: string
        }[]
      }
      get_auction_revenue: {
        Args: { auction_uuid: string }
        Returns: number
      }
      get_conversion_funnel: {
        Args: Record<PropertyKey, never>
        Returns: {
          bid_conversion_rate: number
          purchase_conversion_rate: number
          total_users: number
          users_with_bids: number
          users_with_purchases: number
          users_with_wins: number
          win_conversion_rate: number
        }[]
      }
      get_financial_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_auctions: number
          auction_revenue: number
          average_auction_revenue: number
          bot_bids: number
          conversion_rate: number
          finished_auctions: number
          package_revenue: number
          paying_users: number
          total_auctions: number
          total_bids: number
          total_revenue: number
          total_users: number
          user_bids: number
        }[]
      }
      get_hourly_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          bid_count: number
          day_of_week: number
          hour_of_day: number
          revenue: number
          user_count: number
        }[]
      }
      get_random_bot: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_revenue_trends: {
        Args: Record<PropertyKey, never>
        Returns: {
          auction_revenue: number
          bids_count: number
          date_period: string
          package_revenue: number
          total_revenue: number
        }[]
      }
      get_user_analytics: {
        Args: { user_uuid: string }
        Returns: {
          auctions_participated: number
          auctions_won: number
          avg_bid_cost: number
          email: string
          favorite_time_slot: string
          first_activity: string
          full_name: string
          is_bot: boolean
          last_activity: string
          total_bids: number
          total_spent: number
          user_classification: string
          user_id: string
        }[]
      }
      is_admin_user: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      sync_auction_timer: {
        Args: { auction_uuid: string }
        Returns: {
          ends_at: string
          id: string
          status: string
          time_left: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
