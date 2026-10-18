export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          document: Database["public"]["Enums"]["consent_document"]
          profile_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: Database["public"]["Enums"]["consent_document"]
          profile_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: Database["public"]["Enums"]["consent_document"]
          profile_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_documents: {
        Row: {
          courier_id: string
          id: string
          idempotency_key: string | null
          is_current: boolean
          kind: Database["public"]["Enums"]["courier_document_kind"]
          purge_after: string | null
          purged_at: string | null
          rejection_code: string | null
          status: Database["public"]["Enums"]["document_review_status"]
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          courier_id: string
          id?: string
          idempotency_key?: string | null
          is_current?: boolean
          kind: Database["public"]["Enums"]["courier_document_kind"]
          purge_after?: string | null
          purged_at?: string | null
          rejection_code?: string | null
          status?: Database["public"]["Enums"]["document_review_status"]
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          courier_id?: string
          id?: string
          idempotency_key?: string | null
          is_current?: boolean
          kind?: Database["public"]["Enums"]["courier_document_kind"]
          purge_after?: string | null
          purged_at?: string | null
          rejection_code?: string | null
          status?: Database["public"]["Enums"]["document_review_status"]
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_documents_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      couriers: {
        Row: {
          available: boolean
          deactivated_at: string | null
          decided_at: string | null
          decided_by: string | null
          dni_hmac: string | null
          doc_level: number | null
          insurance_status: Database["public"]["Enums"]["document_review_status"]
          license_status: Database["public"]["Enums"]["document_review_status"]
          profile_id: string
          status: Database["public"]["Enums"]["courier_status"]
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          available?: boolean
          deactivated_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          dni_hmac?: string | null
          doc_level?: number | null
          insurance_status?: Database["public"]["Enums"]["document_review_status"]
          license_status?: Database["public"]["Enums"]["document_review_status"]
          profile_id: string
          status?: Database["public"]["Enums"]["courier_status"]
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          available?: boolean
          deactivated_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          dni_hmac?: string | null
          doc_level?: number | null
          insurance_status?: Database["public"]["Enums"]["document_review_status"]
          license_status?: Database["public"]["Enums"]["document_review_status"]
          profile_id?: string
          status?: Database["public"]["Enums"]["courier_status"]
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couriers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_request_contacts: {
        Row: {
          dropoff_address: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          recipient_consent_declared: boolean | null
          recipient_name: string | null
          recipient_phone: string | null
          request_id: string
        }
        Insert: {
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_consent_declared?: boolean | null
          recipient_name?: string | null
          recipient_phone?: string | null
          request_id: string
        }
        Update: {
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_consent_declared?: boolean | null
          recipient_name?: string | null
          recipient_phone?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_contacts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_request_drop_contacts: {
        Row: {
          cash_change_amount: number | null
          drop_id: string
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          notes: string | null
          recipient_consent_declared: boolean
          recipient_name: string
          recipient_phone: string
        }
        Insert: {
          cash_change_amount?: number | null
          drop_id: string
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          notes?: string | null
          recipient_consent_declared: boolean
          recipient_name: string
          recipient_phone: string
        }
        Update: {
          cash_change_amount?: number | null
          drop_id?: string
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          notes?: string | null
          recipient_consent_declared?: boolean
          recipient_name?: string
          recipient_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_drop_contacts_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: true
            referencedRelation: "delivery_request_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_request_drops: {
        Row: {
          approx_distance_m: number | null
          delivered_at: string | null
          dropoff_zone_id: string
          failed_reason: string | null
          id: string
          needs_change: boolean
          package_type: Database["public"]["Enums"]["package_type"]
          position: number
          recipient_payment_method: Database["public"]["Enums"]["recipient_payment_method"]
          request_id: string
          status: string
        }
        Insert: {
          approx_distance_m?: number | null
          delivered_at?: string | null
          dropoff_zone_id: string
          failed_reason?: string | null
          id?: string
          needs_change?: boolean
          package_type: Database["public"]["Enums"]["package_type"]
          position: number
          recipient_payment_method: Database["public"]["Enums"]["recipient_payment_method"]
          request_id: string
          status?: string
        }
        Update: {
          approx_distance_m?: number | null
          delivered_at?: string | null
          dropoff_zone_id?: string
          failed_reason?: string | null
          id?: string
          needs_change?: boolean
          package_type?: Database["public"]["Enums"]["package_type"]
          position?: number
          recipient_payment_method?: Database["public"]["Enums"]["recipient_payment_method"]
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_drops_dropoff_zone_id_fkey"
            columns: ["dropoff_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_request_drops_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          accepted_offer_id: string | null
          approx_distance_m: number | null
          auto_assign: boolean
          cancel_reason: string | null
          cancelled_at: string | null
          cash_change_amount: number | null
          created_at: string
          delivered_at: string | null
          dropoff_zone_id: string | null
          drops_count: number
          expires_at: string | null
          fixed_price_ars: number | null
          id: string
          matched_at: string | null
          merchant_id: string
          needs_change: boolean
          notes: string | null
          package_type: Database["public"]["Enums"]["package_type"] | null
          picked_up_at: string | null
          pickup_zone_id: string
          published_at: string | null
          recipient_payment_method:
            | Database["public"]["Enums"]["recipient_payment_method"]
            | null
          route_distance_m: number | null
          status: Database["public"]["Enums"]["delivery_request_status"]
          updated_at: string
        }
        Insert: {
          accepted_offer_id?: string | null
          approx_distance_m?: number | null
          auto_assign?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_change_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          dropoff_zone_id?: string | null
          drops_count?: number
          expires_at?: string | null
          fixed_price_ars?: number | null
          id?: string
          matched_at?: string | null
          merchant_id: string
          needs_change?: boolean
          notes?: string | null
          package_type?: Database["public"]["Enums"]["package_type"] | null
          picked_up_at?: string | null
          pickup_zone_id: string
          published_at?: string | null
          recipient_payment_method?:
            | Database["public"]["Enums"]["recipient_payment_method"]
            | null
          route_distance_m?: number | null
          status?: Database["public"]["Enums"]["delivery_request_status"]
          updated_at?: string
        }
        Update: {
          accepted_offer_id?: string | null
          approx_distance_m?: number | null
          auto_assign?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_change_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          dropoff_zone_id?: string | null
          drops_count?: number
          expires_at?: string | null
          fixed_price_ars?: number | null
          id?: string
          matched_at?: string | null
          merchant_id?: string
          needs_change?: boolean
          notes?: string | null
          package_type?: Database["public"]["Enums"]["package_type"] | null
          picked_up_at?: string | null
          pickup_zone_id?: string
          published_at?: string | null
          recipient_payment_method?:
            | Database["public"]["Enums"]["recipient_payment_method"]
            | null
          route_distance_m?: number | null
          status?: Database["public"]["Enums"]["delivery_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_accepted_offer_fk"
            columns: ["accepted_offer_id", "id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id", "request_id"]
          },
          {
            foreignKeyName: "delivery_requests_dropoff_zone_id_fkey"
            columns: ["dropoff_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "delivery_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "delivery_requests_pickup_zone_id_fkey"
            columns: ["pickup_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          reporter_id: string
          request_id: string
          resolution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kind: string
          reporter_id: string
          request_id: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          reporter_id?: string
          request_id?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_launch_discounts: {
        Row: {
          applied_at: string
          lot_id: string | null
          merchant_id: string
          pct: number
          period_id: string | null
        }
        Insert: {
          applied_at?: string
          lot_id?: string | null
          merchant_id: string
          pct: number
          period_id?: string | null
        }
        Update: {
          applied_at?: string
          lot_id?: string | null
          merchant_id?: string
          pct?: number
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_launch_discounts_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "publication_credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_launch_discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "merchant_launch_discounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "merchant_launch_discounts_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "merchant_plan_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_plan_periods: {
        Row: {
          actor_id: string | null
          carryover_materialized_at: string | null
          carryover_pct: number
          created_at: string
          ends_at: string
          id: string
          is_purchase: boolean
          launch_discount_pct: number | null
          merchant_id: string
          monthly_credits: number | null
          note: string | null
          operation_key: string
          plan_id: string
          plan_kind: string
          previous_period_id: string | null
          reference_price_ars: number | null
          starts_at: string
          streak: number
        }
        Insert: {
          actor_id?: string | null
          carryover_materialized_at?: string | null
          carryover_pct?: number
          created_at?: string
          ends_at: string
          id?: string
          is_purchase: boolean
          launch_discount_pct?: number | null
          merchant_id: string
          monthly_credits?: number | null
          note?: string | null
          operation_key: string
          plan_id: string
          plan_kind: string
          previous_period_id?: string | null
          reference_price_ars?: number | null
          starts_at: string
          streak: number
        }
        Update: {
          actor_id?: string | null
          carryover_materialized_at?: string | null
          carryover_pct?: number
          created_at?: string
          ends_at?: string
          id?: string
          is_purchase?: boolean
          launch_discount_pct?: number | null
          merchant_id?: string
          monthly_credits?: number | null
          note?: string | null
          operation_key?: string
          plan_id?: string
          plan_kind?: string
          previous_period_id?: string | null
          reference_price_ars?: number | null
          starts_at?: string
          streak?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_plan_periods_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "merchant_plan_periods_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "merchant_plan_periods_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "publication_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_plan_periods_previous_period_id_fkey"
            columns: ["previous_period_id"]
            isOneToOne: false
            referencedRelation: "merchant_plan_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          business_name: string
          default_pickup_address: string | null
          default_pickup_lat: number | null
          default_pickup_lng: number | null
          default_pickup_zone_id: string | null
          notes: string | null
          paid_until: string | null
          profile_id: string
          subscription_status: Database["public"]["Enums"]["merchant_subscription_status"]
        }
        Insert: {
          business_name?: string
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          default_pickup_zone_id?: string | null
          notes?: string | null
          paid_until?: string | null
          profile_id: string
          subscription_status?: Database["public"]["Enums"]["merchant_subscription_status"]
        }
        Update: {
          business_name?: string
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          default_pickup_zone_id?: string | null
          notes?: string | null
          paid_until?: string | null
          profile_id?: string
          subscription_status?: Database["public"]["Enums"]["merchant_subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_pickup_zone_id_fkey"
            columns: ["default_pickup_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          amount_ars: number
          courier_id: string
          created_at: string
          decided_at: string | null
          eta_minutes: number
          id: string
          message: string | null
          request_id: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          amount_ars: number
          courier_id: string
          created_at?: string
          decided_at?: string | null
          eta_minutes: number
          id?: string
          message?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          amount_ars?: number
          courier_id?: string
          created_at?: string
          decided_at?: string | null
          eta_minutes?: number
          id?: string
          message?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          display_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          display_name?: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Relationships: []
      }
      publication_charge_lots: {
        Row: {
          amount: number
          charge_id: string
          lot_id: string
        }
        Insert: {
          amount: number
          charge_id: string
          lot_id: string
        }
        Update: {
          amount?: number
          charge_id?: string
          lot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_charge_lots_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "publication_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_charge_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "publication_credit_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_charges: {
        Row: {
          cost: number
          created_at: string
          id: string
          is_current: boolean
          merchant_id: string
          mode: string
          period_id: string | null
          request_id: string
          state: string
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          is_current?: boolean
          merchant_id: string
          mode: string
          period_id?: string | null
          request_id: string
          state: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          is_current?: boolean
          merchant_id?: string
          mode?: string
          period_id?: string | null
          request_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_charges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_charges_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "merchant_plan_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_charges_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_credit_lots: {
        Row: {
          actor_id: string | null
          created_at: string
          expires_at: string | null
          granted: number
          id: string
          kind: string
          merchant_id: string
          note: string | null
          operation_key: string | null
          period_id: string | null
          refund_charge_id: string | null
          refund_source_lot_id: string | null
          source: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          expires_at?: string | null
          granted: number
          id?: string
          kind: string
          merchant_id: string
          note?: string | null
          operation_key?: string | null
          period_id?: string | null
          refund_charge_id?: string | null
          refund_source_lot_id?: string | null
          source: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          expires_at?: string | null
          granted?: number
          id?: string
          kind?: string
          merchant_id?: string
          note?: string | null
          operation_key?: string | null
          period_id?: string | null
          refund_charge_id?: string | null
          refund_source_lot_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_credit_lots_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_credit_lots_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_credit_lots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "merchant_plan_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_credit_lots_refund_charge_id_fkey"
            columns: ["refund_charge_id"]
            isOneToOne: false
            referencedRelation: "publication_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_credit_lots_refund_source_lot_id_fkey"
            columns: ["refund_source_lot_id"]
            isOneToOne: false
            referencedRelation: "publication_credit_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_credit_movements: {
        Row: {
          actor_id: string | null
          amount: number
          charge_id: string | null
          created_at: string
          id: number
          kind: string
          lot_id: string | null
          merchant_id: string
          reason: string | null
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount: number
          charge_id?: string | null
          created_at?: string
          id?: never
          kind: string
          lot_id?: string | null
          merchant_id: string
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount?: number
          charge_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          lot_id?: string | null
          merchant_id?: string
          reason?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_credit_movements_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "publication_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_credit_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "publication_credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_credit_movements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_public"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_credit_movements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "publication_credit_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          kind: string
          monthly_credits: number | null
          name: string
          reference_price_ars: number | null
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          kind: string
          monthly_credits?: number | null
          name: string
          reference_price_ars?: number | null
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          kind?: string
          monthly_credits?: number | null
          name?: string
          reference_price_ars?: number | null
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          platform: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          platform?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          subject: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          subject: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      request_cancellation_reasons: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          offer_id: string | null
          reason: string
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          offer_id?: string | null
          reason: string
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          offer_id?: string | null
          reason?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_cancellation_reasons_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_cancellation_reasons_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_cancellation_reasons_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          active: boolean
          centroid_lat: number | null
          centroid_lng: number | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          centroid_lat?: number | null
          centroid_lng?: number | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          centroid_lat?: number | null
          centroid_lng?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      merchant_public: {
        Row: {
          business_name: string | null
          default_pickup_address: string | null
          default_pickup_zone_id: string | null
          profile_id: string | null
        }
        Insert: {
          business_name?: string | null
          default_pickup_address?: string | null
          default_pickup_zone_id?: string | null
          profile_id?: string | null
        }
        Update: {
          business_name?: string | null
          default_pickup_address?: string | null
          default_pickup_zone_id?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_pickup_zone_id_fkey"
            columns: ["default_pickup_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_offer: { Args: { p_offer_id: string }; Returns: Json }
      activate_account_consents: {
        Args: {
          p_privacy_version: string
          p_tos_version: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_decide_courier: {
        Args: { p_courier_id: string; p_decision: string; p_reason?: string }
        Returns: Json
      }
      admin_get_merchant_publication_credits: {
        Args: { p_before_id?: number; p_limit?: number; p_merchant_id: string }
        Returns: Json
      }
      admin_grant_publication_credits: {
        Args: {
          p_credits: number
          p_merchant_id: string
          p_note?: string
          p_operation_key: string
          p_source: string
        }
        Returns: Json
      }
      admin_list_incidents: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
          p_statuses: string[]
        }
        Returns: Json
      }
      admin_merchant_delivered_counts: {
        Args: { p_merchant_ids: string[] }
        Returns: Json
      }
      admin_register_plan_period: {
        Args: {
          p_is_purchase: boolean
          p_merchant_id: string
          p_note?: string
          p_operation_key: string
          p_plan_id: string
        }
        Returns: Json
      }
      admin_resolve_incident: {
        Args: { p_decision: string; p_incident_id: string; p_reason: string }
        Returns: Json
      }
      admin_set_subscription: {
        Args: {
          p_merchant_id: string
          p_notes?: string
          p_paid_until?: string
          p_subscription_status: string
        }
        Returns: Json
      }
      admin_suspend_courier: {
        Args: { p_courier_id: string; p_reason: string }
        Returns: Json
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_upsert_publication_plan: {
        Args: {
          p_active: boolean
          p_code: string
          p_kind: string
          p_monthly_credits: number
          p_name: string
          p_plan_id: string
          p_reference_price_ars: number
          p_sort: number
        }
        Returns: Json
      }
      admin_verify_document: {
        Args: {
          p_decision: string
          p_document_id: string
          p_reason?: string
          p_rejection_code?: string
        }
        Returns: Json
      }
      calculate_route_distance: {
        Args: {
          p_dropoff_lat?: number
          p_dropoff_lng?: number
          p_dropoff_zone_id?: string
          p_dropoff_zone_name?: string
          p_pickup_lat?: number
          p_pickup_lng?: number
          p_pickup_zone_id?: string
          p_pickup_zone_name?: string
        }
        Returns: Json
      }
      cancel_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      claim_orphan_courier_documents: {
        Args: { p_dry_run?: boolean; p_limit?: number }
        Returns: Json
      }
      complete_orphan_courier_document_purge: { Args: never; Returns: Json }
      courier_cancel_match: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      create_and_publish_multi_drop: {
        Args: { p_payload: Json }
        Returns: Json
      }
      get_merchant_request_private_fields: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_my_publication_balance: { Args: never; Returns: Json }
      get_request_offer_couriers: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_trip_details: { Args: { p_request_id: string }; Returns: Json }
      mark_delivered: { Args: { p_request_id: string }; Returns: Json }
      mark_drop_delivered: { Args: { p_drop_id: string }; Returns: Json }
      mark_drop_failed: {
        Args: { p_drop_id: string; p_reason: string }
        Returns: Json
      }
      mark_picked_up: { Args: { p_request_id: string }; Returns: Json }
      publish_request: { Args: { p_request_id: string }; Returns: Json }
      reconcile_expired_requests: { Args: never; Returns: Json }
      reconcile_expired_requests_cron: {
        Args: { p_limit?: number }
        Returns: Json
      }
      replace_courier_document: { Args: { p_payload: Json }; Returns: Json }
      report_incident: {
        Args: { p_description: string; p_kind: string; p_request_id: string }
        Returns: Json
      }
      report_no_show: {
        Args: { p_republish?: boolean; p_request_id: string }
        Returns: Json
      }
      republish_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      set_availability: { Args: { p_available: boolean }; Returns: Json }
      submit_courier_onboarding_documents: {
        Args: { p_documents: Json }
        Returns: Json
      }
      submit_offer: {
        Args: {
          p_amount_ars: number
          p_eta_minutes: number
          p_message?: string
          p_request_id: string
        }
        Returns: Json
      }
      take_request: {
        Args: {
          p_eta_minutes: number
          p_message?: string
          p_request_id: string
        }
        Returns: Json
      }
      update_my_merchant_profile: { Args: { p_patch: Json }; Returns: Json }
      withdraw_offer: { Args: { p_offer_id: string }; Returns: Json }
    }
    Enums: {
      consent_document: "tos" | "privacy" | "courier_contract" | "pilot_terms"
      consent_status: "pending" | "active" | "reconsent_required"
      courier_document_kind:
        | "dni_front"
        | "dni_back"
        | "selfie"
        | "avatar"
        | "license"
        | "insurance"
      courier_status: "pending" | "approved" | "rejected" | "suspended"
      delivery_request_status:
        | "draft"
        | "published"
        | "matched"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "expired"
      document_review_status: "none" | "submitted" | "verified" | "rejected"
      merchant_subscription_status: "pilot" | "active" | "expired" | "cancelled"
      offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "expired"
        | "cancelled"
      package_type: "sobre" | "chico" | "mediano" | "grande"
      profile_role: "merchant" | "courier" | "admin"
      recipient_payment_method: "cash" | "transfer" | "to_agree"
      vehicle_type: "walk" | "bike" | "moto" | "car"
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
      consent_document: ["tos", "privacy", "courier_contract", "pilot_terms"],
      consent_status: ["pending", "active", "reconsent_required"],
      courier_document_kind: [
        "dni_front",
        "dni_back",
        "selfie",
        "avatar",
        "license",
        "insurance",
      ],
      courier_status: ["pending", "approved", "rejected", "suspended"],
      delivery_request_status: [
        "draft",
        "published",
        "matched",
        "in_transit",
        "delivered",
        "cancelled",
        "expired",
      ],
      document_review_status: ["none", "submitted", "verified", "rejected"],
      merchant_subscription_status: ["pilot", "active", "expired", "cancelled"],
      offer_status: [
        "pending",
        "accepted",
        "rejected",
        "withdrawn",
        "expired",
        "cancelled",
      ],
      package_type: ["sobre", "chico", "mediano", "grande"],
      profile_role: ["merchant", "courier", "admin"],
      recipient_payment_method: ["cash", "transfer", "to_agree"],
      vehicle_type: ["walk", "bike", "moto", "car"],
    },
  },
} as const
