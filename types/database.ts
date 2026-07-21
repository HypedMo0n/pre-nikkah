export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type PrivateAccountRow = {
  id: string;
  preferred_locale: "en" | "fr";
  private_display_name: string | null;
  relationship_stage:
    | "getting_to_know_seriously"
    | "families_involved"
    | "engaged"
    | "preparing_for_nikah"
    | "other"
    | null;
  onboarding_completed: boolean;
  onboarding_step: string | null;
  product_intro_completed: boolean;
  privacy_intro_completed: boolean;
  entry_mode: "create" | "join" | null;
  preferred_pace: "gentle" | "steady" | "flexible";
  created_at: string;
  updated_at: string;
};

type TopicRow = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  estimated_minutes: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
};

type QuestionRow = {
  id: string;
  topic_id: string;
  type: "single" | "scale" | "text";
  text: string;
  helper_text: string | null;
  options: Json | null;
  sensitivity: "standard" | "sensitive" | "professional_discussion";
  comparison_mode: "exact" | "scale_distance" | "discussion_only" | "never_compare";
  can_reveal: boolean;
  order_index: number;
  is_active: boolean;
  created_at: string;
};

type AnswerRow = {
  id: string;
  question_id: string;
  user_id: string;
  couple_id: string;
  value: Json;
  importance: "flexible" | "important" | "essential" | "non_negotiable";
  discussion_preference: "together" | "professional" | "outside_app" | null;
  revealed: boolean;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      private_accounts: TableDefinition<
        PrivateAccountRow,
        {
          id: string;
          preferred_locale?: "en" | "fr";
          private_display_name?: string | null;
          relationship_stage?: PrivateAccountRow["relationship_stage"];
          onboarding_completed?: boolean;
          onboarding_step?: string | null;
          product_intro_completed?: boolean;
          privacy_intro_completed?: boolean;
          entry_mode?: "create" | "join" | null;
          preferred_pace?: PrivateAccountRow["preferred_pace"];
          created_at?: string;
          updated_at?: string;
        },
        Partial<Omit<PrivateAccountRow, "id" | "created_at" | "updated_at">>
      >;
      couples: TableDefinition<
        {
          id: string;
          user_a_id: string;
          user_b_id: string | null;
          status: "waiting" | "active" | "closed";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_a_id: string;
          user_b_id?: string | null;
          status?: "waiting" | "active" | "closed";
          created_at?: string;
          updated_at?: string;
        },
        {
          user_b_id?: string | null;
          status?: "waiting" | "active" | "closed";
          updated_at?: string;
        }
      >;
      couple_memberships: TableDefinition<
        {
          couple_id: string;
          user_id: string;
          member_role: "a" | "b";
          joined_at: string;
          ended_at: string | null;
        },
        {
          couple_id: string;
          user_id: string;
          member_role: "a" | "b";
          joined_at?: string;
          ended_at?: string | null;
        },
        { ended_at?: string | null }
      >;
      journey_policy_acceptances: TableDefinition<
        {
          id: string;
          couple_id: string;
          user_id: string;
          policy_version: string;
          accepted_at: string;
        },
        {
          id?: string;
          couple_id: string;
          user_id: string;
          policy_version: string;
          accepted_at?: string;
        },
        { accepted_at?: string }
      >;
      couple_invites: TableDefinition<
        {
          id: string;
          couple_id: string;
          code_hash: string;
          expires_at: string;
          redeemed_at: string | null;
          created_by: string;
          redeemed_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          couple_id: string;
          code_hash: string;
          expires_at: string;
          redeemed_at?: string | null;
          created_by: string;
          redeemed_by?: string | null;
          created_at?: string;
        },
        {
          expires_at?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
        }
      >;
      topics: TableDefinition<
        TopicRow,
        Omit<TopicRow, "created_at"> & { created_at?: string },
        Partial<Omit<TopicRow, "id" | "created_at">>
      >;
      questions: TableDefinition<
        QuestionRow,
        Omit<QuestionRow, "created_at"> & { created_at?: string },
        Partial<Omit<QuestionRow, "id" | "created_at">>
      >;
      checklist_definitions: TableDefinition<
        {
          id: string;
          slug: string;
          label: string;
          description: string | null;
          order_index: number;
          is_active: boolean;
        },
        {
          id: string;
          slug: string;
          label: string;
          description?: string | null;
          order_index: number;
          is_active?: boolean;
        },
        {
          slug?: string;
          label?: string;
          description?: string | null;
          order_index?: number;
          is_active?: boolean;
        }
      >;
      answers: TableDefinition<
        AnswerRow,
        {
          id?: string;
          question_id: string;
          user_id: string;
          couple_id: string;
          value: Json;
          importance?: "flexible" | "important" | "essential" | "non_negotiable";
          discussion_preference?: "together" | "professional" | "outside_app" | null;
          revealed?: boolean;
          revealed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          value?: Json;
          importance?: "flexible" | "important" | "essential" | "non_negotiable";
          discussion_preference?: "together" | "professional" | "outside_app" | null;
          revealed?: boolean;
          revealed_at?: string | null;
          updated_at?: string;
        }
      >;
      answer_reveal_events: TableDefinition<
        {
          id: string;
          answer_id: string;
          user_id: string;
          action: "revealed" | "revoked";
          created_at: string;
        },
        {
          id?: string;
          answer_id: string;
          user_id: string;
          action: "revealed" | "revoked";
          created_at?: string;
        },
        never
      >;
      topic_progress: TableDefinition<
        {
          id: string;
          couple_id: string;
          topic_id: string;
          user_id: string;
          completed_at: string | null;
          updated_at: string;
        },
        {
          id?: string;
          couple_id: string;
          topic_id: string;
          user_id: string;
          completed_at?: string | null;
          updated_at?: string;
        },
        { completed_at?: string | null; updated_at?: string }
      >;
      guided_discussions: TableDefinition<
        {
          id: string;
          couple_id: string;
          topic_id: string;
          question_id: string;
          status: "not_started" | "discussing" | "discussed";
          shared_note: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          couple_id: string;
          topic_id: string;
          question_id: string;
          status?: "not_started" | "discussing" | "discussed";
          shared_note?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: "not_started" | "discussing" | "discussed";
          shared_note?: string | null;
          updated_at?: string;
        }
      >;
      couple_checklist_items: TableDefinition<
        {
          id: string;
          couple_id: string;
          checklist_definition_id: string;
          done: boolean;
          completed_at: string | null;
          updated_at: string;
        },
        {
          id?: string;
          couple_id: string;
          checklist_definition_id: string;
          done?: boolean;
          completed_at?: string | null;
          updated_at?: string;
        },
        { done?: boolean; completed_at?: string | null; updated_at?: string }
      >;
      journey_closure_notices: TableDefinition<
        {
          id: string;
          user_id: string;
          reason: "closed" | "partner_account_deleted";
          created_at: string;
          acknowledged_at: string | null;
        },
        {
          id?: string;
          user_id: string;
          reason: "closed" | "partner_account_deleted";
          created_at?: string;
          acknowledged_at?: string | null;
        },
        { acknowledged_at?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_journey_policy_version: { Args: Record<string, never>; Returns: string };
      current_couple_id: { Args: Record<string, never>; Returns: string | null };
      is_current_user_couple_member: {
        Args: { p_couple_id: string };
        Returns: boolean;
      };
      create_couple_invite: {
        Args: { p_policy_version: string };
        Returns: {
          invite_id: string;
          couple_id: string;
          invite_code: string;
          expires_at: string;
        }[];
      };
      inspect_couple_invite: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      redeem_couple_invite: {
        Args: { p_invite_code: string; p_policy_version: string };
        Returns: string;
      };
      revoke_couple_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      get_connection_overview: { Args: Record<string, never>; Returns: Json };
      get_question_comparison: {
        Args: { p_question_id: string };
        Returns: {
          status: string;
          question_id: string;
          bucket: string | null;
          own_answer: Json | null;
          own_answer_revealed: boolean | null;
          partner_answer_revealed: boolean | null;
          partner_answer: Json | null;
        }[];
      };
      get_topic_comparison_summary: {
        Args: { p_topic_id: string };
        Returns: Json;
      };
      close_couple_journey: { Args: Record<string, never>; Returns: undefined };
      abandon_empty_waiting_journey: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      prepare_account_deletion: { Args: { p_user_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];