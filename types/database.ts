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
      answer_shares: {
        Row: {
          answer_id: string
          shared_at: string
          shared_with_user_id: string
        }
        Insert: {
          answer_id: string
          shared_at?: string
          shared_with_user_id: string
        }
        Update: {
          answer_id?: string
          shared_at?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_shares_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          id: string
          importance: string
          option_key: string
          question_id: string
          space_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          importance?: string
          option_key: string
          question_id: string
          space_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          importance?: string
          option_key?: string
          question_id?: string
          space_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_option_key_fkey"
            columns: ["question_id", "option_key"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["question_id", "key"]
          },
          {
            foreignKeyName: "answers_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          computed_at: string
          high_priority_user_ids: string[]
          priority: string
          question_id: string
          space_id: string
          state: string
        }
        Insert: {
          computed_at?: string
          high_priority_user_ids?: string[]
          priority: string
          question_id: string
          space_id: string
          state: string
        }
        Update: {
          computed_at?: string
          high_priority_user_ids?: string[]
          priority?: string
          question_id?: string
          space_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          discussed_at: string
          discussed_by: string
          question_id: string
          space_id: string
        }
        Insert: {
          discussed_at?: string
          discussed_by: string
          question_id: string
          space_id: string
        }
        Update: {
          discussed_at?: string
          discussed_by?: string
          question_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_discussed_by_fkey"
            columns: ["discussed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reads: {
        Row: {
          read_at: string
          space_event_id: string
          user_id: string
        }
        Insert: {
          read_at?: string
          space_event_id: string
          user_id: string
        }
        Update: {
          read_at?: string
          space_event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reads_space_event_id_fkey"
            columns: ["space_event_id"]
            isOneToOne: false
            referencedRelation: "space_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_answer_notes: {
        Row: {
          answer_id: string
          body: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_id: string
          body: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          body?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_answer_notes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_answer_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_option_translations: {
        Row: {
          description: string
          label: string
          locale: string
          option_key: string
          question_id: string
        }
        Insert: {
          description: string
          label: string
          locale: string
          option_key: string
          question_id: string
        }
        Update: {
          description?: string
          label?: string
          locale?: string
          option_key?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_option_translations_question_id_option_key_fkey"
            columns: ["question_id", "option_key"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["question_id", "key"]
          },
        ]
      }
      question_options: {
        Row: {
          cluster: string
          key: string
          order_index: number
          question_id: string
        }
        Insert: {
          cluster: string
          key: string
          order_index: number
          question_id: string
        }
        Update: {
          cluster?: string
          key?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_translations: {
        Row: {
          locale: string
          question_id: string
          starter_aligned: string
          starter_discuss: string
          text: string
        }
        Insert: {
          locale: string
          question_id: string
          starter_aligned: string
          starter_discuss: string
          text: string
        }
        Update: {
          locale?: string
          question_id?: string
          starter_aligned?: string
          starter_discuss?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_translations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          default_importance: string
          id: string
          key: string
          order_index: number
          topic_id: string
        }
        Insert: {
          default_importance?: string
          id: string
          key: string
          order_index: number
          topic_id: string
        }
        Update: {
          default_importance?: string
          id?: string
          key?: string
          order_index?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          question_id: string
          space_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          question_id: string
          space_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_notes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          payload_json: Json
          space_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: string
          payload_json?: Json
          space_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload_json?: Json
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          ended_at: string | null
          joined_at: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          joined_at?: string
          role: string
          space_id: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          joined_at?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code_hash: string
          invite_expires_at: string
          invite_redeemed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code_hash: string
          invite_expires_at: string
          invite_redeemed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code_hash?: string
          invite_expires_at?: string
          invite_redeemed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_translations: {
        Row: {
          locale: string
          subtitle: string
          title: string
          topic_id: string
        }
        Insert: {
          locale: string
          subtitle: string
          title: string
          topic_id: string
        }
        Update: {
          locale?: string
          subtitle?: string
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_translations_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: string
          order_index: number
          slug: string
        }
        Insert: {
          id: string
          order_index: number
          slug: string
        }
        Update: {
          id?: string
          order_index?: number
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_shared_note: {
        Args: { p_body: string; p_question_id: string; p_space_id: string }
        Returns: string
      }
      can_current_user_read_answer: {
        Args: { p_answer_id: string }
        Returns: boolean
      }
      close_space: { Args: never; Returns: undefined }
      create_space: {
        Args: never
        Returns: {
          expires_at: string
          invite_code: string
          space_id: string
        }[]
      }
      current_space_id: { Args: never; Returns: string }
      get_space_overview: { Args: never; Returns: Json }
      get_topic_progress: {
        Args: { p_space_id: string; p_topic_id: string }
        Returns: {
          answered_count: number
          question_count: number
          user_id: string
        }[]
      }
      inspect_space_invite: { Args: { p_invite_code: string }; Returns: Json }
      is_current_space_member: {
        Args: { p_space_id: string }
        Returns: boolean
      }
      is_current_user_answer_owner: {
        Args: { p_answer_id: string }
        Returns: boolean
      }
      mark_question_discussed: {
        Args: { p_question_id: string; p_space_id: string }
        Returns: undefined
      }
      mark_space_event_read: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      prepare_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      recompute_comparison_internal: {
        Args: { p_question_id: string; p_space_id: string }
        Returns: {
          computed_at: string
          high_priority_user_ids: string[]
          priority: string
          question_id: string
          space_id: string
          state: string
        }
        SetofOptions: {
          from: "*"
          to: "comparisons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_space_invite: { Args: { p_invite_code: string }; Returns: string }
      regenerate_space_invite: {
        Args: never
        Returns: {
          expires_at: string
          invite_code: string
        }[]
      }
      save_answer: {
        Args: {
          p_importance?: string
          p_option_key: string
          p_private_note?: string
          p_question_id: string
          p_space_id: string
        }
        Returns: Json
      }
      set_space_paused: { Args: { p_paused: boolean }; Returns: undefined }
      share_answer: { Args: { p_answer_id: string }; Returns: undefined }
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
