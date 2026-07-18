export type ComparisonBucket =
  | "aligned"
  | "worth_discussing"
  | "possible_concern";

export type QuestionType = "single" | "scale" | "text";

export type QuestionSensitivity =
  | "standard"
  | "sensitive"
  | "professional_discussion";

export type ComparisonMode =
  | "exact"
  | "scale_distance"
  | "discussion_only"
  | "never_compare";
