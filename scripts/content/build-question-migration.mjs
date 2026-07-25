import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const sourceFiles = [
  "/home/codespace/.codex/attachments/35544924-e183-4397-87d4-4c1baf4adc4c/pasted-text.txt",
  "/home/codespace/.codex/attachments/d215a7bf-ab7e-4a2e-8b0c-0b1cfdd617c8/pasted-text.txt",
];
const outputFile = path.join(
  root,
  "supabase/migrations/20260724000200_question_bank_en.sql",
);

function uuidFor(value) {
  const bytes = createHash("sha256").update(`together-in-amanah:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const parts = await Promise.all(
  sourceFiles.map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
const topics = parts.flatMap((part) => part.topics).sort(
  (left, right) => left.order_index - right.order_index,
);
const questionKeys = topics.flatMap((topic) => topic.questions.map((question) => question.key));

if (topics.length !== 12 || questionKeys.length !== 72) {
  throw new Error(`Expected 12 topics and 72 questions; received ${topics.length} and ${questionKeys.length}.`);
}
if (new Set(questionKeys).size !== questionKeys.length) {
  throw new Error("Question keys must be globally unique.");
}

const lines = [
  "-- Generated deterministically from the approved two-part English question bank.",
  "-- Canonical content belongs in migrations; seed.sql remains development-only.",
  "",
];

for (const topic of topics) {
  const topicId = uuidFor(`topic:${topic.slug}`);
  lines.push(
    `insert into public.topics (id, slug, order_index) values (${sql(topicId)}, ${sql(topic.slug)}, ${topic.order_index});`,
    `insert into public.topic_translations (topic_id, locale, title, subtitle) values (${sql(topicId)}, 'en', ${sql(topic.title)}, ${sql(topic.subtitle)});`,
  );

  for (const question of topic.questions) {
    if (question.options.length < 3 || question.options.length > 5) {
      throw new Error(`${question.key} must contain three to five options.`);
    }
    const optionKeys = question.options.map((option) => option.key);
    if (new Set(optionKeys).size !== optionKeys.length) {
      throw new Error(`${question.key} has duplicate option keys.`);
    }
    for (const option of question.options) {
      if (!option.label || !option.description || !option.cluster) {
        throw new Error(`${question.key}/${option.key} is missing authored option content.`);
      }
    }

    const questionId = uuidFor(`question:${question.key}`);
    const defaultImportance =
      topic.slug === "dealbreakers" ? "high" : (question.default_importance ?? "medium");
    const alignedStarter =
      question.starter_aligned ??
      "You have landed in a similar place on this one. Compare what that would look like in an ordinary week, so the shared expectation is concrete.";

    lines.push(
      `insert into public.questions (id, key, topic_id, order_index, default_importance) values (${sql(questionId)}, ${sql(question.key)}, ${sql(topicId)}, ${question.order_index}, ${sql(defaultImportance)});`,
      `insert into public.question_translations (question_id, locale, text, starter_aligned, starter_discuss) values (${sql(questionId)}, 'en', ${sql(question.text)}, ${sql(alignedStarter)}, ${sql(question.starter_discuss)});`,
    );

    question.options.forEach((option, index) => {
      lines.push(
        `insert into public.question_options (question_id, key, cluster, order_index) values (${sql(questionId)}, ${sql(option.key)}, ${sql(option.cluster)}, ${index + 1});`,
        `insert into public.question_option_translations (question_id, option_key, locale, label, description) values (${sql(questionId)}, ${sql(option.key)}, 'en', ${sql(option.label)}, ${sql(option.description)});`,
      );
    });
  }
}

lines.push("");
await writeFile(outputFile, `${lines.join("\n")}\n`);
process.stdout.write(
  `Wrote ${path.relative(root, outputFile)} with ${topics.length} topics and ${questionKeys.length} questions.\n`,
);
