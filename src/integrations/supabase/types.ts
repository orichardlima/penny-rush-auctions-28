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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_name: string
          admin_user_id: string
          created_at: string
          description: string
          id: string
          new_values: Json | null
          old_values: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_name: string
          admin_user_id: string
          created_at?: string
          description: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_name?: string
          admin_user_id?: string
          created_at?: string
          description?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          approved_at: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          paid_at: string | null
          purchase_amount: number
          purchase_id: string
          referred_user_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          approved_at?: string | null
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          paid_at?: string | null
          purchase_amount: number
          purchase_id: string
          referred_user_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          approved_at?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          purchase_amount?: number
          purchase_id?: string
          referred_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "bid_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_cpa_goals: {
        Row: {
          affiliate_id: string
          completed_at: string | null
          conversions_target: number
          created_at: string
          current_conversions: number
          cycle_number: number
          expires_at: string | null
          goal_type: string
          id: string
          started_at: string
          status: string
          total_reward: number | null
          updated_at: string
          value_per_conversion: number
        }
        Insert: {
          affiliate_id: string
          completed_at?: string | null
          conversions_target: number
          created_at?: string
          current_conversions?: number
          cycle_number?: number
          expires_at?: string | null
          goal_type?: string
          id?: string
          started_at?: string
          status?: string
          total_reward?: number | null
          updated_at?: string
          value_per_conversion: number
        }
        Update: {
          affiliate_id?: string
          completed_at?: string | null
          conversions_target?: number
          created_at?: string
          current_conversions?: number
          cycle_number?: number
          expires_at?: string | null
          goal_type?: string
          id?: string
          started_at?: string
          status?: string
          total_reward?: number | null
          updated_at?: string
          value_per_conversion?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_cpa_goals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          click_source: string | null
          converted: boolean
          created_at: string
          id: string
          ip_address: string | null
          referred_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          click_source?: string | null
          converted?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          referred_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          click_source?: string | null
          converted?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          referred_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawals: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          payment_details: Json
          payment_method: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          payment_details: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          payment_details?: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          approved_at: string | null
          approved_by: string | null
          bank_details: Json | null
          commission_balance: number
          commission_rate: number
          commission_type: string
          cpa_conversions_target: number | null
          cpa_value_per_conversion: number | null
          created_at: string
          id: string
          pix_key: string | null
          status: string
          total_commission_earned: number
          total_commission_paid: number
          total_conversions: number
          total_referrals: number
          total_signups: number
          user_id: string
        }
        Insert: {
          affiliate_code: string
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          commission_balance?: number
          commission_rate?: number
          commission_type?: string
          cpa_conversions_target?: number | null
          cpa_value_per_conversion?: number | null
          created_at?: string
          id?: string
          pix_key?: string | null
          status?: string
          total_commission_earned?: number
          total_commission_paid?: number
          total_conversions?: number
          total_referrals?: number
          total_signups?: number
          user_id: string
        }
        Update: {
          affiliate_code?: string
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          commission_balance?: number
          commission_rate?: number
          commission_type?: string
          cpa_conversions_target?: number | null
          cpa_value_per_conversion?: number | null
          created_at?: string
          id?: string
          pix_key?: string | null
          status?: string
          total_commission_earned?: number
          total_commission_paid?: number
          total_conversions?: number
          total_referrals?: number
          total_signups?: number
          user_id?: string
        }
        Relationships: []
      }
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
          is_hidden: boolean | null
          last_bid_at: string | null
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
          is_hidden?: boolean | null
          last_bid_at?: string | null
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
          is_hidden?: boolean | null
          last_bid_at?: string | null
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
          external_reference: string | null
          id: string
          package_id: string
          payment_id: string | null
          payment_status: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          bids_purchased: number
          created_at?: string
          external_reference?: string | null
          id?: string
          package_id: string
          payment_id?: string | null
          payment_status?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          bids_purchased?: number
          created_at?: string
          external_reference?: string | null
          id?: string
          package_id?: string
          payment_id?: string | null
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
      email_logs: {
        Row: {
          created_at: string
          email_provider_id: string | null
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_user_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_provider_id?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_user_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_provider_id?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_user_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          auction_id: string
          created_at: string
          delivery_address: Json | null
          estimated_delivery: string | null
          final_price: number
          id: string
          market_value: number
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          product_name: string
          status: string
          tracking_code: string | null
          updated_at: string
          winner_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          delivery_address?: Json | null
          estimated_delivery?: string | null
          final_price?: number
          id?: string
          market_value?: number
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          product_name: string
          status?: string
          tracking_code?: string | null
          updated_at?: string
          winner_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          delivery_address?: Json | null
          estimated_delivery?: string | null
          final_price?: number
          id?: string
          market_value?: number
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          product_name?: string
          status?: string
          tracking_code?: string | null
          updated_at?: string
          winner_id?: string
        }
        Relationships: []
      }
      partner_contracts: {
        Row: {
          aporte_value: number
          available_balance: number
          bank_details: Json | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          monthly_cap: number
          pix_key: string | null
          pix_key_type: string | null
          plan_name: string
          referral_code: string | null
          referred_by_user_id: string | null
          status: string
          total_cap: number
          total_received: number
          total_referral_points: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aporte_value: number
          available_balance?: number
          bank_details?: Json | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          monthly_cap: number
          pix_key?: string | null
          pix_key_type?: string | null
          plan_name: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          status?: string
          total_cap: number
          total_received?: number
          total_referral_points?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aporte_value?: number
          available_balance?: number
          bank_details?: Json | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          monthly_cap?: number
          pix_key?: string | null
          pix_key_type?: string | null
          plan_name?: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          status?: string
          total_cap?: number
          total_received?: number
          total_referral_points?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_early_terminations: {
        Row: {
          admin_notes: string | null
          aporte_original: number
          bids_amount: number | null
          created_at: string
          credits_amount: number | null
          discount_percentage: number
          final_value: number | null
          id: string
          liquidation_type: string
          partner_contract_id: string
          processed_at: string | null
          processed_by: string | null
          proposed_value: number
          remaining_cap: number
          requested_at: string
          status: string
          total_received: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          aporte_original: number
          bids_amount?: number | null
          created_at?: string
          credits_amount?: number | null
          discount_percentage?: number
          final_value?: number | null
          id?: string
          liquidation_type: string
          partner_contract_id: string
          processed_at?: string | null
          processed_by?: string | null
          proposed_value: number
          remaining_cap: number
          requested_at?: string
          status?: string
          total_received: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          aporte_original?: number
          bids_amount?: number | null
          created_at?: string
          credits_amount?: number | null
          discount_percentage?: number
          final_value?: number | null
          id?: string
          liquidation_type?: string
          partner_contract_id?: string
          processed_at?: string | null
          processed_by?: string | null
          proposed_value?: number
          remaining_cap?: number
          requested_at?: string
          status?: string
          total_received?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_early_terminations_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_level_points: {
        Row: {
          created_at: string
          id: string
          plan_name: string
          points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_name: string
          points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_name?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_levels: {
        Row: {
          bonus_percentage_increase: number
          color: string
          created_at: string
          display_name: string
          icon: string
          id: string
          is_active: boolean
          min_points: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_percentage_increase?: number
          color: string
          created_at?: string
          display_name: string
          icon: string
          id?: string
          is_active?: boolean
          min_points?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_percentage_increase?: number
          color?: string
          created_at?: string
          display_name?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_points?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_payouts: {
        Row: {
          amount: number
          calculated_amount: number
          created_at: string
          id: string
          monthly_cap_applied: boolean
          paid_at: string | null
          partner_contract_id: string
          period_end: string | null
          period_start: string
          status: string
          total_cap_applied: boolean
        }
        Insert: {
          amount: number
          calculated_amount: number
          created_at?: string
          id?: string
          monthly_cap_applied?: boolean
          paid_at?: string | null
          partner_contract_id: string
          period_end?: string | null
          period_start: string
          status?: string
          total_cap_applied?: boolean
        }
        Update: {
          amount?: number
          calculated_amount?: number
          created_at?: string
          id?: string
          monthly_cap_applied?: boolean
          paid_at?: string | null
          partner_contract_id?: string
          period_end?: string | null
          period_start?: string
          status?: string
          total_cap_applied?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_plans: {
        Row: {
          aporte_value: number
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          monthly_cap: number
          name: string
          referral_bonus_percentage: number | null
          sort_order: number
          total_cap: number
          updated_at: string
        }
        Insert: {
          aporte_value: number
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          monthly_cap: number
          name: string
          referral_bonus_percentage?: number | null
          sort_order?: number
          total_cap: number
          updated_at?: string
        }
        Update: {
          aporte_value?: number
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          monthly_cap?: number
          name?: string
          referral_bonus_percentage?: number | null
          sort_order?: number
          total_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_referral_bonuses: {
        Row: {
          aporte_value: number
          available_at: string | null
          bonus_percentage: number
          bonus_value: number
          created_at: string
          id: string
          paid_at: string | null
          referred_contract_id: string
          referred_user_id: string
          referrer_contract_id: string
          status: string
        }
        Insert: {
          aporte_value: number
          available_at?: string | null
          bonus_percentage?: number
          bonus_value: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_contract_id: string
          referred_user_id: string
          referrer_contract_id: string
          status?: string
        }
        Update: {
          aporte_value?: number
          available_at?: string | null
          bonus_percentage?: number
          bonus_value?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_contract_id?: string
          referred_user_id?: string
          referrer_contract_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referral_bonuses_referred_contract_id_fkey"
            columns: ["referred_contract_id"]
            isOneToOne: true
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referral_bonuses_referrer_contract_id_fkey"
            columns: ["referrer_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_upgrades: {
        Row: {
          created_at: string
          difference_paid: number
          id: string
          new_aporte_value: number
          new_monthly_cap: number
          new_plan_name: string
          new_total_cap: number
          notes: string | null
          partner_contract_id: string
          previous_aporte_value: number
          previous_monthly_cap: number
          previous_plan_name: string
          previous_total_cap: number
          total_received_at_upgrade: number
        }
        Insert: {
          created_at?: string
          difference_paid: number
          id?: string
          new_aporte_value: number
          new_monthly_cap: number
          new_plan_name: string
          new_total_cap: number
          notes?: string | null
          partner_contract_id: string
          previous_aporte_value: number
          previous_monthly_cap: number
          previous_plan_name: string
          previous_total_cap: number
          total_received_at_upgrade?: number
        }
        Update: {
          created_at?: string
          difference_paid?: number
          id?: string
          new_aporte_value?: number
          new_monthly_cap?: number
          new_plan_name?: string
          new_total_cap?: number
          notes?: string | null
          partner_contract_id?: string
          previous_aporte_value?: number
          previous_monthly_cap?: number
          previous_plan_name?: string
          previous_total_cap?: number
          total_received_at_upgrade?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_upgrades_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          paid_at: string | null
          paid_by: string | null
          partner_contract_id: string
          payment_details: Json
          payment_method: string
          rejection_reason: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          partner_contract_id: string
          payment_details: Json
          payment_method?: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          partner_contract_id?: string
          payment_details?: Json
          payment_method?: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_withdrawals_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          bid_cost: number | null
          bid_increment: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          market_value: number | null
          revenue_target: number | null
          starting_price: number | null
          times_used: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bid_cost?: number | null
          bid_increment?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          market_value?: number | null
          revenue_target?: number | null
          starting_price?: number | null
          times_used?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bid_cost?: number | null
          bid_increment?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          market_value?: number | null
          revenue_target?: number | null
          starting_price?: number | null
          times_used?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bids_balance: number | null
          birth_date: string | null
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          cep: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_blocked: boolean | null
          is_bot: boolean | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          signup_bonus_amount: number | null
          signup_bonus_date: string | null
          signup_bonus_received: boolean | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bids_balance?: number | null
          birth_date?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_blocked?: boolean | null
          is_bot?: boolean | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          signup_bonus_amount?: number | null
          signup_bonus_date?: string | null
          signup_bonus_received?: boolean | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bids_balance?: number | null
          birth_date?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_blocked?: boolean | null
          is_bot?: boolean | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          signup_bonus_amount?: number | null
          signup_bonus_date?: string | null
          signup_bonus_received?: boolean | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_bonuses: {
        Row: {
          available_at: string | null
          blocked_reason: string | null
          bonus_percentage: number
          bonus_value: number
          created_at: string
          id: string
          package_value: number
          purchase_id: string | null
          referred_user_id: string
          referrer_user_id: string
          status: string
          used_at: string | null
        }
        Insert: {
          available_at?: string | null
          blocked_reason?: string | null
          bonus_percentage?: number
          bonus_value: number
          created_at?: string
          id?: string
          package_value: number
          purchase_id?: string | null
          referred_user_id: string
          referrer_user_id: string
          status?: string
          used_at?: string | null
        }
        Update: {
          available_at?: string | null
          blocked_reason?: string | null
          bonus_percentage?: number
          bonus_value?: number
          created_at?: string
          id?: string
          package_value?: number
          purchase_id?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          status?: string
          used_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_type: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_value: string
          old_value: string | null
          setting_key: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value: string
          old_value?: string | null
          setting_key: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_value?: string
          old_value?: string | null
          setting_key?: string
        }
        Relationships: []
      }
      weekly_revenue_snapshots: {
        Row: {
          closed_at: string | null
          created_at: string
          gross_revenue: number
          id: string
          is_closed: boolean
          is_manual: boolean | null
          manual_base: string | null
          manual_description: string | null
          manual_percentage: number | null
          partner_fund_percentage: number
          partner_fund_value: number
          period_end: string | null
          period_start: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          gross_revenue: number
          id?: string
          is_closed?: boolean
          is_manual?: boolean | null
          manual_base?: string | null
          manual_description?: string | null
          manual_percentage?: number | null
          partner_fund_percentage?: number
          partner_fund_value: number
          period_end?: string | null
          period_start: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          gross_revenue?: number
          id?: string
          is_closed?: boolean
          is_manual?: boolean | null
          manual_base?: string | null
          manual_description?: string | null
          manual_percentage?: number | null
          partner_fund_percentage?: number
          partner_fund_value?: number
          period_end?: string | null
          period_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_affiliate_code_availability: {
        Args: { code_to_check: string }
        Returns: boolean
      }
      current_server_time: { Args: never; Returns: string }
      decrement_auction_timers: { Args: never; Returns: undefined }
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
      get_auction_revenue: { Args: { auction_uuid: string }; Returns: number }
      get_auction_time_left: { Args: { auction_uuid: string }; Returns: number }
      get_conversion_funnel: {
        Args: never
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
        Args: never
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
      get_financial_summary_filtered: {
        Args: { end_date?: string; real_only?: boolean; start_date?: string }
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
        Args: never
        Returns: {
          bid_count: number
          day_of_week: number
          hour_of_day: number
          revenue: number
          user_count: number
        }[]
      }
      get_random_bot: { Args: never; Returns: string }
      get_revenue_trends: {
        Args: never
        Returns: {
          auction_revenue: number
          bids_count: number
          date_period: string
          package_revenue: number
          total_revenue: number
        }[]
      }
      get_revenue_trends_filtered: {
        Args: { end_date?: string; real_only?: boolean; start_date?: string }
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
      get_user_orders: {
        Args: { user_uuid: string }
        Returns: {
          auction_id: string
          created_at: string
          estimated_delivery: string
          final_price: number
          id: string
          market_value: number
          payment_method: string
          product_name: string
          savings: number
          status: string
          tracking_code: string
          updated_at: string
        }[]
      }
      increment_affiliate_conversions: {
        Args: { affiliate_uuid: string }
        Returns: undefined
      }
      is_admin_user: { Args: { user_uuid: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_description?: string
          p_new_values?: Json
          p_old_values?: Json
          p_target_id: string
          p_target_type: string
        }
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
