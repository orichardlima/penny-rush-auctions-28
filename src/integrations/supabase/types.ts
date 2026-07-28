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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_center_completions: {
        Row: {
          completion_date: string
          confirmed_at: string | null
          id: string
          material_id: string | null
          partner_contract_id: string
          social_network: string
        }
        Insert: {
          completion_date: string
          confirmed_at?: string | null
          id?: string
          material_id?: string | null
          partner_contract_id: string
          social_network: string
        }
        Update: {
          completion_date?: string
          confirmed_at?: string | null
          id?: string
          material_id?: string | null
          partner_contract_id?: string
          social_network?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_center_completions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "ad_center_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_center_completions_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_center_materials: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          target_date: string | null
          template_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          target_date?: string | null
          template_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          target_date?: string | null
          template_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
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
      admin_impersonation_log: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          mode: string
          reason: string
          started_at: string
          target_email: string | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          mode: string
          reason: string
          started_at?: string
          target_email?: string | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          mode?: string
          reason?: string
          started_at?: string
          target_email?: string | null
          target_user_id?: string
          user_agent?: string | null
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
          is_repurchase: boolean
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
          is_repurchase?: boolean
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
          is_repurchase?: boolean
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
      affiliate_manager_audit: {
        Row: {
          action_type: string
          created_at: string
          id: string
          influencer_affiliate_id: string
          manager_affiliate_id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          performed_by: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          influencer_affiliate_id: string
          manager_affiliate_id: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_by: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          influencer_affiliate_id?: string
          manager_affiliate_id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_by?: string
        }
        Relationships: []
      }
      affiliate_managers: {
        Row: {
          created_at: string
          id: string
          influencer_affiliate_id: string
          manager_affiliate_id: string
          override_rate: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          influencer_affiliate_id: string
          manager_affiliate_id: string
          override_rate?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          influencer_affiliate_id?: string
          manager_affiliate_id?: string
          override_rate?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_managers_influencer_affiliate_id_fkey"
            columns: ["influencer_affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_managers_manager_affiliate_id_fkey"
            columns: ["manager_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_manual_credits: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          created_by: string
          id: string
          reason: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          created_by: string
          id?: string
          reason: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_manual_credits_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_materials: {
        Row: {
          copy_text: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          material_type: string
          sort_order: number
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material_type?: string
          sort_order?: number
          target_audience?: string
          title: string
          updated_at?: string
        }
        Update: {
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material_type?: string
          sort_order?: number
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          fee_amount: number
          fee_percentage: number
          id: string
          net_amount: number | null
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
          fee_amount?: number
          fee_percentage?: number
          id?: string
          net_amount?: number | null
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
          fee_amount?: number
          fee_percentage?: number
          id?: string
          net_amount?: number | null
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
          recruited_at: string | null
          recruited_by_affiliate_id: string | null
          repurchase_commission_rate: number | null
          role: string
          source_manager_affiliate_id: string | null
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
          recruited_at?: string | null
          recruited_by_affiliate_id?: string | null
          repurchase_commission_rate?: number | null
          role?: string
          source_manager_affiliate_id?: string | null
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
          recruited_at?: string | null
          recruited_by_affiliate_id?: string | null
          repurchase_commission_rate?: number | null
          role?: string
          source_manager_affiliate_id?: string | null
          status?: string
          total_commission_earned?: number
          total_commission_paid?: number
          total_conversions?: number
          total_referrals?: number
          total_signups?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_recruited_by_affiliate_id_fkey"
            columns: ["recruited_by_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      anti_fraud_flags: {
        Row: {
          created_at: string
          evidence: Json
          flag_type: string
          id: string
          partner_user_id: string | null
          related_event_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          flag_type: string
          id?: string
          partner_user_id?: string | null
          related_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          flag_type?: string
          id?: string
          partner_user_id?: string | null
          related_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anti_fraud_flags_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "tracking_events"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_events: {
        Row: {
          conversion_id: string
          conversion_type: string
          created_at: string
          id: string
          metadata: Json
          partner_user_id: string
          points_awarded: number
          referral_code: string | null
          reversed: boolean
          reversed_at: string | null
          reversed_reason: string | null
          source_click_event_id: string | null
        }
        Insert: {
          conversion_id: string
          conversion_type: string
          created_at?: string
          id?: string
          metadata?: Json
          partner_user_id: string
          points_awarded?: number
          referral_code?: string | null
          reversed?: boolean
          reversed_at?: string | null
          reversed_reason?: string | null
          source_click_event_id?: string | null
        }
        Update: {
          conversion_id?: string
          conversion_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          partner_user_id?: string
          points_awarded?: number
          referral_code?: string | null
          reversed?: boolean
          reversed_at?: string | null
          reversed_reason?: string | null
          source_click_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_events_source_click_event_id_fkey"
            columns: ["source_click_event_id"]
            isOneToOne: false
            referencedRelation: "tracking_events"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_points_settlement_items: {
        Row: {
          auction_id: string
          campaign_id: string | null
          carryover_after: number
          carryover_before: number
          created_at: string
          eligible_bids_count: number
          id: string
          ledger_id: string | null
          points_awarded: number
          rule_id: string
          settlement_id: string
          total_eligible_bids: number
          user_id: string
        }
        Insert: {
          auction_id: string
          campaign_id?: string | null
          carryover_after?: number
          carryover_before?: number
          created_at?: string
          eligible_bids_count: number
          id?: string
          ledger_id?: string | null
          points_awarded: number
          rule_id: string
          settlement_id: string
          total_eligible_bids: number
          user_id: string
        }
        Update: {
          auction_id?: string
          campaign_id?: string | null
          carryover_after?: number
          carryover_before?: number
          created_at?: string
          eligible_bids_count?: number
          id?: string
          ledger_id?: string | null
          points_awarded?: number
          rule_id?: string
          settlement_id?: string
          total_eligible_bids?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_points_settlement_items_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "points_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_points_settlement_items_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "points_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_points_settlement_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "auction_points_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_points_settlements: {
        Row: {
          auction_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          metadata: Json
          reason: string | null
          reversed_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["points_settlement_status"]
          updated_at: string
          version: number
          winner_id: string | null
        }
        Insert: {
          auction_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          reason?: string | null
          reversed_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["points_settlement_status"]
          updated_at?: string
          version?: number
          winner_id?: string | null
        }
        Update: {
          auction_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          reason?: string | null
          reversed_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["points_settlement_status"]
          updated_at?: string
          version?: number
          winner_id?: string | null
        }
        Relationships: []
      }
      auction_scheduled_finalizations: {
        Row: {
          auction_id: string
          bot_only: boolean
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          notes: Json
          queued_at: string
          reason: string
          scheduled_for: string
          updated_at: string
        }
        Insert: {
          auction_id: string
          bot_only?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          notes?: Json
          queued_at?: string
          reason: string
          scheduled_for: string
          updated_at?: string
        }
        Update: {
          auction_id?: string
          bot_only?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          notes?: Json
          queued_at?: string
          reason?: string
          scheduled_for?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_scheduled_finalizations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
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
          finish_reason: string | null
          finished_at: string | null
          id: string
          image_key: string | null
          image_url: string | null
          is_hidden: boolean | null
          last_bid_at: string | null
          last_bidders: Json | null
          last_bot_band: string | null
          market_value: number | null
          max_price: number | null
          min_bids_to_qualify: number
          open_win_mode: boolean
          participants_count: number | null
          predefined_winner_id: string | null
          predefined_winner_ids: string[]
          revenue_target: number | null
          scheduled_bot_band: string | null
          scheduled_bot_bid_at: string | null
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
          finish_reason?: string | null
          finished_at?: string | null
          id?: string
          image_key?: string | null
          image_url?: string | null
          is_hidden?: boolean | null
          last_bid_at?: string | null
          last_bidders?: Json | null
          last_bot_band?: string | null
          market_value?: number | null
          max_price?: number | null
          min_bids_to_qualify?: number
          open_win_mode?: boolean
          participants_count?: number | null
          predefined_winner_id?: string | null
          predefined_winner_ids?: string[]
          revenue_target?: number | null
          scheduled_bot_band?: string | null
          scheduled_bot_bid_at?: string | null
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
          finish_reason?: string | null
          finished_at?: string | null
          id?: string
          image_key?: string | null
          image_url?: string | null
          is_hidden?: boolean | null
          last_bid_at?: string | null
          last_bidders?: Json | null
          last_bot_band?: string | null
          market_value?: number | null
          max_price?: number | null
          min_bids_to_qualify?: number
          open_win_mode?: boolean
          participants_count?: number | null
          predefined_winner_id?: string | null
          predefined_winner_ids?: string[]
          revenue_target?: number | null
          scheduled_bot_band?: string | null
          scheduled_bot_bid_at?: string | null
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
      bid_lot_consumptions: {
        Row: {
          amount_consumed: number
          bid_id: string
          bid_purchase_id: string | null
          created_at: string
          eligible_for_points: boolean
          id: string
          lot_id: string
          source: string | null
        }
        Insert: {
          amount_consumed: number
          bid_id: string
          bid_purchase_id?: string | null
          created_at?: string
          eligible_for_points: boolean
          id?: string
          lot_id: string
          source?: string | null
        }
        Update: {
          amount_consumed?: number
          bid_id?: string
          bid_purchase_id?: string | null
          created_at?: string
          eligible_for_points?: boolean
          id?: string
          lot_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_lot_consumptions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_lot_consumptions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "bid_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_lots: {
        Row: {
          bid_purchase_id: string | null
          created_at: string
          credited_via_canonical_rpc: boolean
          eligible_for_points: boolean
          expired_amount: number
          expires_at: string | null
          external_payment_id: string | null
          gateway_account_id: string | null
          gateway_event_id: string | null
          gateway_payload_hash: string | null
          id: string
          idempotency_key: string | null
          initial_amount: number
          lot_status: string
          notified_1d_at: string | null
          notified_7d_at: string | null
          payment_confirmed_at: string | null
          payment_created_at: string | null
          payment_eligible_for_points: boolean
          payment_environment: string | null
          payment_gateway: string | null
          processed_at: string | null
          purchased_at: string | null
          remaining_amount: number
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
          webhook_received_at: string | null
        }
        Insert: {
          bid_purchase_id?: string | null
          created_at?: string
          credited_via_canonical_rpc?: boolean
          eligible_for_points?: boolean
          expired_amount?: number
          expires_at?: string | null
          external_payment_id?: string | null
          gateway_account_id?: string | null
          gateway_event_id?: string | null
          gateway_payload_hash?: string | null
          id?: string
          idempotency_key?: string | null
          initial_amount: number
          lot_status?: string
          notified_1d_at?: string | null
          notified_7d_at?: string | null
          payment_confirmed_at?: string | null
          payment_created_at?: string | null
          payment_eligible_for_points?: boolean
          payment_environment?: string | null
          payment_gateway?: string | null
          processed_at?: string | null
          purchased_at?: string | null
          remaining_amount: number
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
          webhook_received_at?: string | null
        }
        Update: {
          bid_purchase_id?: string | null
          created_at?: string
          credited_via_canonical_rpc?: boolean
          eligible_for_points?: boolean
          expired_amount?: number
          expires_at?: string | null
          external_payment_id?: string | null
          gateway_account_id?: string | null
          gateway_event_id?: string | null
          gateway_payload_hash?: string | null
          id?: string
          idempotency_key?: string | null
          initial_amount?: number
          lot_status?: string
          notified_1d_at?: string | null
          notified_7d_at?: string | null
          payment_confirmed_at?: string | null
          payment_created_at?: string | null
          payment_eligible_for_points?: boolean
          payment_environment?: string | null
          payment_gateway?: string | null
          processed_at?: string | null
          purchased_at?: string | null
          remaining_amount?: number
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_lots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          canonical_lot_id: string | null
          created_at: string
          credited_via_canonical_rpc: boolean
          external_reference: string | null
          gateway_account_id: string | null
          gateway_event_id: string | null
          gateway_payload_hash: string | null
          id: string
          package_id: string
          payment_confirmed_at: string | null
          payment_created_at: string | null
          payment_environment: string | null
          payment_id: string | null
          payment_status: string | null
          processed_at: string | null
          user_id: string
          webhook_received_at: string | null
        }
        Insert: {
          amount_paid: number
          bids_purchased: number
          canonical_lot_id?: string | null
          created_at?: string
          credited_via_canonical_rpc?: boolean
          external_reference?: string | null
          gateway_account_id?: string | null
          gateway_event_id?: string | null
          gateway_payload_hash?: string | null
          id?: string
          package_id: string
          payment_confirmed_at?: string | null
          payment_created_at?: string | null
          payment_environment?: string | null
          payment_id?: string | null
          payment_status?: string | null
          processed_at?: string | null
          user_id: string
          webhook_received_at?: string | null
        }
        Update: {
          amount_paid?: number
          bids_purchased?: number
          canonical_lot_id?: string | null
          created_at?: string
          credited_via_canonical_rpc?: boolean
          external_reference?: string | null
          gateway_account_id?: string | null
          gateway_event_id?: string | null
          gateway_payload_hash?: string | null
          id?: string
          package_id?: string
          payment_confirmed_at?: string | null
          payment_created_at?: string | null
          payment_environment?: string | null
          payment_id?: string | null
          payment_status?: string | null
          processed_at?: string | null
          user_id?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_purchases_canonical_lot_id_fkey"
            columns: ["canonical_lot_id"]
            isOneToOne: false
            referencedRelation: "bid_lots"
            referencedColumns: ["id"]
          },
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
          accrual_started_at_snapshot: string | null
          auction_id: string
          audience_version_snapshot: number | null
          bid_amount: number
          cost_paid: number
          created_at: string
          eligible_for_points: boolean
          id: string
          is_test: boolean
          lot_id: string | null
          points_accrual_active_at_bid: boolean | null
          points_campaign_id: string | null
          points_multiplier_snapshot: number | null
          points_program_active_at_bid: boolean | null
          points_rule_id: string | null
          source: string | null
          tracking_status: string
          user_id: string
        }
        Insert: {
          accrual_started_at_snapshot?: string | null
          auction_id: string
          audience_version_snapshot?: number | null
          bid_amount: number
          cost_paid: number
          created_at?: string
          eligible_for_points?: boolean
          id?: string
          is_test?: boolean
          lot_id?: string | null
          points_accrual_active_at_bid?: boolean | null
          points_campaign_id?: string | null
          points_multiplier_snapshot?: number | null
          points_program_active_at_bid?: boolean | null
          points_rule_id?: string | null
          source?: string | null
          tracking_status?: string
          user_id: string
        }
        Update: {
          accrual_started_at_snapshot?: string | null
          auction_id?: string
          audience_version_snapshot?: number | null
          bid_amount?: number
          cost_paid?: number
          created_at?: string
          eligible_for_points?: boolean
          id?: string
          is_test?: boolean
          lot_id?: string | null
          points_accrual_active_at_bid?: boolean | null
          points_campaign_id?: string | null
          points_multiplier_snapshot?: number | null
          points_program_active_at_bid?: boolean | null
          points_rule_id?: string | null
          source?: string | null
          tracking_status?: string
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
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "bid_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      binary_bonuses: {
        Row: {
          available_at: string | null
          bonus_percentage: number
          bonus_value: number
          created_at: string
          cycle_closure_id: string
          id: string
          left_points_before: number
          left_points_remaining: number
          matched_points: number
          paid_at: string | null
          partner_contract_id: string
          point_value: number
          right_points_before: number
          right_points_remaining: number
          status: string
        }
        Insert: {
          available_at?: string | null
          bonus_percentage: number
          bonus_value: number
          created_at?: string
          cycle_closure_id: string
          id?: string
          left_points_before: number
          left_points_remaining: number
          matched_points: number
          paid_at?: string | null
          partner_contract_id: string
          point_value: number
          right_points_before: number
          right_points_remaining: number
          status?: string
        }
        Update: {
          available_at?: string | null
          bonus_percentage?: number
          bonus_value?: number
          created_at?: string
          cycle_closure_id?: string
          id?: string
          left_points_before?: number
          left_points_remaining?: number
          matched_points?: number
          paid_at?: string | null
          partner_contract_id?: string
          point_value?: number
          right_points_before?: number
          right_points_remaining?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "binary_bonuses_cycle_closure_id_fkey"
            columns: ["cycle_closure_id"]
            isOneToOne: false
            referencedRelation: "binary_cycle_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binary_bonuses_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      binary_cycle_closures: {
        Row: {
          bonus_percentage: number
          closed_by: string
          created_at: string
          cycle_number: number
          id: string
          notes: string | null
          partners_count: number
          point_value: number
          total_bonus_distributed: number
          total_points_matched: number
        }
        Insert: {
          bonus_percentage: number
          closed_by: string
          created_at?: string
          cycle_number: number
          id?: string
          notes?: string | null
          partners_count?: number
          point_value?: number
          total_bonus_distributed?: number
          total_points_matched?: number
        }
        Update: {
          bonus_percentage?: number
          closed_by?: string
          created_at?: string
          cycle_number?: number
          id?: string
          notes?: string | null
          partners_count?: number
          point_value?: number
          total_bonus_distributed?: number
          total_points_matched?: number
        }
        Relationships: []
      }
      binary_points_log: {
        Row: {
          created_at: string
          id: string
          partner_contract_id: string
          points_added: number
          position: string
          reason: string
          source_contract_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_contract_id: string
          points_added: number
          position: string
          reason: string
          source_contract_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_contract_id?: string
          points_added?: number
          position?: string
          reason?: string
          source_contract_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "binary_points_log_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binary_points_log_source_contract_id_fkey"
            columns: ["source_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
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
      contract_acceptances: {
        Row: {
          accepted_at_client: string | null
          browser: string | null
          content_hash: string
          contract_type: string
          contract_version_id: string
          cpf: string | null
          created_at: string
          declaration_text: string
          device: string | null
          email: string | null
          extra: Json | null
          full_name: string | null
          id: string
          ip_address: unknown
          origin: string
          os: string | null
          partner_contract_id: string | null
          payment_reference: string | null
          phone: string | null
          plan_name: string | null
          plan_value: number | null
          route: string | null
          server_timestamp: string
          user_agent: string | null
          user_id: string
          version_label: string
        }
        Insert: {
          accepted_at_client?: string | null
          browser?: string | null
          content_hash: string
          contract_type: string
          contract_version_id: string
          cpf?: string | null
          created_at?: string
          declaration_text: string
          device?: string | null
          email?: string | null
          extra?: Json | null
          full_name?: string | null
          id?: string
          ip_address?: unknown
          origin: string
          os?: string | null
          partner_contract_id?: string | null
          payment_reference?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_value?: number | null
          route?: string | null
          server_timestamp?: string
          user_agent?: string | null
          user_id: string
          version_label: string
        }
        Update: {
          accepted_at_client?: string | null
          browser?: string | null
          content_hash?: string
          contract_type?: string
          contract_version_id?: string
          cpf?: string | null
          created_at?: string
          declaration_text?: string
          device?: string | null
          email?: string | null
          extra?: Json | null
          full_name?: string | null
          id?: string
          ip_address?: unknown
          origin?: string
          os?: string | null
          partner_contract_id?: string | null
          payment_reference?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_value?: number | null
          route?: string | null
          server_timestamp?: string
          user_agent?: string | null
          user_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_evidence_access_log: {
        Row: {
          acceptance_id: string | null
          accessed_at: string
          action: string
          admin_user_id: string
          extra: Json | null
          id: string
          ip_address: unknown
          partner_contract_id: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_id?: string | null
          accessed_at?: string
          action: string
          admin_user_id: string
          extra?: Json | null
          id?: string
          ip_address?: unknown
          partner_contract_id?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_id?: string | null
          accessed_at?: string
          action?: string
          admin_user_id?: string
          extra?: Json | null
          id?: string
          ip_address?: unknown
          partner_contract_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_evidence_access_log_acceptance_id_fkey"
            columns: ["acceptance_id"]
            isOneToOne: false
            referencedRelation: "contract_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_evidence_access_log_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          content: string
          content_hash: string
          content_html: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_active: boolean
          title: string
          version: string
        }
        Insert: {
          content: string
          content_hash: string
          content_html?: string | null
          contract_type: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          title: string
          version: string
        }
        Update: {
          content?: string
          content_hash?: string
          content_html?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          title?: string
          version?: string
        }
        Relationships: []
      }
      daily_revenue_config: {
        Row: {
          calculation_base: string
          configured_by: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          percentage: number
          updated_at: string
        }
        Insert: {
          calculation_base?: string
          configured_by?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          percentage?: number
          updated_at?: string
        }
        Update: {
          calculation_base?: string
          configured_by?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          percentage?: number
          updated_at?: string
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
      fast_start_achievements: {
        Row: {
          achieved_at: string
          created_at: string
          extra_percentage_applied: number
          id: string
          partner_contract_id: string
          processed: boolean
          referrals_count: number
          tier_id: string
          total_extra_bonus: number
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          extra_percentage_applied: number
          id?: string
          partner_contract_id: string
          processed?: boolean
          referrals_count: number
          tier_id: string
          total_extra_bonus?: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          extra_percentage_applied?: number
          id?: string
          partner_contract_id?: string
          processed?: boolean
          referrals_count?: number
          tier_id?: string
          total_extra_bonus?: number
        }
        Relationships: [
          {
            foreignKeyName: "fast_start_achievements_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fast_start_achievements_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "fast_start_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      fast_start_tiers: {
        Row: {
          created_at: string
          extra_percentage: number
          id: string
          is_active: boolean
          name: string
          required_referrals: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_percentage: number
          id?: string
          is_active?: boolean
          name: string
          required_referrals: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_percentage?: number
          id?: string
          is_active?: boolean
          name?: string
          required_referrals?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fury_vault_config: {
        Row: {
          accumulation_interval: number
          accumulation_type: string
          accumulation_value: number
          created_at: string
          default_initial_value: number
          distribution_mode: string
          fury_mode_enabled: boolean
          fury_mode_multiplier: number
          fury_mode_seconds: number
          hybrid_raffle_percentage: number
          hybrid_top_percentage: number
          id: string
          is_active: boolean
          max_cap_absolute: number
          max_cap_type: string
          max_cap_value: number
          max_monthly_withdrawal_pct: number
          min_bids_to_qualify: number
          min_withdrawal_amount: number
          processing_days: number
          recency_seconds: number
          require_verified_account: boolean
          updated_at: string
          withdrawal_cooldown_days: number
        }
        Insert: {
          accumulation_interval?: number
          accumulation_type?: string
          accumulation_value?: number
          created_at?: string
          default_initial_value?: number
          distribution_mode?: string
          fury_mode_enabled?: boolean
          fury_mode_multiplier?: number
          fury_mode_seconds?: number
          hybrid_raffle_percentage?: number
          hybrid_top_percentage?: number
          id?: string
          is_active?: boolean
          max_cap_absolute?: number
          max_cap_type?: string
          max_cap_value?: number
          max_monthly_withdrawal_pct?: number
          min_bids_to_qualify?: number
          min_withdrawal_amount?: number
          processing_days?: number
          recency_seconds?: number
          require_verified_account?: boolean
          updated_at?: string
          withdrawal_cooldown_days?: number
        }
        Update: {
          accumulation_interval?: number
          accumulation_type?: string
          accumulation_value?: number
          created_at?: string
          default_initial_value?: number
          distribution_mode?: string
          fury_mode_enabled?: boolean
          fury_mode_multiplier?: number
          fury_mode_seconds?: number
          hybrid_raffle_percentage?: number
          hybrid_top_percentage?: number
          id?: string
          is_active?: boolean
          max_cap_absolute?: number
          max_cap_type?: string
          max_cap_value?: number
          max_monthly_withdrawal_pct?: number
          min_bids_to_qualify?: number
          min_withdrawal_amount?: number
          processing_days?: number
          recency_seconds?: number
          require_verified_account?: boolean
          updated_at?: string
          withdrawal_cooldown_days?: number
        }
        Relationships: []
      }
      fury_vault_instances: {
        Row: {
          auction_id: string
          config_snapshot: Json | null
          created_at: string
          current_value: number
          distributed_at: string | null
          fury_mode_active: boolean
          id: string
          initial_value: number
          last_increment_at_bid: number
          max_cap: number
          qualified_count: number
          raffle_winner_amount: number
          raffle_winner_user_id: string | null
          status: string
          top_bidder_amount: number
          top_bidder_user_id: string | null
          total_increments: number
          updated_at: string
        }
        Insert: {
          auction_id: string
          config_snapshot?: Json | null
          created_at?: string
          current_value?: number
          distributed_at?: string | null
          fury_mode_active?: boolean
          id?: string
          initial_value?: number
          last_increment_at_bid?: number
          max_cap?: number
          qualified_count?: number
          raffle_winner_amount?: number
          raffle_winner_user_id?: string | null
          status?: string
          top_bidder_amount?: number
          top_bidder_user_id?: string | null
          total_increments?: number
          updated_at?: string
        }
        Update: {
          auction_id?: string
          config_snapshot?: Json | null
          created_at?: string
          current_value?: number
          distributed_at?: string | null
          fury_mode_active?: boolean
          id?: string
          initial_value?: number
          last_increment_at_bid?: number
          max_cap?: number
          qualified_count?: number
          raffle_winner_amount?: number
          raffle_winner_user_id?: string | null
          status?: string
          top_bidder_amount?: number
          top_bidder_user_id?: string | null
          total_increments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fury_vault_instances_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_vault_logs: {
        Row: {
          amount: number
          bid_number: number | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          vault_instance_id: string
        }
        Insert: {
          amount?: number
          bid_number?: number | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          vault_instance_id: string
        }
        Update: {
          amount?: number
          bid_number?: number | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          vault_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fury_vault_logs_vault_instance_id_fkey"
            columns: ["vault_instance_id"]
            isOneToOne: false
            referencedRelation: "fury_vault_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_vault_qualifications: {
        Row: {
          created_at: string
          id: string
          is_qualified: boolean
          last_bid_at: string | null
          total_bids_in_auction: number
          updated_at: string
          user_id: string
          vault_instance_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_qualified?: boolean
          last_bid_at?: string | null
          total_bids_in_auction?: number
          updated_at?: string
          user_id: string
          vault_instance_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_qualified?: boolean
          last_bid_at?: string | null
          total_bids_in_auction?: number
          updated_at?: string
          user_id?: string
          vault_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fury_vault_qualifications_vault_instance_id_fkey"
            columns: ["vault_instance_id"]
            isOneToOne: false
            referencedRelation: "fury_vault_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      fury_vault_withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          source_vault_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          source_vault_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          source_vault_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fury_vault_withdrawals_source_vault_id_fkey"
            columns: ["source_vault_id"]
            isOneToOne: false
            referencedRelation: "fury_vault_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
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
          payment_id: string | null
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
          payment_id?: string | null
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
          payment_id?: string | null
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
      partner_binary_positions: {
        Row: {
          created_at: string
          id: string
          left_child_id: string | null
          left_points: number
          parent_contract_id: string | null
          partner_contract_id: string
          pending_position_expires_at: string | null
          pending_position_for: string | null
          position: string | null
          right_child_id: string | null
          right_points: number
          sponsor_contract_id: string | null
          total_left_points: number
          total_right_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          left_child_id?: string | null
          left_points?: number
          parent_contract_id?: string | null
          partner_contract_id: string
          pending_position_expires_at?: string | null
          pending_position_for?: string | null
          position?: string | null
          right_child_id?: string | null
          right_points?: number
          sponsor_contract_id?: string | null
          total_left_points?: number
          total_right_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          left_child_id?: string | null
          left_points?: number
          parent_contract_id?: string | null
          partner_contract_id?: string
          pending_position_expires_at?: string | null
          pending_position_for?: string | null
          position?: string | null
          right_child_id?: string | null
          right_points?: number
          sponsor_contract_id?: string | null
          total_left_points?: number
          total_right_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_binary_positions_left_child_id_fkey"
            columns: ["left_child_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_binary_positions_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_binary_positions_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: true
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_binary_positions_pending_position_for_fkey"
            columns: ["pending_position_for"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_binary_positions_right_child_id_fkey"
            columns: ["right_child_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_binary_positions_sponsor_contract_id_fkey"
            columns: ["sponsor_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contracts: {
        Row: {
          aporte_value: number
          available_balance: number
          bank_details: Json | null
          bonus_bids_received: number | null
          closed_at: string | null
          closed_reason: string | null
          cotas: number
          created_at: string
          financial_status: string
          financial_status_note: string | null
          financial_status_updated_at: string | null
          id: string
          is_demo: boolean
          payment_id: string | null
          payment_status: string | null
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
          weekly_cap: number
        }
        Insert: {
          aporte_value: number
          available_balance?: number
          bank_details?: Json | null
          bonus_bids_received?: number | null
          closed_at?: string | null
          closed_reason?: string | null
          cotas?: number
          created_at?: string
          financial_status?: string
          financial_status_note?: string | null
          financial_status_updated_at?: string | null
          id?: string
          is_demo?: boolean
          payment_id?: string | null
          payment_status?: string | null
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
          weekly_cap: number
        }
        Update: {
          aporte_value?: number
          available_balance?: number
          bank_details?: Json | null
          bonus_bids_received?: number | null
          closed_at?: string | null
          closed_reason?: string | null
          cotas?: number
          created_at?: string
          financial_status?: string
          financial_status_note?: string | null
          financial_status_updated_at?: string | null
          id?: string
          is_demo?: boolean
          payment_id?: string | null
          payment_status?: string | null
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
          weekly_cap?: number
        }
        Relationships: []
      }
      partner_early_terminations: {
        Row: {
          admin_notes: string | null
          aporte_original: number
          approved_at: string | null
          bids_amount: number | null
          created_at: string
          credits_amount: number | null
          discount_percentage: number
          final_value: number | null
          id: string
          liquidation_type: string
          paid_at: string | null
          partner_contract_id: string
          payout_reference: string | null
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
          approved_at?: string | null
          bids_amount?: number | null
          created_at?: string
          credits_amount?: number | null
          discount_percentage?: number
          final_value?: number | null
          id?: string
          liquidation_type: string
          paid_at?: string | null
          partner_contract_id: string
          payout_reference?: string | null
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
          approved_at?: string | null
          bids_amount?: number | null
          created_at?: string
          credits_amount?: number | null
          discount_percentage?: number
          final_value?: number | null
          id?: string
          liquidation_type?: string
          paid_at?: string | null
          partner_contract_id?: string
          payout_reference?: string | null
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
          reward_description: string | null
          reward_icon: string | null
          reward_type: string | null
          reward_value: number | null
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
          reward_description?: string | null
          reward_icon?: string | null
          reward_type?: string | null
          reward_value?: number | null
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
          reward_description?: string | null
          reward_icon?: string | null
          reward_type?: string | null
          reward_value?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_manual_credits: {
        Row: {
          amount: number
          consumes_cap: boolean
          created_at: string
          created_by: string
          credit_type: string
          description: string
          id: string
          partner_contract_id: string
        }
        Insert: {
          amount: number
          consumes_cap?: boolean
          created_at?: string
          created_by: string
          credit_type?: string
          description: string
          id?: string
          partner_contract_id: string
        }
        Update: {
          amount?: number
          consumes_cap?: boolean
          created_at?: string
          created_by?: string
          credit_type?: string
          description?: string
          id?: string
          partner_contract_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_manual_credits_contract_fk"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_network_exits: {
        Row: {
          cancelled_pending_count: number
          cancelled_pending_total: number
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          new_sponsor_contract_id: string | null
          new_sponsor_user_id: string | null
          old_binary_parent_contract_id: string | null
          old_binary_position: string | null
          old_sponsor_contract_id: string | null
          old_sponsor_user_id: string | null
          partner_contract_id: string
          partner_user_id: string
          reason: string | null
          reminders_sent: Json
          resolved_at: string | null
          reversed_available_count: number
          reversed_available_total: number
          status: string
        }
        Insert: {
          cancelled_pending_count?: number
          cancelled_pending_total?: number
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          new_sponsor_contract_id?: string | null
          new_sponsor_user_id?: string | null
          old_binary_parent_contract_id?: string | null
          old_binary_position?: string | null
          old_sponsor_contract_id?: string | null
          old_sponsor_user_id?: string | null
          partner_contract_id: string
          partner_user_id: string
          reason?: string | null
          reminders_sent?: Json
          resolved_at?: string | null
          reversed_available_count?: number
          reversed_available_total?: number
          status?: string
        }
        Update: {
          cancelled_pending_count?: number
          cancelled_pending_total?: number
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          new_sponsor_contract_id?: string | null
          new_sponsor_user_id?: string | null
          old_binary_parent_contract_id?: string | null
          old_binary_position?: string | null
          old_sponsor_contract_id?: string | null
          old_sponsor_user_id?: string | null
          partner_contract_id?: string
          partner_user_id?: string
          reason?: string | null
          reminders_sent?: Json
          resolved_at?: string | null
          reversed_available_count?: number
          reversed_available_total?: number
          status?: string
        }
        Relationships: []
      }
      partner_payment_intents: {
        Row: {
          aporte_value: number
          bonus_bids: number
          cotas: number
          created_at: string
          expires_at: string | null
          id: string
          payment_id: string | null
          payment_status: string
          plan_id: string
          plan_name: string
          referral_code: string | null
          referred_by_user_id: string | null
          total_cap: number
          user_id: string
          weekly_cap: number
        }
        Insert: {
          aporte_value: number
          bonus_bids?: number
          cotas?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_status?: string
          plan_id: string
          plan_name: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          total_cap: number
          user_id: string
          weekly_cap: number
        }
        Update: {
          aporte_value?: number
          bonus_bids?: number
          cotas?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_status?: string
          plan_id?: string
          plan_name?: string
          referral_code?: string | null
          referred_by_user_id?: string | null
          total_cap?: number
          user_id?: string
          weekly_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_payment_intents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "partner_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          calculated_amount: number
          created_at: string
          id: string
          paid_at: string | null
          partner_contract_id: string
          period_end: string | null
          period_start: string
          referral_bonus_id: string | null
          source: string
          status: string
          total_cap_applied: boolean
          weekly_cap_applied: boolean
        }
        Insert: {
          amount: number
          calculated_amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_contract_id: string
          period_end?: string | null
          period_start: string
          referral_bonus_id?: string | null
          source?: string
          status?: string
          total_cap_applied?: boolean
          weekly_cap_applied?: boolean
        }
        Update: {
          amount?: number
          calculated_amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_contract_id?: string
          period_end?: string | null
          period_start?: string
          referral_bonus_id?: string | null
          source?: string
          status?: string
          total_cap_applied?: boolean
          weekly_cap_applied?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_referral_bonus_id_fkey"
            columns: ["referral_bonus_id"]
            isOneToOne: true
            referencedRelation: "partner_referral_bonuses"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_plans: {
        Row: {
          aporte_value: number
          bonus_bids: number | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          max_cotas: number
          monthly_return_cap: number
          name: string
          referral_bonus_percentage: number | null
          sort_order: number
          total_cap: number
          total_return_cap: number
          updated_at: string
          weekly_cap: number
        }
        Insert: {
          aporte_value: number
          bonus_bids?: number | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          max_cotas?: number
          monthly_return_cap?: number
          name: string
          referral_bonus_percentage?: number | null
          sort_order?: number
          total_cap: number
          total_return_cap?: number
          updated_at?: string
          weekly_cap: number
        }
        Update: {
          aporte_value?: number
          bonus_bids?: number | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          max_cotas?: number
          monthly_return_cap?: number
          name?: string
          referral_bonus_percentage?: number | null
          sort_order?: number
          total_cap?: number
          total_return_cap?: number
          updated_at?: string
          weekly_cap?: number
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
          is_fast_start_bonus: boolean
          paid_at: string | null
          referral_level: number
          referred_contract_id: string
          referred_user_id: string
          referrer_contract_id: string
          source_event: string
          status: string
          suspended_expires_at: string | null
        }
        Insert: {
          aporte_value: number
          available_at?: string | null
          bonus_percentage?: number
          bonus_value: number
          created_at?: string
          id?: string
          is_fast_start_bonus?: boolean
          paid_at?: string | null
          referral_level?: number
          referred_contract_id: string
          referred_user_id: string
          referrer_contract_id: string
          source_event?: string
          status?: string
          suspended_expires_at?: string | null
        }
        Update: {
          aporte_value?: number
          available_at?: string | null
          bonus_percentage?: number
          bonus_value?: number
          created_at?: string
          id?: string
          is_fast_start_bonus?: boolean
          paid_at?: string | null
          referral_level?: number
          referred_contract_id?: string
          referred_user_id?: string
          referrer_contract_id?: string
          source_event?: string
          status?: string
          suspended_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_referral_bonuses_referred_contract_id_fkey"
            columns: ["referred_contract_id"]
            isOneToOne: false
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
          new_plan_name: string
          new_total_cap: number
          new_weekly_cap: number
          notes: string | null
          partner_contract_id: string
          previous_aporte_value: number
          previous_plan_name: string
          previous_total_cap: number
          previous_weekly_cap: number
          total_received_at_upgrade: number
        }
        Insert: {
          created_at?: string
          difference_paid: number
          id?: string
          new_aporte_value: number
          new_plan_name: string
          new_total_cap: number
          new_weekly_cap: number
          notes?: string | null
          partner_contract_id: string
          previous_aporte_value: number
          previous_plan_name: string
          previous_total_cap: number
          previous_weekly_cap: number
          total_received_at_upgrade?: number
        }
        Update: {
          created_at?: string
          difference_paid?: number
          id?: string
          new_aporte_value?: number
          new_plan_name?: string
          new_total_cap?: number
          new_weekly_cap?: number
          notes?: string | null
          partner_contract_id?: string
          previous_aporte_value?: number
          previous_plan_name?: string
          previous_total_cap?: number
          previous_weekly_cap?: number
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
      partner_weekly_eligibility: {
        Row: {
          calculated_at: string
          created_at: string
          id: string
          metadata: Json
          partner_user_id: string
          percentage: number
          reason: string | null
          status: string
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          partner_user_id: string
          percentage?: number
          reason?: string | null
          status: string
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          partner_user_id?: string
          percentage?: number
          reason?: string | null
          status?: string
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      partner_weekly_scores: {
        Row: {
          active_days: number
          breakdown: Json
          calculated_at: string
          click_points: number
          conversion_points: number
          created_at: string
          id: string
          partner_user_id: string
          total_points: number
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          active_days?: number
          breakdown?: Json
          calculated_at?: string
          click_points?: number
          conversion_points?: number
          created_at?: string
          id?: string
          partner_user_id: string
          total_points?: number
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          active_days?: number
          breakdown?: Json
          calculated_at?: string
          click_points?: number
          conversion_points?: number
          created_at?: string
          id?: string
          partner_user_id?: string
          total_points?: number
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      partner_withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          fee_amount: number
          fee_percentage: number
          id: string
          net_amount: number | null
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
          fee_amount?: number
          fee_percentage?: number
          id?: string
          net_amount?: number | null
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
          fee_amount?: number
          fee_percentage?: number
          id?: string
          net_amount?: number | null
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
      payment_reversal_events: {
        Row: {
          amount: number | null
          applied_at: string | null
          bid_lot_id: string | null
          bid_purchase_id: string | null
          created_at: string
          gateway_event_id: string | null
          id: string
          notes: string | null
          reversal_case_id: string | null
          reversal_type: string
          status: string
        }
        Insert: {
          amount?: number | null
          applied_at?: string | null
          bid_lot_id?: string | null
          bid_purchase_id?: string | null
          created_at?: string
          gateway_event_id?: string | null
          id?: string
          notes?: string | null
          reversal_case_id?: string | null
          reversal_type: string
          status?: string
        }
        Update: {
          amount?: number | null
          applied_at?: string | null
          bid_lot_id?: string | null
          bid_purchase_id?: string | null
          created_at?: string
          gateway_event_id?: string | null
          id?: string
          notes?: string | null
          reversal_case_id?: string | null
          reversal_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reversal_events_bid_lot_id_fkey"
            columns: ["bid_lot_id"]
            isOneToOne: false
            referencedRelation: "bid_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reversal_events_bid_purchase_id_fkey"
            columns: ["bid_purchase_id"]
            isOneToOne: false
            referencedRelation: "bid_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reversal_events_reversal_case_id_fkey"
            columns: ["reversal_case_id"]
            isOneToOne: false
            referencedRelation: "points_reversal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string | null
          entity_id: string | null
          error_message: string | null
          id: string
          metadata: Json
          target_partner_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          target_partner_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          target_partner_user_id?: string | null
        }
        Relationships: []
      }
      performance_backfill_issues: {
        Row: {
          action_taken: string
          affected_user_ids: string[] | null
          created_at: string
          details: Json
          id: string
          issue_type: string
          referral_code: string | null
          requires_manual_fix: boolean
          resolved_at: string | null
        }
        Insert: {
          action_taken: string
          affected_user_ids?: string[] | null
          created_at?: string
          details?: Json
          id?: string
          issue_type: string
          referral_code?: string | null
          requires_manual_fix?: boolean
          resolved_at?: string | null
        }
        Update: {
          action_taken?: string
          affected_user_ids?: string[] | null
          created_at?: string
          details?: Json
          id?: string
          issue_type?: string
          referral_code?: string | null
          requires_manual_fix?: boolean
          resolved_at?: string | null
        }
        Relationships: []
      }
      performance_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
          value_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
          value_type?: string
        }
        Relationships: []
      }
      platform_downloads: {
        Row: {
          category: Database["public"]["Enums"]["download_category"]
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          download_count: number
          file_name: string
          file_size: number
          id: string
          is_active: boolean
          mime_type: string | null
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["download_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          download_count?: number
          file_name: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["download_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          download_count?: number
          file_name?: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      points_accrual_buckets: {
        Row: {
          campaign_id: string | null
          eligible_bids_remaining: number
          id: string
          rule_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          eligible_bids_remaining?: number
          id?: string
          rule_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          eligible_bids_remaining?: number
          id?: string
          rule_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_accrual_buckets_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "points_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      points_bid_reconciliation_queue: {
        Row: {
          available_amount: number | null
          bid_id: string | null
          created_at: string
          id: string
          reason: string
          requested_amount: number
          user_id: string
        }
        Insert: {
          available_amount?: number | null
          bid_id?: string | null
          created_at?: string
          id?: string
          reason: string
          requested_amount: number
          user_id: string
        }
        Update: {
          available_amount?: number | null
          bid_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          requested_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_bid_reconciliation_queue_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          admin_id: string | null
          auction_id: string | null
          available_after: number
          available_before: number
          campaign_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          payment_id: string | null
          points_delta: number
          reason: string | null
          redemption_id: string | null
          reserved_after: number
          reserved_before: number
          rule_id: string | null
          settlement_id: string | null
          transaction_type: Database["public"]["Enums"]["points_ledger_type"]
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          auction_id?: string | null
          available_after: number
          available_before: number
          campaign_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payment_id?: string | null
          points_delta: number
          reason?: string | null
          redemption_id?: string | null
          reserved_after: number
          reserved_before: number
          rule_id?: string | null
          settlement_id?: string | null
          transaction_type: Database["public"]["Enums"]["points_ledger_type"]
          user_id: string
        }
        Update: {
          admin_id?: string | null
          auction_id?: string | null
          available_after?: number
          available_before?: number
          campaign_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payment_id?: string | null
          points_delta?: number
          reason?: string | null
          redemption_id?: string | null
          reserved_after?: number
          reserved_before?: number
          rule_id?: string | null
          settlement_id?: string | null
          transaction_type?: Database["public"]["Enums"]["points_ledger_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "points_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      points_program_settings_audit: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          key: string
          new_value: string | null
          old_value: string | null
          table_type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          key: string
          new_value?: string | null
          old_value?: string | null
          table_type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          key?: string
          new_value?: string | null
          old_value?: string | null
          table_type?: string
        }
        Relationships: []
      }
      points_program_settings_bool: {
        Row: {
          is_admin_only: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: boolean
        }
        Insert: {
          is_admin_only?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: boolean
        }
        Update: {
          is_admin_only?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: boolean
        }
        Relationships: []
      }
      points_program_settings_json: {
        Row: {
          is_admin_only: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_admin_only?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_admin_only?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      points_program_settings_num: {
        Row: {
          is_admin_only: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          is_admin_only?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          is_admin_only?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      points_program_settings_time: {
        Row: {
          is_admin_only: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          is_admin_only?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          is_admin_only?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      points_redemption_items: {
        Row: {
          created_at: string
          id: string
          internal_cost_snapshot: number | null
          item_id: string
          item_snapshot: Json
          points_total: number
          points_unit: number
          quantity: number
          redemption_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_cost_snapshot?: number | null
          item_id: string
          item_snapshot: Json
          points_total: number
          points_unit: number
          quantity: number
          redemption_id: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_cost_snapshot?: number | null
          item_id?: string
          item_snapshot?: Json
          points_total?: number
          points_unit?: number
          quantity?: number
          redemption_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_redemption_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "points_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_redemption_items_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "points_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      points_redemption_status_history: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["points_redemption_status"]
          old_status:
            | Database["public"]["Enums"]["points_redemption_status"]
            | null
          reason: string | null
          redemption_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["points_redemption_status"]
          old_status?:
            | Database["public"]["Enums"]["points_redemption_status"]
            | null
          reason?: string | null
          redemption_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["points_redemption_status"]
          old_status?:
            | Database["public"]["Enums"]["points_redemption_status"]
            | null
          reason?: string | null
          redemption_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_redemption_status_history_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "points_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      points_redemptions: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          carrier: string | null
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string | null
          order_number: string
          rejected_at: string | null
          shipped_at: string | null
          shipping_address_snapshot: Json | null
          shipping_cost: number | null
          shipping_method: string | null
          status: Database["public"]["Enums"]["points_redemption_status"]
          total_points: number
          tracking_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_number?: string
          rejected_at?: string | null
          shipped_at?: string | null
          shipping_address_snapshot?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["points_redemption_status"]
          total_points: number
          tracking_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string | null
          order_number?: string
          rejected_at?: string | null
          shipped_at?: string | null
          shipping_address_snapshot?: Json | null
          shipping_cost?: number | null
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["points_redemption_status"]
          total_points?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      points_reversal_cases: {
        Row: {
          bid_purchase_id: string | null
          created_at: string
          id: string
          lot_id: string | null
          metadata: Json
          payment_id: string | null
          points_outstanding: number
          points_recovered: number
          points_to_reverse: number
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          settlement_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          bid_purchase_id?: string | null
          created_at?: string
          id?: string
          lot_id?: string | null
          metadata?: Json
          payment_id?: string | null
          points_outstanding?: number
          points_recovered?: number
          points_to_reverse?: number
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          bid_purchase_id?: string | null
          created_at?: string
          id?: string
          lot_id?: string | null
          metadata?: Json
          payment_id?: string | null
          points_outstanding?: number
          points_recovered?: number
          points_to_reverse?: number
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_reversal_cases_bid_purchase_id_fkey"
            columns: ["bid_purchase_id"]
            isOneToOne: false
            referencedRelation: "bid_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_reversal_cases_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "bid_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      points_rules: {
        Row: {
          active_from: string
          active_to: string | null
          bids_per_point: number
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json
          multiplier: number
          name: string
          points_per_block: number
          rule_code: string
          updated_at: string
          version: number
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          bids_per_point: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          multiplier?: number
          name: string
          points_per_block: number
          rule_code: string
          updated_at?: string
          version: number
        }
        Update: {
          active_from?: string
          active_to?: string | null
          bids_per_point?: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          multiplier?: number
          name?: string
          points_per_block?: number
          rule_code?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      points_store_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      points_store_inventory_movements: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["points_inventory_movement_type"]
          quantity_delta: number
          reason: string | null
          redemption_id: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["points_inventory_movement_type"]
          quantity_delta: number
          reason?: string | null
          redemption_id?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["points_inventory_movement_type"]
          quantity_delta?: number
          reason?: string | null
          redemption_id?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "points_store_inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "points_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      points_store_item_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          item_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          item_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          item_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_store_item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "points_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      points_store_item_price_history: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          item_id: string
          new_cost_points: number
          old_cost_points: number | null
          reason: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          new_cost_points: number
          old_cost_points?: number | null
          reason?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          new_cost_points?: number
          old_cost_points?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_store_item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "points_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      points_store_items: {
        Row: {
          brand: string | null
          category_id: string | null
          cost_points: number
          created_at: string
          dimensions: Json | null
          ends_at: string | null
          estimated_days: number | null
          featured: boolean
          free_shipping: boolean
          full_description: string | null
          id: string
          internal_cost_brl: number | null
          item_type: Database["public"]["Enums"]["points_store_item_type"]
          main_image_url: string | null
          model: string | null
          name: string
          on_demand: boolean
          per_user_limit: number | null
          reference_value_brl: number | null
          short_description: string | null
          sku: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["points_store_item_status"]
          stock_available: number | null
          stock_min: number
          stock_reserved: number
          stock_total: number
          supplier: string | null
          updated_at: string
          weight_g: number | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          cost_points: number
          created_at?: string
          dimensions?: Json | null
          ends_at?: string | null
          estimated_days?: number | null
          featured?: boolean
          free_shipping?: boolean
          full_description?: string | null
          id?: string
          internal_cost_brl?: number | null
          item_type?: Database["public"]["Enums"]["points_store_item_type"]
          main_image_url?: string | null
          model?: string | null
          name: string
          on_demand?: boolean
          per_user_limit?: number | null
          reference_value_brl?: number | null
          short_description?: string | null
          sku?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["points_store_item_status"]
          stock_available?: number | null
          stock_min?: number
          stock_reserved?: number
          stock_total?: number
          supplier?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          cost_points?: number
          created_at?: string
          dimensions?: Json | null
          ends_at?: string | null
          estimated_days?: number | null
          featured?: boolean
          free_shipping?: boolean
          full_description?: string | null
          id?: string
          internal_cost_brl?: number | null
          item_type?: Database["public"]["Enums"]["points_store_item_type"]
          main_image_url?: string | null
          model?: string | null
          name?: string
          on_demand?: boolean
          per_user_limit?: number | null
          reference_value_brl?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["points_store_item_status"]
          stock_available?: number | null
          stock_min?: number
          stock_reserved?: number
          stock_total?: number
          supplier?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_store_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "points_store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      points_wallets: {
        Row: {
          available_points: number
          blocked_points: number
          created_at: string
          expired_points: number
          lifetime_earned: number
          lifetime_redeemed: number
          lifetime_reversed: number
          reserved_points: number
          status: Database["public"]["Enums"]["points_wallet_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          available_points?: number
          blocked_points?: number
          created_at?: string
          expired_points?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          lifetime_reversed?: number
          reserved_points?: number
          status?: Database["public"]["Enums"]["points_wallet_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          available_points?: number
          blocked_points?: number
          created_at?: string
          expired_points?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          lifetime_reversed?: number
          reserved_points?: number
          status?: Database["public"]["Enums"]["points_wallet_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_templates: {
        Row: {
          bid_cost: number | null
          bid_increment: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_key: string | null
          image_source: string
          image_url: string | null
          is_active: boolean | null
          market_value: number | null
          min_hours_between_appearances: number
          revenue_target: number | null
          starting_price: number | null
          tier: string
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
          image_key?: string | null
          image_source?: string
          image_url?: string | null
          is_active?: boolean | null
          market_value?: number | null
          min_hours_between_appearances?: number
          revenue_target?: number | null
          starting_price?: number | null
          tier?: string
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
          image_key?: string | null
          image_source?: string
          image_url?: string | null
          is_active?: boolean | null
          market_value?: number | null
          min_hours_between_appearances?: number
          revenue_target?: number | null
          starting_price?: number | null
          tier?: string
          times_used?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          bettor_contract_accepted_at: string | null
          bettor_contract_version: string | null
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
          is_test_account: boolean
          neighborhood: string | null
          number: string | null
          phone: string | null
          profile_complete: boolean
          referred_by_partner_code: string | null
          signup_bonus_amount: number | null
          signup_bonus_date: string | null
          signup_bonus_received: boolean | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bettor_contract_accepted_at?: string | null
          bettor_contract_version?: string | null
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
          is_test_account?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_complete?: boolean
          referred_by_partner_code?: string | null
          signup_bonus_amount?: number | null
          signup_bonus_date?: string | null
          signup_bonus_received?: boolean | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bettor_contract_accepted_at?: string | null
          bettor_contract_version?: string | null
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
          is_test_account?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_complete?: boolean
          referred_by_partner_code?: string | null
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
      referral_level_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: number
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level: number
          percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          campaign_slug: string | null
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          partner_user_id: string
          referral_code: string
          source: string
          updated_at: string
        }
        Insert: {
          campaign_slug?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          partner_user_id: string
          referral_code: string
          source?: string
          updated_at?: string
        }
        Update: {
          campaign_slug?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          partner_user_id?: string
          referral_code?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlement_acceptances: {
        Row: {
          accepted_at: string
          browser: string | null
          declaration_text: string
          device: string | null
          discounts: number
          gross_amount: number
          id: string
          ip_address: unknown
          liquidation_type: string
          net_amount: number
          os: string | null
          partner_contract_id: string
          penalty: number
          processing_error: string | null
          processing_status: string
          quote_id: string | null
          receipt_html: string | null
          route: string | null
          termination_id: string | null
          terms_hash: string
          terms_text: string
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          browser?: string | null
          declaration_text: string
          device?: string | null
          discounts: number
          gross_amount: number
          id?: string
          ip_address?: unknown
          liquidation_type: string
          net_amount: number
          os?: string | null
          partner_contract_id: string
          penalty: number
          processing_error?: string | null
          processing_status?: string
          quote_id?: string | null
          receipt_html?: string | null
          route?: string | null
          termination_id?: string | null
          terms_hash: string
          terms_text: string
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          browser?: string | null
          declaration_text?: string
          device?: string | null
          discounts?: number
          gross_amount?: number
          id?: string
          ip_address?: unknown
          liquidation_type?: string
          net_amount?: number
          os?: string | null
          partner_contract_id?: string
          penalty?: number
          processing_error?: string | null
          processing_status?: string
          quote_id?: string | null
          receipt_html?: string | null
          route?: string | null
          termination_id?: string | null
          terms_hash?: string
          terms_text?: string
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_acceptances_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "settlement_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_quotes: {
        Row: {
          consumed_at: string | null
          created_at: string
          discounts: number
          expires_at: string
          gross_amount: number
          id: string
          liquidation_type: string
          net_amount: number
          partner_contract_id: string
          penalty: number
          termination_id: string | null
          terms_hash: string
          terms_text: string
          terms_version: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          discounts?: number
          expires_at: string
          gross_amount?: number
          id?: string
          liquidation_type: string
          net_amount?: number
          partner_contract_id: string
          penalty?: number
          termination_id?: string | null
          terms_hash: string
          terms_text: string
          terms_version: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          discounts?: number
          expires_at?: string
          gross_amount?: number
          id?: string
          liquidation_type?: string
          net_amount?: number
          partner_contract_id?: string
          penalty?: number
          termination_id?: string | null
          terms_hash?: string
          terms_text?: string
          terms_version?: string
          user_id?: string
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
      tracking_events: {
        Row: {
          created_at: string
          event_type: string
          fraud_flags: Json
          id: string
          ip_hash: string | null
          is_qualified: boolean
          is_suspicious: boolean
          landing_url: string | null
          metadata: Json
          partner_user_id: string | null
          referral_code: string | null
          referrer: string | null
          session_id: string | null
          ua_hash: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          fraud_flags?: Json
          id?: string
          ip_hash?: string | null
          is_qualified?: boolean
          is_suspicious?: boolean
          landing_url?: string | null
          metadata?: Json
          partner_user_id?: string | null
          referral_code?: string | null
          referrer?: string | null
          session_id?: string | null
          ua_hash?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          fraud_flags?: Json
          id?: string
          ip_hash?: string | null
          is_qualified?: boolean
          is_suspicious?: boolean
          landing_url?: string | null
          metadata?: Json
          partner_user_id?: string | null
          referral_code?: string | null
          referrer?: string | null
          session_id?: string | null
          ua_hash?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
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
      _bot_finalize_auction: {
        Args: {
          p_auction_id: string
          p_current_time: string
          p_finish_reason: string
          p_title: string
        }
        Returns: undefined
      }
      _points_ensure_wallet: { Args: { p_user: string }; Returns: undefined }
      _schedule_bot_only_finalization: {
        Args: { p_auction_id: string; p_reason: string; p_title: string }
        Returns: string
      }
      admin_adjust_affiliate_balance: {
        Args: {
          _admin_name: string
          _affiliate_id: string
          _amount: number
          _reason: string
        }
        Returns: number
      }
      admin_get_cron_jobs_status: {
        Args: never
        Returns: {
          active: boolean
          duration_ms: number
          jobid: number
          jobname: string
          last_end: string
          last_return_message: string
          last_start: string
          last_status: string
          schedule: string
        }[]
      }
      admin_get_partner_display_names: {
        Args: { partner_ids: string[] }
        Returns: {
          affiliate_code: string
          display_name: string
          email: string
          full_name: string
          id: string
          referral_code: string
        }[]
      }
      admin_preview_partner_sponsor_transfer: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      admin_recalculate_week: { Args: { p_week_start: string }; Returns: Json }
      admin_release_stuck_auctions: {
        Args: { p_ids: string[] }
        Returns: {
          auction_id: string
          new_ends_at: string
        }[]
      }
      admin_transfer_partner_sponsor: {
        Args: {
          p_cancel_pending_bonuses?: boolean
          p_contract_id: string
          p_new_sponsor_user_id: string
          p_reason?: string
          p_remove_from_binary?: boolean
          p_reverse_available_bonuses?: boolean
        }
        Returns: Json
      }
      archive_old_finished_auctions: { Args: never; Returns: undefined }
      attribute_conversion: {
        Args: {
          p_conversion_id: string
          p_conversion_type: string
          p_metadata?: Json
          p_user_id: string
          p_visitor_id?: string
        }
        Returns: Json
      }
      bot_protection_loop: { Args: never; Returns: undefined }
      bot_protection_loop_safe: { Args: never; Returns: undefined }
      bot_tick: { Args: never; Returns: undefined }
      bot_tick_safe: { Args: never; Returns: undefined }
      calculate_all_partner_weekly_scores: {
        Args: { p_week_start: string }
        Returns: Json
      }
      calculate_early_termination: {
        Args: { p_partner_contract_id: string }
        Returns: Json
      }
      calculate_partner_weekly_score: {
        Args: { p_partner_user_id: string; p_week_start: string }
        Returns: Json
      }
      check_affiliate_code_availability: {
        Args: { code_to_check: string }
        Returns: boolean
      }
      check_contract_version_status: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      cleanup_old_bids_batch: { Args: never; Returns: undefined }
      close_binary_cycle: {
        Args: { p_admin_id: string; p_notes?: string }
        Returns: Json
      }
      commit_bid_lot_consumptions: {
        Args: { p_bid_id: string; p_rows: Json }
        Returns: undefined
      }
      complete_oauth_profile: {
        Args: {
          p_affiliate_referral_code?: string
          p_birth_date: string
          p_cep: string
          p_city: string
          p_complement: string
          p_cpf: string
          p_full_name: string
          p_neighborhood: string
          p_number: string
          p_partner_referral_code?: string
          p_phone: string
          p_state: string
          p_street: string
        }
        Returns: Json
      }
      consume_bid_lots: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      consume_bid_lots_for_bid: {
        Args: { p_amount: number; p_bid_id: string; p_user_id: string }
        Returns: boolean
      }
      credit_paid_bid_purchase: {
        Args: {
          p_amount_paid: number
          p_bid_purchase_id: string
          p_bids_amount: number
          p_external_payment_id: string
          p_gateway_account_id: string
          p_gateway_event_id: string
          p_gateway_payload_hash: string
          p_payment_confirmed_at: string
          p_payment_created_at: string
          p_payment_environment: string
          p_payment_gateway: string
          p_user_id: string
          p_webhook_received_at?: string
        }
        Returns: Json
      }
      credit_purchase_bids: {
        Args: { p_amount: number; p_purchase_id?: string; p_user_id: string }
        Returns: number
      }
      current_server_time: { Args: never; Returns: string }
      decrement_auction_timers: { Args: never; Returns: undefined }
      ensure_partner_referral_bonuses: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      execute_overdue_bot_bids: { Args: never; Returns: Json }
      execute_overdue_bot_bids_safe: { Args: never; Returns: undefined }
      execute_panic_bids: { Args: never; Returns: Json }
      expire_bid_lots: {
        Args: never
        Returns: {
          expired_lots: number
          expired_total: number
        }[]
      }
      expire_suspended_bonuses: { Args: never; Returns: undefined }
      finalize_partner_settlement_acceptance: {
        Args: {
          p_browser: string
          p_declaration_text: string
          p_device: string
          p_ip: string
          p_os: string
          p_quote_id: string
          p_route: string
          p_user_agent: string
        }
        Returns: Json
      }
      find_orphan_binary_points: {
        Args: never
        Returns: {
          leg: string
          orphan_points: number
          partner_contract_id: string
          partner_name: string
          plan_name: string
        }[]
      }
      fix_partner_referral: {
        Args: { p_referral_code: string; p_referred_contract_id: string }
        Returns: Json
      }
      fury_vault_distribute: {
        Args: { p_auction_id: string }
        Returns: undefined
      }
      fury_vault_on_bid: {
        Args: { p_auction_id: string; p_bid_number: number }
        Returns: undefined
      }
      generate_partner_evidence_report: {
        Args: { p_partner_contract_id: string }
        Returns: Json
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
      get_affiliate_commission_rates: {
        Args: { _affiliate_id: string }
        Returns: {
          first_purchase_rate: number
          repurchase_rate: number
        }[]
      }
      get_affiliate_eligibility: {
        Args: { _user_id: string }
        Returns: {
          eligible: boolean
          manager_affiliate_id: string
          reason: string
          role: string
        }[]
      }
      get_affiliate_purchase_details: {
        Args: { _affiliate_id: string; _page?: number; _page_size?: number }
        Returns: {
          bids_purchased: number
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          is_repurchase: boolean
          package_name: string
          purchase_amount: number
          referred_user_name: string
          status: string
          total_count: number
        }[]
      }
      get_affiliate_referral_contacts: {
        Args: { _affiliate_id: string; _user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
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
          avg_time_between_bids: string
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
      get_binary_tree: {
        Args: { p_contract_id: string; p_depth?: number }
        Returns: Json
      }
      get_contract_by_referral_code: {
        Args: { code: string }
        Returns: {
          id: string
          plan_name: string
          referral_code: string
          user_id: string
        }[]
      }
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
      get_manager_influencer_metrics: {
        Args: { p_manager_affiliate_id: string }
        Returns: {
          affiliate_code: string
          conversion_rate: number
          email: string
          full_name: string
          influencer_affiliate_id: string
          influencer_user_id: string
          link_id: string
          override_rate: number
          recruited_at: string
          status: string
          total_clicks: number
          total_commission: number
          total_override: number
          total_sales: number
          total_signups: number
          unique_buyers: number
        }[]
      }
      get_partner_performance_dashboard: {
        Args: { p_partner_user_id: string }
        Returns: Json
      }
      get_partner_performance_history: {
        Args: { _weeks?: number }
        Returns: {
          click_points: number
          conversion_points: number
          total_points: number
          week_start: string
        }[]
      }
      get_partner_performance_summary: {
        Args: { _week_start: string }
        Returns: {
          active_days: number
          click_points: number
          contracts_approved: number
          conversion_points: number
          purchases_approved: number
          qualified_clicks: number
          referral_code: string
          signups: number
          suspicious_clicks: number
          total_points: number
          week_rank: number
          week_total_partners: number
        }[]
      }
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          full_name: string
        }[]
      }
      get_public_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      get_random_bot: { Args: never; Returns: string }
      get_referred_contracts_info: {
        Args: { contract_ids: string[] }
        Returns: {
          id: string
          plan_name: string
          referred_by_user_id: string
          user_id: string
        }[]
      }
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
      get_user_affiliate_id: { Args: { _user_id: string }; Returns: string }
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
      increment_platform_download: {
        Args: { p_id: string }
        Returns: undefined
      }
      is_admin_user: { Args: { user_uuid: string }; Returns: boolean }
      is_affiliate_manager: { Args: { _user_id: string }; Returns: boolean }
      is_auction_final_for_points: {
        Args: { p_auction_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
      log_evidence_access: {
        Args: {
          p_acceptance_id: string
          p_action: string
          p_ip?: string
          p_partner_contract_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      notify_bid_expirations: {
        Args: never
        Returns: {
          users_notified: number
          window_label: string
        }[]
      }
      notify_user: {
        Args: {
          p_email_data?: Json
          p_email_type?: string
          p_link?: string
          p_message?: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      panic_tick_loop: { Args: never; Returns: undefined }
      partner_check_leave_eligibility: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      partner_choose_new_sponsor: {
        Args: { p_contract_id: string; p_new_sponsor_user_id: string }
        Returns: Json
      }
      partner_get_binary_downline: {
        Args: { p_contract_id: string }
        Returns: {
          contract_id: string
        }[]
      }
      partner_leave_sponsor_network: {
        Args: { p_contract_id: string; p_ip?: string; p_reason?: string }
        Returns: Json
      }
      partner_preview_leave_network: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      partner_process_expired_network_exits: { Args: never; Returns: Json }
      partner_request_leave_sponsor: {
        Args: { p_contract_id: string; p_ip?: string; p_reason?: string }
        Returns: Json
      }
      partner_search_eligible_sponsors: {
        Args: { p_contract_id: string; p_term: string }
        Returns: {
          contract_id: string
          email: string
          full_name: string
          plan_name: string
          user_id: string
        }[]
      }
      partner_send_network_exit_reminders: { Args: never; Returns: Json }
      place_bid: {
        Args: { p_auction_id: string; p_user_id: string }
        Returns: undefined
      }
      place_bid_as: {
        Args: { p_actor: string; p_auction: string; p_target: string }
        Returns: undefined
      }
      points_admin_activate_pilot: {
        Args: {
          p_audience_mode?: string
          p_cutoff: string
          p_pilot_user_ids: string[]
          p_rule_id: string
        }
        Returns: Json
      }
      points_admin_adjust: {
        Args: {
          p_admin: string
          p_delta: number
          p_idem: string
          p_reason: string
          p_user: string
        }
        Returns: string
      }
      points_admin_set_bool: {
        Args: { p_key: string; p_value: boolean }
        Returns: undefined
      }
      points_admin_set_json: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      points_admin_set_num: {
        Args: { p_key: string; p_value: number }
        Returns: undefined
      }
      points_admin_set_time: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      points_audience_mode: { Args: never; Returns: string }
      points_audience_version: { Args: never; Returns: number }
      points_canonical_credit_active: { Args: never; Returns: string }
      points_confirm_reservation: {
        Args: {
          p_amount: number
          p_idem: string
          p_redemption: string
          p_user: string
        }
        Returns: string
      }
      points_get_bool: {
        Args: { p_default?: boolean; p_key: string }
        Returns: boolean
      }
      points_get_json: { Args: { p_key: string }; Returns: Json }
      points_get_num: {
        Args: { p_default?: number; p_key: string }
        Returns: number
      }
      points_get_time: { Args: { p_key: string }; Returns: string }
      points_is_admin: { Args: { _uid: string }; Returns: boolean }
      points_release_reservation: {
        Args: {
          p_amount: number
          p_idem: string
          p_redemption: string
          p_user: string
        }
        Returns: string
      }
      points_reserve: {
        Args: {
          p_amount: number
          p_idem: string
          p_redemption: string
          p_user: string
        }
        Returns: string
      }
      points_reverse_settlement: {
        Args: { p_reason: string; p_settlement_id: string }
        Returns: string
      }
      points_rule_has_dependencies: {
        Args: { _rule_id: string }
        Returns: boolean
      }
      points_settle_auction: {
        Args: { p_actor?: string; p_auction_id: string; p_reason?: string }
        Returns: string
      }
      points_user_in_audience: { Args: { _user_id: string }; Returns: boolean }
      position_partner_binary: {
        Args: {
          p_contract_id: string
          p_position: string
          p_sponsor_contract_id: string
        }
        Returns: Json
      }
      preview_binary_cycle_closure: { Args: never; Returns: Json }
      preview_consume_bid_lots: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          bid_purchase_id: string
          eligible: boolean
          lot_id: string
          source: string
          take: number
        }[]
      }
      process_fast_start_bonus: {
        Args: { p_contract_id: string; p_tier_id: string }
        Returns: undefined
      }
      process_partner_referral_bonus: {
        Args: { p_referred_contract_id: string; p_referrer_user_id: string }
        Returns: Json
      }
      propagate_binary_points:
        | {
            Args: {
              p_points: number
              p_reason?: string
              p_source_contract_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_points: number
              p_reason?: string
              p_source_contract_id: string
              p_sponsor_contract_id?: string
            }
            Returns: number
          }
      rebuild_auction_last_bidders: {
        Args: { p_auction_id: string }
        Returns: Json
      }
      recalc_partner_contract_totals: {
        Args: { _contract_id: string }
        Returns: undefined
      }
      redeem_approve: {
        Args: { p_admin: string; p_notes: string; p_redemption: string }
        Returns: undefined
      }
      redeem_cancel: {
        Args: { p_reason: string; p_redemption: string }
        Returns: undefined
      }
      redeem_create: {
        Args: { p_idem: string; p_items: Json; p_shipping: Json }
        Returns: string
      }
      redeem_reject: {
        Args: { p_admin: string; p_reason: string; p_redemption: string }
        Returns: undefined
      }
      register_contract_acceptance: {
        Args: {
          p_accepted_at_client?: string
          p_browser?: string
          p_contract_type: string
          p_declaration_text: string
          p_device?: string
          p_extra?: Json
          p_ip?: string
          p_origin: string
          p_os?: string
          p_partner_contract_id?: string
          p_payment_reference?: string
          p_plan_name?: string
          p_plan_value?: number
          p_route?: string
          p_user_agent?: string
        }
        Returns: string
      }
      release_pending_referral_bonuses: { Args: never; Returns: number }
      release_protection_lock: { Args: never; Returns: boolean }
      resolve_manager_by_ref_code: {
        Args: { _ref_code: string }
        Returns: string
      }
      reverse_orphan_binary_points: {
        Args: { p_contract_id: string; p_leg: string; p_reason_note: string }
        Returns: Json
      }
      reverse_paid_bid_purchase: {
        Args: {
          p_amount?: number
          p_bid_purchase_id: string
          p_gateway_event_id: string
          p_notes?: string
          p_reversal_type: string
        }
        Returns: Json
      }
      reverse_performance_points: {
        Args: {
          p_conversion_id: string
          p_conversion_type: string
          p_reason: string
        }
        Returns: Json
      }
      store_visible_for: { Args: { p_user: string }; Returns: boolean }
      tick_bot_executor: { Args: never; Returns: undefined }
      track_click: {
        Args: {
          p_ip_hash: string
          p_landing_url: string
          p_metadata?: Json
          p_referral_code: string
          p_referrer: string
          p_session_id: string
          p_ua_hash: string
          p_utm_campaign: string
          p_utm_content: string
          p_utm_medium: string
          p_utm_source: string
          p_utm_term: string
          p_visitor_id: string
        }
        Returns: Json
      }
      try_protection_lock: { Args: never; Returns: boolean }
      update_performance_setting: {
        Args: { p_key: string; p_value: string }
        Returns: Json
      }
    }
    Enums: {
      download_category:
        | "contrato"
        | "apresentacao"
        | "kit_divulgacao"
        | "regulamento"
        | "outros"
      points_inventory_movement_type:
        | "ENTRY"
        | "RESERVE"
        | "RELEASE"
        | "REDEMPTION"
        | "ADJUSTMENT"
        | "LOSS"
        | "DAMAGE"
        | "RETURN"
        | "CANCELLATION"
      points_ledger_type:
        | "EARN_AUCTION"
        | "EARN_CAMPAIGN"
        | "RESERVE_REDEMPTION"
        | "CONFIRM_REDEMPTION"
        | "RELEASE_REDEMPTION"
        | "ADMIN_CREDIT"
        | "ADMIN_DEBIT"
        | "ORDER_REVERSAL"
        | "CHARGEBACK_REVERSAL"
        | "FRAUD_REVERSAL"
        | "EXPIRATION"
        | "CORRECTION"
      points_redemption_status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "SEPARATING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "REVERSED"
      points_settlement_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "REVERSED"
        | "SUPERSEDED"
      points_store_item_status:
        | "DRAFT"
        | "ACTIVE"
        | "PAUSED"
        | "OUT_OF_STOCK"
        | "ARCHIVED"
      points_store_item_type: "PHYSICAL" | "DIGITAL"
      points_wallet_status:
        | "NORMAL"
        | "UNDER_REVIEW"
        | "BLOCKED"
        | "SUSPENDED"
        | "CLOSED"
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
    Enums: {
      download_category: [
        "contrato",
        "apresentacao",
        "kit_divulgacao",
        "regulamento",
        "outros",
      ],
      points_inventory_movement_type: [
        "ENTRY",
        "RESERVE",
        "RELEASE",
        "REDEMPTION",
        "ADJUSTMENT",
        "LOSS",
        "DAMAGE",
        "RETURN",
        "CANCELLATION",
      ],
      points_ledger_type: [
        "EARN_AUCTION",
        "EARN_CAMPAIGN",
        "RESERVE_REDEMPTION",
        "CONFIRM_REDEMPTION",
        "RELEASE_REDEMPTION",
        "ADMIN_CREDIT",
        "ADMIN_DEBIT",
        "ORDER_REVERSAL",
        "CHARGEBACK_REVERSAL",
        "FRAUD_REVERSAL",
        "EXPIRATION",
        "CORRECTION",
      ],
      points_redemption_status: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "SEPARATING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REVERSED",
      ],
      points_settlement_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REVERSED",
        "SUPERSEDED",
      ],
      points_store_item_status: [
        "DRAFT",
        "ACTIVE",
        "PAUSED",
        "OUT_OF_STOCK",
        "ARCHIVED",
      ],
      points_store_item_type: ["PHYSICAL", "DIGITAL"],
      points_wallet_status: [
        "NORMAL",
        "UNDER_REVIEW",
        "BLOCKED",
        "SUSPENDED",
        "CLOSED",
      ],
    },
  },
} as const
