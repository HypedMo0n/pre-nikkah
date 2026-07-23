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

type ImportanceLevel = "low" | "medium" | "high";

type ProfileRow = {
  id: string;
  display_name: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
};

type SpaceRow = {
  id: string;
  created_by: string;
  status: "waiting" | "active" | "paused" | "closed";
  created_at: string;
  updated_at: string;
};

type SpaceMemberRow = {
  space_id: string;
  user_id: string;
  role: "a" | "b";
  joined_at: string;
  ended_at: string | null;
};

type SpaceInviteRow = {
  id: string;
  space_id: string;
  code_hash: string;
  expires_at: string;
  redeemed_at: string | null;
  created_by: string;
  redeemed_by: string | null;
  created_at: string;
};

type QuestionOption = {
  key: string;
  label: string;
  description: string;
  cluster: string;
};

type TopicRow = {
  id: string;
  slug: string;
  order_index: number;
  title: string;
  subtitle: string;
  default_importance: ImportanceLevel | null;
  is_active: boolean;
  created_at: string;
};

type QuestionRow = {
  id: string;
  topic_id: string;
  key: string;
  order_index: number;
  text: string;
  options: QuestionOption[];
  importance_default: ImportanceLevel;
  starter_discuss: string;
  is_active: boolean;
  created_at: string;
};

type AnswerRow = {
  id: string;
  question_id: string;
  user_id: string;
  space_id: string;
  option_key: string;
  importance: ImportanceLevel;
  private_note: string | null;
  created_at: string;
  updated_at: string;
};

type AnswerShareRow = {
  answer_id: string;
  shared_with_user_id: string;
  shared_at: string;
};

type ComparisonRow = {
  space_id: string;
  question_id: string;
  state: "pending" | "aligned" | "discuss";
  priority: ImportanceLevel | null;
  priority_driven_by: string | null;
  computed_at: string;
};

type DiscussionRow = {
  space_id: string;
  question_id: string;
  discussed_at: string;
  discussed_by: string;
};

type SharedNoteRow = {
  id: string;
  space_id: string;
  question_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type SpaceEventKind = "partner_joined" | "topic_finished" | "note_added" | "answer_shared" | "space_closed";

type SpaceEventRow = {
  id: string;
  space_id: string;
  actor_id: string | null;
  kind: SpaceEventKind;
  payload_json: Json;
  created_at: string;
};

type EventReadRow = {
  space_event_id: string;
  user_id: string;
  read_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string;
          display_name?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        },
        { display_name?: string | null; locale?: string; updated_at?: string }
      >;
      spaces: TableDefinition<
        SpaceRow,
        {
          id?: string;
          created_by: string;
          status?: SpaceRow["status"];
          created_at?: string;
          updated_at?: string;
        },
        { status?: SpaceRow["status"]; updated_at?: string }
      >;
      space_members: TableDefinition<
        SpaceMemberRow,
        {
          space_id: string;
          user_id: string;
          role: "a" | "b";
          joined_at?: string;
          ended_at?: string | null;
        },
        { ended_at?: string | null }
      >;
      space_invites: TableDefinition<
        SpaceInviteRow,
        {
          id?: string;
          space_id: string;
          code_hash: string;
          expires_at: string;
          redeemed_at?: string | null;
          created_by: string;
          redeemed_by?: string | null;
          created_at?: string;
        },
        { expires_at?: string; redeemed_at?: string | null; redeemed_by?: string | null }
      >;
      topics: TableDefinition<
        TopicRow,
        Omit<TopicRow, "created_at" | "default_importance" | "is_active"> & {
          default_importance?: ImportanceLevel | null;
          is_active?: boolean;
          created_at?: string;
        },
        Partial<Omit<TopicRow, "id" | "created_at">>
      >;
      questions: TableDefinition<
        QuestionRow,
        Omit<QuestionRow, "created_at" | "importance_default" | "is_active"> & {
          importance_default?: ImportanceLevel;
          is_active?: boolean;
          created_at?: string;
        },
        Partial<Omit<QuestionRow, "id" | "created_at">>
      >;
      answers: TableDefinition<
        AnswerRow,
        {
          id?: string;
          question_id: string;
          user_id: string;
          space_id: string;
          option_key: string;
          importance?: ImportanceLevel;
          private_note?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          option_key?: string;
          importance?: ImportanceLevel;
          private_note?: string | null;
          updated_at?: string;
        }
      >;
      answer_shares: TableDefinition<
        AnswerShareRow,
        { answer_id: string; shared_with_user_id: string; shared_at?: string },
        never
      >;
      comparisons: TableDefinition<ComparisonRow, never, never>;
      discussions: TableDefinition<
        DiscussionRow,
        {
          space_id: string;
          question_id: string;
          discussed_at?: string;
          discussed_by: string;
        },
        never
      >;
      shared_notes: TableDefinition<
        SharedNoteRow,
        {
          id?: string;
          space_id: string;
          question_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        },
        never
      >;
      space_events: TableDefinition<SpaceEventRow, never, never>;
      event_reads: TableDefinition<
        EventReadRow,
        { space_event_id: string; user_id: string; read_at?: string },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_current_user_space_member: { Args: { p_space_id: string }; Returns: boolean };
      current_space_id: { Args: Record<string, never>; Returns: string | null };
      get_or_create_current_space: { Args: Record<string, never>; Returns: string };
      get_partner_display_name: { Args: Record<string, never>; Returns: string | null };
      has_shared_own_answer: { Args: { p_question_id: string }; Returns: boolean };
      create_space_invite: {
        Args: Record<string, never>;
        Returns: {
          invite_id: string;
          space_id: string;
          invite_code: string;
          expires_at: string;
        }[];
      };
      redeem_space_invite: { Args: { p_invite_code: string }; Returns: string };
      inspect_space_invite: { Args: { p_invite_code: string }; Returns: Json };
      revoke_space_invite: { Args: { p_invite_id: string }; Returns: undefined };
      share_answer: { Args: { p_question_id: string }; Returns: undefined };
      get_partner_shared_answer: {
        Args: { p_question_id: string };
        Returns: { option_key: string; shared_at: string }[];
      };
      get_topic_progress: {
        Args: { p_topic_id: string };
        Returns: { mine: number; partner: number; total: number }[];
      };
      pause_space: { Args: Record<string, never>; Returns: undefined };
      resume_space: { Args: Record<string, never>; Returns: undefined };
      unlink_partner: { Args: Record<string, never>; Returns: undefined };
      prepare_account_deletion: { Args: { p_user_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];
