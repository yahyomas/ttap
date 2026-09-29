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
          actor_id: string | null
          after: Json | null
          before: Json | null
          club_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          club_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          club_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_external_ratings: {
        Row: {
          club_id: string
          created_at: string
          external_ref: string | null
          id: string
          player_id: string
          rating: number
          source: Database["public"]["Enums"]["external_rating_source"]
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          external_ref?: string | null
          id?: string
          player_id: string
          rating: number
          source?: Database["public"]["Enums"]["external_rating_source"]
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          external_ref?: string | null
          id?: string
          player_id?: string
          rating?: number
          source?: Database["public"]["Enums"]["external_rating_source"]
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_external_ratings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_external_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_external_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_external_ratings_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked_at: string | null
          blocked_reason: string | null
          club_id: string
          created_at: string
          current_rating: number | null
          deleted_at: string | null
          display_name: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          last_name: string
          peak_rating: number | null
          playing_hand: Database["public"]["Enums"]["playing_hand"]
          rating_status: Database["public"]["Enums"]["rating_status"]
          status: Database["public"]["Enums"]["player_status"]
          tournament_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          club_id: string
          created_at?: string
          current_rating?: number | null
          deleted_at?: string | null
          display_name: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          last_name: string
          peak_rating?: number | null
          playing_hand: Database["public"]["Enums"]["playing_hand"]
          rating_status?: Database["public"]["Enums"]["rating_status"]
          status?: Database["public"]["Enums"]["player_status"]
          tournament_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          club_id?: string
          created_at?: string
          current_rating?: number | null
          deleted_at?: string | null
          display_name?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          last_name?: string
          peak_rating?: number | null
          playing_hand?: Database["public"]["Enums"]["playing_hand"]
          rating_status?: Database["public"]["Enums"]["rating_status"]
          status?: Database["public"]["Enums"]["player_status"]
          tournament_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_transactions: {
        Row: {
          calc: Json
          calculation_version: number
          club_id: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          match_id: string | null
          note: string | null
          player_id: string
          rating_after: number
          rating_before: number | null
          rating_delta: number
          rating_status_after: Database["public"]["Enums"]["rating_status"]
          rating_status_before: Database["public"]["Enums"]["rating_status"]
          reason: Database["public"]["Enums"]["rating_tx_reason"]
          reverses_id: string | null
          tournament_id: string | null
        }
        Insert: {
          calc?: Json
          calculation_version?: number
          club_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          match_id?: string | null
          note?: string | null
          player_id: string
          rating_after: number
          rating_before?: number | null
          rating_delta: number
          rating_status_after: Database["public"]["Enums"]["rating_status"]
          rating_status_before: Database["public"]["Enums"]["rating_status"]
          reason: Database["public"]["Enums"]["rating_tx_reason"]
          reverses_id?: string | null
          tournament_id?: string | null
        }
        Update: {
          calc?: Json
          calculation_version?: number
          club_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          match_id?: string | null
          note?: string | null
          player_id?: string
          rating_after?: number
          rating_before?: number | null
          rating_delta?: number
          rating_status_after?: Database["public"]["Enums"]["rating_status"]
          rating_status_before?: Database["public"]["Enums"]["rating_status"]
          reason?: Database["public"]["Enums"]["rating_tx_reason"]
          reverses_id?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rating_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_transactions_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "rating_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          notification_prefs: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          notification_prefs?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          notification_prefs?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          club_id: string | null
          current_rating: number | null
          display_name: string | null
          player_id: string | null
          playing_hand: Database["public"]["Enums"]["playing_hand"] | null
          rank: number | null
          rating_status: Database["public"]["Enums"]["rating_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_adjust_rating: {
        Args: { p_new_rating: number; p_player_id: string; p_reason: string }
        Returns: string
      }
      admin_approve_player: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      admin_set_player_blocked: {
        Args: { p_blocked: boolean; p_player_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_verify_external_rating: {
        Args: {
          p_rating_id: string
          p_verdict: Database["public"]["Enums"]["verification_status"]
        }
        Returns: undefined
      }
      bootstrap_club_admin: {
        Args: { p_club_slug: string; p_email: string }
        Returns: undefined
      }
      complete_onboarding: {
        Args: {
          p_birth_date: string
          p_club_slug: string
          p_display_name: string
          p_first_name: string
          p_gender: Database["public"]["Enums"]["gender"]
          p_last_name: string
          p_playing_hand: Database["public"]["Enums"]["playing_hand"]
          p_rttf_rating?: number
        }
        Returns: string
      }
      current_club_ids: { Args: never; Returns: string[] }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
    }
    Enums: {
      club_role: "PLAYER" | "ADMIN"
      external_rating_source: "RTTF"
      gender: "MALE" | "FEMALE"
      player_status: "PENDING" | "ACTIVE" | "BLOCKED"
      playing_hand: "RIGHT" | "LEFT"
      rating_status: "NEW" | "PROVISIONAL" | "ESTABLISHED"
      rating_tx_reason:
        | "TOURNAMENT_MATCH"
        | "CHALLENGE_MATCH"
        | "CASUAL_MATCH"
        | "NEWCOMER_INITIAL"
        | "EXTERNAL_SEED"
        | "MANUAL_ADJUSTMENT"
        | "REVERSAL"
      verification_status: "PENDING" | "VERIFIED" | "REJECTED"
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
      club_role: ["PLAYER", "ADMIN"],
      external_rating_source: ["RTTF"],
      gender: ["MALE", "FEMALE"],
      player_status: ["PENDING", "ACTIVE", "BLOCKED"],
      playing_hand: ["RIGHT", "LEFT"],
      rating_status: ["NEW", "PROVISIONAL", "ESTABLISHED"],
      rating_tx_reason: [
        "TOURNAMENT_MATCH",
        "CHALLENGE_MATCH",
        "CASUAL_MATCH",
        "NEWCOMER_INITIAL",
        "EXTERNAL_SEED",
        "MANUAL_ADJUSTMENT",
        "REVERSAL",
      ],
      verification_status: ["PENDING", "VERIFIED", "REJECTED"],
    },
  },
} as const
