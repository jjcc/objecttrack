export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      event_types: {
        Row: {
          id: number;
          label: string;
        };
        Insert: {
          id?: never;
          label: string;
        };
        Update: {
          id?: never;
          label?: string;
        };
      };
      events: {
        Row: {
          id: number;
          group_id: number;
          object_id: number;
          event_type_id: number;
          e_from: string | null;
          e_to: string | null;
          extra: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          group_id: number;
          object_id: number;
          event_type_id: number;
          e_from?: string | null;
          e_to?: string | null;
          extra?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: never;
      };
      groups: {
        Row: {
          id: number;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      objects: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          category_id: number | null;
          model: string | null;
          current_owner_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          name: string;
          description?: string | null;
          category_id?: number | null;
          model?: string | null;
          current_owner_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          name?: string;
          description?: string | null;
          category_id?: number | null;
          model?: string | null;
          current_owner_id?: string | null;
          created_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          group_id: number | null;
          last_name: string | null;
          first_name: string | null;
          title: string | null;
          city: string | null;
          province: string | null;
          country: string | null;
          zipcode: string | null;
          phone: string | null;
          wechat_id: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          group_id?: number | null;
          last_name?: string | null;
          first_name?: string | null;
          title?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          zipcode?: string | null;
          phone?: string | null;
          wechat_id?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: number | null;
          last_name?: string | null;
          first_name?: string | null;
          title?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          zipcode?: string | null;
          phone?: string | null;
          wechat_id?: string | null;
          email?: string | null;
          created_at?: string;
        };
      };
      admin_users: {
        Row: {
          id: string;
        };
        Insert: {
          id: string;
        };
        Update: {
          id?: string;
        };
      };
      transfer_requests: {
        Row: {
          id: number;
          object_id: number;
          from_user_id: string;
          to_user_id: string;
          status: string;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: never;
          object_id: number;
          from_user_id: string;
          to_user_id: string;
          status?: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: never;
          object_id?: number;
          from_user_id?: string;
          to_user_id?: string;
          status?: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
