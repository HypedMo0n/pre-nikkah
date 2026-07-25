export type Importance = "low" | "medium" | "high";
export type ComparisonState = "pending" | "aligned" | "discuss";
export type SpaceStatus = "none" | "waiting" | "active" | "paused";

export type SpaceOverview = {
  status: SpaceStatus;
  spaceId?: string;
  role?: "creator" | "partner";
  inviteExpiresAt?: string | null;
  partner?: { id: string; displayName: string } | null;
};

export type TopicContent = {
  id: string;
  slug: string;
  orderIndex: number;
  title: string;
  subtitle: string;
};

export type OptionContent = {
  key: string;
  cluster: string;
  orderIndex: number;
  label: string;
  description: string;
};

export type QuestionContent = {
  id: string;
  key: string;
  topicId: string;
  orderIndex: number;
  defaultImportance: Importance;
  text: string;
  starterAligned: string;
  starterDiscuss: string;
  options: OptionContent[];
};

export type JourneyContent = {
  topics: TopicContent[];
  questions: QuestionContent[];
};

export type JourneyAnswer = {
  id: string;
  questionId: string;
  userId: string;
  optionKey: string;
  importance: Importance;
  updatedAt: string;
};

export type JourneyComparison = {
  questionId: string;
  state: ComparisonState;
  priority: Importance;
  highPriorityUserIds: string[];
  computedAt: string;
};

export type TopicProgress = {
  topicId: string;
  own: number;
  partner: number;
  total: number;
  together: number;
};
