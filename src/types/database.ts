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
      admin_users: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          tenant_id: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          name: string
          tenant_id: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          id: number
          label: string
          tenant_id: number
        }
        Insert: {
          id?: never
          label: string
          tenant_id: number
        }
        Update: {
          id?: never
          label?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          e_from: string | null
          e_to: string | null
          event_type_id: number
          extra: Json | null
          group_id: number
          id: number
          object_id: number
          tenant_id: number
        }
        Insert: {
          created_at?: string
          e_from?: string | null
          e_to?: string | null
          event_type_id: number
          extra?: Json | null
          group_id: number
          id?: never
          object_id: number
          tenant_id: number
        }
        Update: {
          created_at?: string
          e_from?: string | null
          e_to?: string | null
          event_type_id?: number
          extra?: Json | null
          group_id?: number
          id?: never
          object_id?: number
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_e_from_fkey"
            columns: ["e_from"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_e_to_fkey"
            columns: ["e_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_tenant_fkey"
            columns: ["event_type_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "events_from_profile_tenant_fkey"
            columns: ["e_from", "tenant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_group_tenant_fkey"
            columns: ["group_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "events_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_object_tenant_fkey"
            columns: ["object_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_to_profile_tenant_fkey"
            columns: ["e_to", "tenant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: number
          tenant_id: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          tenant_id: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          tenant_id?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      object_custom_schemas: {
        Row: {
          created_at: string
          fields: Json
          id: number
          tenant_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: never
          tenant_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: never
          tenant_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_custom_schemas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      objects: {
        Row: {
          category_id: number | null
          created_at: string
          current_owner_id: string | null
          description: string | null
          extra: Json
          id: number
          image: string | null
          model: string | null
          name: string
          tenant_id: number
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          current_owner_id?: string | null
          description?: string | null
          extra?: Json
          id?: never
          image?: string | null
          model?: string | null
          name: string
          tenant_id: number
        }
        Update: {
          category_id?: number | null
          created_at?: string
          current_owner_id?: string | null
          description?: string | null
          extra?: Json
          id?: never
          image?: string | null
          model?: string | null
          name?: string
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "objects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objects_category_tenant_fkey"
            columns: ["category_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "objects_current_owner_id_fkey"
            columns: ["current_owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objects_owner_tenant_fkey"
            columns: ["current_owner_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "objects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          address: string | null
          billing_owner_id: string | null
          contact: string | null
          created_at: string
          defaults_version: number
          description: string | null
          email: string | null
          id: number
          institution_name: string
          phone: string | null
          show_object_info_without_authentication: boolean
          social_media: Json
          status: string
          status_reason: string | null
          suspended_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_owner_id?: string | null
          contact?: string | null
          created_at?: string
          defaults_version?: number
          description?: string | null
          email?: string | null
          id?: never
          institution_name: string
          phone?: string | null
          show_object_info_without_authentication?: boolean
          social_media?: Json
          status?: string
          status_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_owner_id?: string | null
          contact?: string | null
          created_at?: string
          defaults_version?: number
          description?: string | null
          email?: string | null
          id?: never
          institution_name?: string
          phone?: string | null
          show_object_info_without_authentication?: boolean
          social_media?: Json
          status?: string
          status_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      transfer_requests: {
        Row: {
          created_at: string
          from_user_id: string
          group_id: number | null
          id: number
          object_id: number
          reason: string | null
          status: string
          tenant_id: number
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          group_id?: number | null
          id?: number
          object_id: number
          reason?: string | null
          status?: string
          tenant_id: number
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          group_id?: number | null
          id?: number
          object_id?: number
          reason?: string | null
          status?: string
          tenant_id?: number
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_from_profile_tenant_fkey"
            columns: ["from_user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "transfer_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_group_tenant_fkey"
            columns: ["group_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "transfer_requests_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_object_tenant_fkey"
            columns: ["object_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "transfer_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_profile_tenant_fkey"
            columns: ["to_user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          group_id: number | null
          id: string
          last_name: string | null
          phone: string | null
          province: string | null
          tenant_id: number
          tenant_role: string
          title: string | null
          wechat_id: string | null
          zipcode: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          group_id?: number | null
          id: string
          last_name?: string | null
          phone?: string | null
          province?: string | null
          tenant_id: number
          tenant_role?: string
          title?: string | null
          wechat_id?: string | null
          zipcode?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          group_id?: number | null
          id?: string
          last_name?: string | null
          phone?: string | null
          province?: string | null
          tenant_id?: number
          tenant_role?: string
          title?: string | null
          wechat_id?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_group_tenant_fkey"
            columns: ["group_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      transfer_requests_display: {
        Row: {
          created_at: string | null
          from_user_full_name: string | null
          id: number | null
          object_description: string | null
          object_model: string | null
          object_name: string | null
          reason: string | null
          status: string | null
          to_user_full_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_tenant_invitation: {
        Args: { p_token_hash: string }
        Returns: number
      }
      approve_transfer: { Args: { p_request_id: number }; Returns: undefined }
      can_view_object_image: { Args: { p_name: string }; Returns: boolean }
      create_tenant_invitation: {
        Args: {
          p_expires_at: string
          p_intended_role: string
          p_invited_email: string
          p_token_hash: string
        }
        Returns: {
          expires_at: string
          intended_role: string
          invitation_id: string
          invited_email: string
          tenant_name: string
        }[]
      }
      current_tenant_id: { Args: never; Returns: number }
      current_tenant_role: { Args: never; Returns: string }
      group_profile_directory: {
        Args: never
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      has_permission: {
        Args: { p_permission: string; p_tenant_id?: number }
        Returns: boolean
      }
      invitation_link_status: {
        Args: { p_token_hash: string }
        Returns: {
          invited_email_masked: string
          status: string
          tenant_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_platform_operator: { Args: never; Returns: boolean }
      migrate_tenant_defaults: {
        Args: { p_target_version: number; p_tenant_id: number }
        Returns: undefined
      }
      object_info: {
        Args: { p_object_id: number }
        Returns: {
          category_name: string
          created_at: string
          description: string
          extra: Json
          id: number
          image: string
          institution_name: string
          model: string
          name: string
          owner_name: string
        }[]
      }
      object_info_events: {
        Args: { p_object_id: number }
        Returns: {
          created_at: string
          event_type_label: string
          from_user_name: string
          group_name: string
          id: number
          to_user_name: string
        }[]
      }
      platform_tenant: {
        Args: { p_tenant_id: number }
        Returns: {
          address: string
          billing_owner_id: string
          contact: string
          created_at: string
          defaults_version: number
          description: string
          email: string
          id: number
          initial_owner_email: string
          initial_owner_status: string
          institution_name: string
          phone: string
          social_media: Json
          status: string
          status_reason: string
          suspended_at: string
          updated_at: string
          website: string
        }[]
      }
      platform_tenants: {
        Args: { p_search?: string }
        Returns: {
          created_at: string
          defaults_version: number
          email: string
          id: number
          initial_owner_email: string
          institution_name: string
          status: string
          updated_at: string
        }[]
      }
      prepare_tenant_invitation_resend: {
        Args: {
          p_expires_at: string
          p_invitation_id: string
          p_token_hash: string
        }
        Returns: {
          expires_at: string
          intended_role: string
          invited_email: string
          tenant_name: string
        }[]
      }
      profile_names: {
        Args: { p_user_ids: string[] }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      provision_tenant: {
        Args: {
          p_address?: string
          p_contact?: string
          p_description?: string
          p_email?: string
          p_institution_name: string
          p_owner_email: string
          p_phone?: string
          p_website?: string
        }
        Returns: number
      }
      record_tenant_invitation_delivery: {
        Args: {
          p_error?: string
          p_invitation_id: string
          p_succeeded: boolean
        }
        Returns: undefined
      }
      reject_transfer: {
        Args: { p_reason?: string; p_request_id: number }
        Returns: undefined
      }
      remove_tenant_member: { Args: { p_user_id: string }; Returns: undefined }
      request_transfer: {
        Args: { p_object_id: number; p_to_user_id: string }
        Returns: number
      }
      revoke_tenant_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_tenant_status: {
        Args: { p_reason: string; p_status: string; p_tenant_id: number }
        Returns: undefined
      }
      tenant_admin_profile: {
        Args: never
        Returns: {
          address: string
          contact: string
          description: string
          email: string
          id: number
          institution_name: string
          phone: string
          show_object_info_without_authentication: boolean
          social_media: Json
          website: string
        }[]
      }
      tenant_invitations: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          delivery_status: string
          expires_at: string
          id: string
          intended_role: string
          invited_email: string
          last_sent_at: string
          revoked_at: string
          status: string
        }[]
      }
      tenant_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          tenant_role: string
          title: string
        }[]
      }
      update_current_tenant_profile: {
        Args: {
          p_address?: string
          p_contact?: string
          p_description?: string
          p_email?: string
          p_institution_name: string
          p_phone?: string
          p_show_object_info_without_authentication?: boolean
          p_social_media?: Json
          p_website?: string
        }
        Returns: undefined
      }
      update_own_profile: {
        Args: {
          p_city?: string
          p_country?: string
          p_email?: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
          p_province?: string
          p_title?: string
          p_wechat_id?: string
          p_zipcode?: string
        }
        Returns: undefined
      }
      update_platform_tenant: {
        Args: {
          p_address?: string
          p_contact?: string
          p_description?: string
          p_email?: string
          p_institution_name: string
          p_phone?: string
          p_social_media?: Json
          p_tenant_id: number
          p_website?: string
        }
        Returns: undefined
      }
      update_tenant_member_role: {
        Args: { p_tenant_role: string; p_user_id: string }
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
