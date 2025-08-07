export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
        }
        Insert: {
          bid_cost?: number | null
          bid_increment?: number | null
          company_revenue?: number
          created_at?: string
          current_price?: number | null
          description?: string | null
          ends_at?: string | null
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
        }
        Update: {
          bid_cost?: number | null
          bid_increment?: number | null
          company_revenue?: number
          created_at?: string
          current_price?: number | null
          description?: string | null
          ends_at?: string | null
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
      finalize_expired_auctions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_auction_revenue: {
        Args: { auction_uuid: string }
        Returns: number
      }
      get_random_bot: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin_user: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      sync_auction_timer: {
        Args: { auction_uuid: string }
        Returns: {
          id: string
          time_left: number
          ends_at: string
          status: string
        }[]
      }
      update_auction_timers: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
