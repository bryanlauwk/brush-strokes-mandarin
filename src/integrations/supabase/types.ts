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
      guesses: {
        Row: {
          created_at: string
          id: number
          kind: string
          player_id: string | null
          player_name: string | null
          room_id: string
          round: number
          text: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          kind?: string
          player_id?: string | null
          player_name?: string | null
          room_id: string
          round?: number
          text?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          player_id?: string | null
          player_name?: string | null
          room_id?: string
          round?: number
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guesses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tokens: {
        Row: {
          player_id: string
          token: string
        }
        Insert: {
          player_id: string
          token: string
        }
        Update: {
          player_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_tokens_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar: number
          avatar_svg: string | null
          client_id: string | null
          connection_status: string
          disconnected_at: string | null
          has_guessed: boolean
          id: string
          is_host: boolean
          joined_at: string
          last_seen: string
          name: string
          room_id: string
          round_score: number
          score: number
        }
        Insert: {
          avatar?: number
          avatar_svg?: string | null
          client_id?: string | null
          connection_status?: string
          disconnected_at?: string | null
          has_guessed?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          last_seen?: string
          name: string
          room_id: string
          round_score?: number
          score?: number
        }
        Update: {
          avatar?: number
          avatar_svg?: string | null
          client_id?: string | null
          connection_status?: string
          disconnected_at?: string | null
          has_guessed?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          last_seen?: string
          name?: string
          room_id?: string
          round_score?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_secrets: {
        Row: {
          choices: Json
          drawer_id: string | null
          room_id: string
          updated_at: string
          used_words: Json
          word: string | null
        }
        Insert: {
          choices?: Json
          drawer_id?: string | null
          room_id: string
          updated_at?: string
          used_words?: Json
          word?: string | null
        }
        Update: {
          choices?: Json
          drawer_id?: string | null
          room_id?: string
          updated_at?: string
          used_words?: Json
          word?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_round: number
          difficulty: string
          draw_seconds: number
          drawer_id: string | null
          host_id: string | null
          id: string
          masked_word: string | null
          revealed_word: string | null
          room_theme: string | null
          round_ends_at: string | null
          round_started_at: string | null
          status: string
          total_rounds: number
          turn_index: number
          turn_order: Json
          word_length: number | null
        }
        Insert: {
          code: string
          created_at?: string
          current_round?: number
          difficulty?: string
          draw_seconds?: number
          drawer_id?: string | null
          host_id?: string | null
          id?: string
          masked_word?: string | null
          revealed_word?: string | null
          room_theme?: string | null
          round_ends_at?: string | null
          round_started_at?: string | null
          status?: string
          total_rounds?: number
          turn_index?: number
          turn_order?: Json
          word_length?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          current_round?: number
          difficulty?: string
          draw_seconds?: number
          drawer_id?: string | null
          host_id?: string | null
          id?: string
          masked_word?: string | null
          revealed_word?: string | null
          room_theme?: string | null
          round_ends_at?: string | null
          round_started_at?: string | null
          status?: string
          total_rounds?: number
          turn_index?: number
          turn_order?: Json
          word_length?: number | null
        }
        Relationships: []
      }
      strokes: {
        Row: {
          created_at: string
          id: number
          payload: Json
          room_id: string
          round: number
          turn_index: number
        }
        Insert: {
          created_at?: string
          id?: number
          payload: Json
          room_id: string
          round?: number
          turn_index?: number
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
          room_id?: string
          round?: number
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "strokes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          category: string
          difficulty: string | null
          id: number
          word: string
        }
        Insert: {
          category: string
          difficulty?: string | null
          id?: number
          word: string
        }
        Update: {
          category?: string
          difficulty?: string | null
          id?: number
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
