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
          kind: Database["public"]["Enums"]["courier_document_kind"]
          purge_after: string | null
          purged_at: string | null
          status: Database["public"]["Enums"]["document_review_status"]
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          courier_id: string
          id?: string
          kind: Database["public"]["Enums"]["courier_document_kind"]
          purge_after?: string | null
          purged_at?: string | null
          status?: Database["public"]["Enums"]["document_review_status"]
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          courier_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["courier_document_kind"]
          purge_after?: string | null
          purged_at?: string | null
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
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          recipient_consent_declared: boolean
          recipient_name: string
          recipient_phone: string
          request_id: string
        }
        Insert: {
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_consent_declared?: boolean
          recipient_name: string
          recipient_phone: string
          request_id: string
        }
        Update: {
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_consent_declared?: boolean
          recipient_name?: string
          recipient_phone?: string
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
      delivery_requests: {
        Row: {
          accepted_offer_id: string | null
          approx_distance_m: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          cash_change_amount: number | null
          created_at: string
          delivered_at: string | null
          dropoff_zone_id: string
          expires_at: string | null
          id: string
          matched_at: string | null
          merchant_id: string
          needs_change: boolean
          notes: string | null
          package_type: Database["public"]["Enums"]["package_type"]
          picked_up_at: string | null
          pickup_zone_id: string
          published_at: string | null
          recipient_payment_method: Database["public"]["Enums"]["recipient_payment_method"]
          route_distance_m: number | null
          status: Database["public"]["Enums"]["delivery_request_status"]
          updated_at: string
        }
        Insert: {
          accepted_offer_id?: string | null
          approx_distance_m?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_change_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          dropoff_zone_id: string
          expires_at?: string | null
          id?: string
          matched_at?: string | null
          merchant_id: string
          needs_change?: boolean
          notes?: string | null
          package_type: Database["public"]["Enums"]["package_type"]
          picked_up_at?: string | null
          pickup_zone_id: string
          published_at?: string | null
          recipient_payment_method: Database["public"]["Enums"]["recipient_payment_method"]
          route_distance_m?: number | null
          status?: Database["public"]["Enums"]["delivery_request_status"]
          updated_at?: string
        }
        Update: {
          accepted_offer_id?: string | null
          approx_distance_m?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_change_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          dropoff_zone_id?: string
          expires_at?: string | null
          id?: string
          matched_at?: string | null
          merchant_id?: string
          needs_change?: boolean
          notes?: string | null
          package_type?: Database["public"]["Enums"]["package_type"]
          picked_up_at?: string | null
          pickup_zone_id?: string
          published_at?: string | null
          recipient_payment_method?: Database["public"]["Enums"]["recipient_payment_method"]
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
          created_at: string
          display_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
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
      [_ in never]: never
    }
    Functions: {
      accept_offer: { Args: { p_offer_id: string }; Returns: Json }
      admin_decide_courier: {
        Args: { p_courier_id: string; p_decision: string; p_reason?: string }
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
      admin_verify_document: {
        Args: { p_decision: string; p_document_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      courier_cancel_match: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      mark_delivered: { Args: { p_request_id: string }; Returns: Json }
      mark_picked_up: { Args: { p_request_id: string }; Returns: Json }
      publish_request: { Args: { p_request_id: string }; Returns: Json }
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
      submit_offer: {
        Args: {
          p_amount_ars: number
          p_eta_minutes: number
          p_message?: string
          p_request_id: string
        }
        Returns: Json
      }
      withdraw_offer: { Args: { p_offer_id: string }; Returns: Json }
    }
    Enums: {
      consent_document: "tos" | "privacy" | "courier_contract" | "pilot_terms"
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
