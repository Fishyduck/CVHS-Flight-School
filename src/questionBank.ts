export type Difficulty = "recall" | "concept" | "application" | "advanced";
export type QuestionType = "multiple-choice" | "scenario" | "calculation" | "figure" | "reference";

export type Question = {
  id: string;
  chapter: number;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  sourcePage: string;
  figureReference?: string;
  learningObjective: string;
  family: string;
};

const assessments = import.meta.glob<Question[]>("./assessments/chapter-*.json", {
  eager: true,
  import: "default",
});

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getAssessmentQuestions(chapter: number): Question[] {
  const suffix = `chapter-${String(chapter).padStart(2, "0")}.json`;
  const key = Object.keys(assessments).find((path) => path.endsWith(suffix));
  return key ? assessments[key].map((q) => ({ ...q, choices: [...q.choices] })) : [];
}

function shuffleChoices(question: Question): Question {
  const permutation = shuffle(question.choices.map((_, index) => index));
  return {
    ...question,
    choices: permutation.map((index) => question.choices[index]),
    correctIndex: permutation.indexOf(question.correctIndex),
  };
}

/**
 * Returns the same standardized 30-question assessment on every attempt.
 * Only presentation order and answer-choice order change.
 */
export function buildQuiz(chapter: number): Question[] {
  const questions = getAssessmentQuestions(chapter);
  const valid =
    questions.length === 30 &&
    new Set(questions.map((q) => q.id)).size === 30 &&
    new Set(questions.map((q) => q.prompt.trim().toLowerCase())).size === 30 &&
    questions.every(
      (q) =>
        q.choices.length === 4 &&
        new Set(q.choices.map((choice) => choice.trim().toLowerCase())).size === 4 &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3 &&
        q.explanation.trim().length > 0,
    );

  if (!valid) return [];
  return shuffle(questions).map(shuffleChoices);
}
