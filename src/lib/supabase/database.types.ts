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
      challenges: {
        Row: {
          challenger_id: string
          club_id: string
          completed_at: string | null
          created_at: string
          dispute_note: string | null
          id: string
          match_id: string | null
          message: string | null
          opponent_id: string
          proposed_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["challenge_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          challenger_id: string
          club_id: string
          completed_at?: string | null
          created_at?: string
          dispute_note?: string | null
          id?: string
          match_id?: string | null
          message?: string | null
          opponent_id: string
          proposed_at: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          challenger_id?: string
          club_id?: string
          completed_at?: string | null
          created_at?: string
          dispute_note?: string | null
          id?: string
          match_id?: string | null
          message?: string | null
          opponent_id?: string
          proposed_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "players"
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
      matches: {
        Row: {
          calc: Json | null
          challenge_id: string | null
          club_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          corrected_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_id: string
          id: string
          loser_player_id: string | null
          loser_sets: number | null
          match_type: Database["public"]["Enums"]["match_type"]
          next_match_id: string | null
          next_slot: number | null
          played_at: string | null
          player1_id: string | null
          player2_id: string | null
          position: number | null
          rated: boolean | null
          round: number | null
          status: Database["public"]["Enums"]["match_status"]
          submitted_by: string | null
          tournament_id: string | null
          updated_at: string
          winner_player_id: string | null
          winner_sets: number | null
        }
        Insert: {
          calc?: Json | null
          challenge_id?: string | null
          club_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          corrected_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          loser_player_id?: string | null
          loser_sets?: number | null
          match_type: Database["public"]["Enums"]["match_type"]
          next_match_id?: string | null
          next_slot?: number | null
          played_at?: string | null
          player1_id?: string | null
          player2_id?: string | null
          position?: number | null
          rated?: boolean | null
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          submitted_by?: string | null
          tournament_id?: string | null
          updated_at?: string
          winner_player_id?: string | null
          winner_sets?: number | null
        }
        Update: {
          calc?: Json | null
          challenge_id?: string | null
          club_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          corrected_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          loser_player_id?: string | null
          loser_sets?: number | null
          match_type?: Database["public"]["Enums"]["match_type"]
          next_match_id?: string | null
          next_slot?: number | null
          played_at?: string | null
          player1_id?: string | null
          player2_id?: string | null
          position?: number | null
          rated?: boolean | null
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          submitted_by?: string | null
          tournament_id?: string | null
          updated_at?: string
          winner_player_id?: string | null
          winner_sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_loser_player_id_fkey"
            columns: ["loser_player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_loser_player_id_fkey"
            columns: ["loser_player_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_loser_player_id_fkey"
            columns: ["loser_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          club_id: string
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          payload: Json
          read_at: string | null
          telegram_sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          club_id: string
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          telegram_sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          club_id?: string
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          telegram_sent_at?: string | null
          title?: string
          user_id?: string
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
            referencedRelation: "player_match_stats"
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
            foreignKeyName: "rating_transactions_match_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
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
            referencedRelation: "player_match_stats"
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
          {
            foreignKeyName: "rating_transactions_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          club_id: string
          final_place: number | null
          id: string
          player_id: string
          rating_at_lock: number | null
          rating_status_at_lock:
            | Database["public"]["Enums"]["rating_status"]
            | null
          registered_at: string
          seed: number | null
          status: Database["public"]["Enums"]["participant_status"]
          tournament_id: string
          withdrawn_at: string | null
        }
        Insert: {
          club_id: string
          final_place?: number | null
          id?: string
          player_id: string
          rating_at_lock?: number | null
          rating_status_at_lock?:
            | Database["public"]["Enums"]["rating_status"]
            | null
          registered_at?: string
          seed?: number | null
          status?: Database["public"]["Enums"]["participant_status"]
          tournament_id: string
          withdrawn_at?: string | null
        }
        Update: {
          club_id?: string
          final_place?: number | null
          id?: string
          player_id?: string
          rating_at_lock?: number | null
          rating_status_at_lock?:
            | Database["public"]["Enums"]["rating_status"]
            | null
          registered_at?: string
          seed?: number | null
          status?: Database["public"]["Enums"]["participant_status"]
          tournament_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          average_rating: number | null
          bracket_size: number | null
          club_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          id: string
          k: number | null
          locked_at: string | null
          max_participants: number | null
          name: string
          registration_deadline: string | null
          seeding: Json | null
          starts_at: string
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
          winner_player_id: string | null
        }
        Insert: {
          average_rating?: number | null
          bracket_size?: number | null
          club_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          id?: string
          k?: number | null
          locked_at?: string | null
          max_participants?: number | null
          name: string
          registration_deadline?: string | null
          seeding?: Json | null
          starts_at: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          winner_player_id?: string | null
        }
        Update: {
          average_rating?: number | null
          bracket_size?: number | null
          club_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          id?: string
          k?: number | null
          locked_at?: string | null
          max_participants?: number | null
          name?: string
          registration_deadline?: string | null
          seeding?: Json | null
          starts_at?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournaments_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "player_match_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournaments_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      player_match_stats: {
        Row: {
          club_id: string | null
          losses: number | null
          player_id: string | null
          wins: number | null
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
      _apply_match_rating: {
        Args: {
          p_deltas: Json
          p_event_id: string
          p_match: Database["public"]["Tables"]["matches"]["Row"]
          p_reason: Database["public"]["Enums"]["rating_tx_reason"]
          p_version: number
        }
        Returns: undefined
      }
      admin_adjust_rating: {
        Args: { p_new_rating: number; p_player_id: string; p_reason: string }
        Returns: string
      }
      admin_approve_player: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      admin_complete_tournament: {
        Args: { p_newcomers?: Json; p_tournament_id: string }
        Returns: undefined
      }
      admin_confirm_tournament_match: {
        Args: {
          p_calc: Json
          p_deltas: Json
          p_loser_sets: number
          p_match_id: string
          p_rated: boolean
          p_version?: number
          p_winner_player_id: string
          p_winner_sets: number
        }
        Returns: undefined
      }
      admin_correct_tournament_match: {
        Args: {
          p_calc: Json
          p_deltas: Json
          p_loser_sets: number
          p_match_id: string
          p_rated: boolean
          p_reason: string
          p_version?: number
          p_winner_player_id: string
          p_winner_sets: number
        }
        Returns: undefined
      }
      admin_lock_bracket: {
        Args: { p_bracket: Json; p_tournament_id: string }
        Returns: undefined
      }
      admin_remove_participant: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      admin_set_player_blocked: {
        Args: { p_blocked: boolean; p_player_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_set_tournament_status: {
        Args: {
          p_status: Database["public"]["Enums"]["tournament_status"]
          p_tournament_id: string
        }
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
      cancel_challenge: {
        Args: { p_challenge_id: string; p_reason?: string }
        Returns: undefined
      }
      confirm_challenge_result: {
        Args: { p_calc: Json; p_challenge_id: string; p_deltas: Json; p_rated: boolean; p_version?: number }
        Returns: undefined
      }
      create_challenge: {
        Args: { p_message?: string; p_opponent_id: string; p_proposed_at: string }
        Returns: string
      }
      mark_notifications_read: {
        Args: { p_ids?: number[] }
        Returns: undefined
      }
      reject_challenge_result: {
        Args: { p_challenge_id: string; p_note: string }
        Returns: undefined
      }
      respond_challenge: {
        Args: { p_accept: boolean; p_challenge_id: string }
        Returns: undefined
      }
      submit_challenge_result: {
        Args: { p_challenge_id: string; p_loser_sets: number; p_winner_id: string; p_winner_sets: number }
        Returns: string
      }
      current_club_ids: { Args: never; Returns: string[] }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      register_for_tournament: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      tournament_status_after_count: {
        Args: { p_club_id: string; p_count: number }
        Returns: Database["public"]["Enums"]["rating_status"]
      }
      withdraw_from_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
    }
    Enums: {
      challenge_status:
        | "PENDING"
        | "ACCEPTED"
        | "DECLINED"
        | "CANCELLED"
        | "EXPIRED"
        | "RESULT_SUBMITTED"
        | "COMPLETED"
      club_role: "PLAYER" | "ADMIN"
      external_rating_source: "RTTF"
      gender: "MALE" | "FEMALE"
      match_status: "PENDING" | "CONFIRMED" | "CANCELLED" | "CORRECTED"
      match_type: "TOURNAMENT" | "CHALLENGE" | "CASUAL"
      notification_kind:
        | "CHALLENGE_CREATED"
        | "CHALLENGE_ACCEPTED"
        | "CHALLENGE_DECLINED"
        | "CHALLENGE_CANCELLED"
        | "CHALLENGE_RESULT_SUBMITTED"
        | "CHALLENGE_RESULT_REJECTED"
        | "CHALLENGE_COMPLETED"
        | "TOURNAMENT_REGISTRATION_OPEN"
        | "BRACKET_LOCKED"
        | "TOURNAMENT_MATCH_CONFIRMED"
        | "TOURNAMENT_COMPLETED"
        | "RATING_CHANGED"
        | "PLAYER_APPROVED"
        | "EXTERNAL_RATING_VERIFIED"
      participant_status: "REGISTERED" | "WITHDRAWN" | "NO_SHOW"
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
      tournament_format: "SINGLE_ELIMINATION"
      tournament_status:
        | "DRAFT"
        | "REGISTRATION_OPEN"
        | "REGISTRATION_CLOSED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
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
      challenge_status: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "RESULT_SUBMITTED", "COMPLETED"],
      club_role: ["PLAYER", "ADMIN"],
      external_rating_source: ["RTTF"],
      gender: ["MALE", "FEMALE"],
      match_status: ["PENDING", "CONFIRMED", "CANCELLED", "CORRECTED"],
      match_type: ["TOURNAMENT", "CHALLENGE", "CASUAL"],
      participant_status: ["REGISTERED", "WITHDRAWN", "NO_SHOW"],
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
      tournament_format: ["SINGLE_ELIMINATION"],
      tournament_status: [
        "DRAFT",
        "REGISTRATION_OPEN",
        "REGISTRATION_CLOSED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      verification_status: ["PENDING", "VERIFIED", "REJECTED"],
    },
  },
} as const
