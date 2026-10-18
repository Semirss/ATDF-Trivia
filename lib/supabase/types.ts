export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          title: string;
          icon_url: string;
          difficulty: "easy" | "medium" | "hard";
          is_reward_based: boolean;
          is_active: boolean;
          sort_order: number;
          color_hex: string;
          description: string;
          card_background_url: string;
          map_background_url: string;
          level_podium_url: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          icon_url: string;
          difficulty: "easy" | "medium" | "hard";
          is_reward_based?: boolean;
          is_active?: boolean;
          sort_order?: number;
          color_hex?: string;
          description?: string;
          card_background_url?: string;
          map_background_url?: string;
          level_podium_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          icon_url?: string;
          difficulty?: "easy" | "medium" | "hard";
          is_reward_based?: boolean;
          is_active?: boolean;
          sort_order?: number;
          color_hex?: string;
          description?: string;
          card_background_url?: string;
          map_background_url?: string;
          level_podium_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category_levels: {
        Row: {
          id: string;
          category_id: string;
          level_number: number;
          title: string;
          difficulty: "easy" | "medium" | "hard";
          question_count: number;
          time_limit_seconds: number;
          points_per_correct: number;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          category_id: string;
          level_number: number;
          title: string;
          difficulty?: "easy" | "medium" | "hard";
          question_count?: number;
          time_limit_seconds?: number;
          points_per_correct?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          level_number?: number;
          title?: string;
          difficulty?: "easy" | "medium" | "hard";
          question_count?: number;
          time_limit_seconds?: number;
          points_per_correct?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_levels_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      questions: {
        Row: {
          id: string;
          level_id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: "a" | "b" | "c" | "d";
          explanation: string | null;
          translations: Json;
          media_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          level_id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: "a" | "b" | "c" | "d";
          explanation?: string | null;
          translations?: Json;
          media_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          level_id?: string;
          question_text?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          correct_option?: "a" | "b" | "c" | "d";
          explanation?: string | null;
          translations?: Json;
          media_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "category_levels";
            referencedColumns: ["id"];
          }
        ];
      };
      donation_transactions: {
        Row: {
          id: string;
          tx_ref: string;
          player_id: string | null;
          donor_name: string | null;
          donor_email: string | null;
          donor_phone: string | null;
          amount: number;
          currency: "ETB";
          status: "pending" | "success" | "failed" | "cancelled" | "refunded";
          chapa_reference: string | null;
          checkout_url: string | null;
          mode: string | null;
          metadata: Json;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tx_ref: string;
          player_id?: string | null;
          donor_name?: string | null;
          donor_email?: string | null;
          donor_phone?: string | null;
          amount: number;
          currency?: "ETB";
          status?: "pending" | "success" | "failed" | "cancelled" | "refunded";
          chapa_reference?: string | null;
          checkout_url?: string | null;
          mode?: string | null;
          metadata?: Json;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tx_ref?: string;
          player_id?: string | null;
          donor_name?: string | null;
          donor_email?: string | null;
          donor_phone?: string | null;
          amount?: number;
          currency?: "ETB";
          status?: "pending" | "success" | "failed" | "cancelled" | "refunded";
          chapa_reference?: string | null;
          checkout_url?: string | null;
          mode?: string | null;
          metadata?: Json;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donation_transactions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      players: {
        Row: {
          id: string;
          name: string;
          age: number;
          avatar_url: string | null;
          telegram_id: string | null;
          telegram_username: string | null;
          telegram_phone: string | null;
          source: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          age: number;
          avatar_url?: string | null;
          telegram_id?: string | null;
          telegram_username?: string | null;
          telegram_phone?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          age?: number;
          avatar_url?: string | null;
          telegram_id?: string | null;
          telegram_username?: string | null;
          telegram_phone?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reward_profiles: {
        Row: {
          id: string;
          player_id: string;
          full_name: string;
          phone: string;
          email: string;
          telegram_username: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          full_name: string;
          phone: string;
          email: string;
          telegram_username?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          full_name?: string;
          phone?: string;
          email?: string;
          telegram_username?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reward_profiles_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      player_progress: {
        Row: {
          id: string;
          player_id: string;
          category_id: string;
          current_level: number;
          current_question_index: number;
          score: number;
          levels_completed: number;
          last_played_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          category_id: string;
          current_level?: number;
          current_question_index?: number;
          score?: number;
          levels_completed?: number;
          last_played_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          category_id?: string;
          current_level?: number;
          current_question_index?: number;
          score?: number;
          levels_completed?: number;
          last_played_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_progress_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_progress_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      player_game_sessions: {
        Row: {
          id: string;
          player_id: string;
          category_id: string;
          level_id: string;
          started_at: string;
        };
        Insert: {
          id: string;
          player_id: string;
          category_id: string;
          level_id: string;
          started_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          category_id?: string;
          level_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_game_sessions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_game_sessions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_game_sessions_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "category_levels";
            referencedColumns: ["id"];
          }
        ];
      };
      score_events: {
        Row: {
          id: string;
          player_id: string;
          category_id: string;
          level_id: string;
          question_id: string | null;
          is_correct: boolean;
          points: number;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          category_id: string;
          level_id: string;
          question_id?: string | null;
          is_correct: boolean;
          points?: number;
          answered_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          category_id?: string;
          level_id?: string;
          question_id?: string | null;
          is_correct?: boolean;
          points?: number;
          answered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "score_events_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_events_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_events_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "category_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "score_events_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      rewards: {
        Row: {
          id: string;
          player_id: string;
          category_id: string;
          reward_type: string;
          reward_value: string;
          status: "pending" | "claimed" | "expired";
          earned_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          category_id: string;
          reward_type: string;
          reward_value: string;
          status?: "pending" | "claimed" | "expired";
          earned_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          category_id?: string;
          reward_type?: string;
          reward_value?: string;
          status?: "pending" | "claimed" | "expired";
          earned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rewards_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          player_id: string;
          text: string;
          reply_to_message_id: string | null;
          posted_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          text: string;
          reply_to_message_id?: string | null;
          posted_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          text?: string;
          reply_to_message_id?: string | null;
          posted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      question_submissions: {
        Row: {
          id: string;
          player_id: string | null;
          player_name: string;
          question_text: string;
          source: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id?: string | null;
          player_name?: string;
          question_text: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string | null;
          player_name?: string;
          question_text?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_submissions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      game_config: {
        Row: {
          key: string;
          value: Json;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_daily: {
        Row: {
          id: string;
          event_date: string;
          event_type: "button_tap" | "game_played" | "level_completed";
          event_key: string;
          label: string;
          path: string;
          count: number;
          last_seen_at: string | null;
        };
        Insert: {
          id?: string;
          event_date: string;
          event_type: "button_tap" | "game_played" | "level_completed";
          event_key: string;
          label?: string;
          path?: string;
          count?: number;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          event_date?: string;
          event_type?: "button_tap" | "game_played" | "level_completed";
          event_key?: string;
          label?: string;
          path?: string;
          count?: number;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      youtube_ad_views: {
        Row: {
          id: string;
          player_id: string | null;
          video_id: string;
          video_url: string;
          started_at: string;
          completed_at: string | null;
          watched_seconds: number;
        };
        Insert: {
          id: string;
          player_id?: string | null;
          video_id: string;
          video_url: string;
          started_at?: string;
          completed_at?: string | null;
          watched_seconds?: number;
        };
        Update: {
          id?: string;
          player_id?: string | null;
          video_id?: string;
          video_url?: string;
          started_at?: string;
          completed_at?: string | null;
          watched_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "youtube_ad_views_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      runtime_database_config: {
        Row: {
          slot: "active";
          encrypted_payload: string;
          updated_at: string;
        };
        Insert: {
          slot?: "active";
          encrypted_payload: string;
          updated_at?: string;
        };
        Update: {
          slot?: "active";
          encrypted_payload?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      youtube_ad_view_stats: {
        Row: {
          video_id: string;
          video_url: string | null;
          views: number;
          completed_views: number;
          watched_seconds: number;
          last_viewed_at: string | null;
        };
        Relationships: [];
      };
      leaderboard: {
        Row: {
          player_id: string;
          name: string;
          avatar_url: string | null;
          total_score: number;
          categories_played: number;
          global_rank: number;
          completion_percent: number;
          questions_answered: number;
          total_questions: number;
          current_level_reached: number;
          is_verified: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      increment_analytics_daily: {
        Args: {
          events: Json;
        };
        Returns: undefined;
      };
      delete_category_level: {
        Args: {
          target_level_id: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
