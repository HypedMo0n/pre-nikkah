# Question cadence

Question cadence is a reflection aid, not a completion target. It does not change answer validation, comparison modes, reveal permissions, or database access.

## Metadata

The production cadence adapter derives a `QuestionCadence` record for every active question from canonical question type, sensitivity, and stable order metadata:

- `order`: the deterministic presentation position;
- `sensitivity`: `low`, `medium`, or `high`;
- `effort`: `quick`, `reflective`, or `deep`;
- `format`: the current MVP formats `single_choice`, `scale`, and `free_text`;
- `section`: opening, exploration, or reflection;
- `pauseAfter`: a calm pause after deep or high-sensitivity prompts;
- `recommendedBreakAfter`: an optional break after a topic-length session of five to eight questions.

This adapter intentionally does not add multi-choice or scenario answers to the MVP. Adding a UI format would also require database validation, answer validation, comparison review, RLS tests, and end-to-end tests.

## Ordering rules

1. The lowest-order standard question opens each topic.
2. Canonical order is otherwise preserved.
3. A non-high-sensitivity question is pulled forward when it can prevent consecutive high-sensitivity prompts.
4. Text questions are always treated as deep reflection. Their database comparison mode remains `discussion_only` or `never_compare`.
5. A break prompt is optional and appears only after the final question of a five-to-eight-question MVP topic.
6. Save and exit remains available from every question.

Cadence never creates a streak, timer, countdown, score, points, reward, completion pressure, or incentive to reveal an answer. No raw answer content is collected for timing or cadence analytics.

## Safety boundary

Cadence metadata is based only on canonical question metadata. It does not inspect answer values. A `professional_discussion` prompt can request a pause, but the answer stays owner-only and follows its existing `never_compare` and non-revealable controls. Cadence data is safe to serialize because it contains no answer content.
