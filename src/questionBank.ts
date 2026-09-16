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

export type ChapterBankMeta = {
  chapter: number;
  title: string;
  targetSize: number;
  topics: string[];
};

export const chapterBankMeta: ChapterBankMeta[] = [
  { chapter: 1, title: "Introduction to Flying", targetSize: 225, topics: ["FAA and regulation", "pilot certification", "flight training", "aeronautical publications", "aircraft classification"] },
  { chapter: 2, title: "Aeronautical Decision-Making", targetSize: 275, topics: ["ADM", "risk management", "hazardous attitudes", "PAVE/5P/3P", "human factors", "DECIDE"] },
  { chapter: 3, title: "Aircraft Construction", targetSize: 225, topics: ["airworthiness", "major components", "airframe structures", "wings and empennage", "materials and loads"] },
  { chapter: 4, title: "Principles of Flight", targetSize: 175, topics: ["atmosphere", "fluid behavior", "pressure", "airfoils", "Bernoulli/Newton", "center of pressure"] },
  { chapter: 5, title: "Aerodynamics of Flight", targetSize: 450, topics: ["four forces", "AOA and lift", "drag", "stalls", "load factor", "turns", "stability", "high-speed flight"] },
  { chapter: 6, title: "Flight Controls", targetSize: 200, topics: ["primary controls", "axes", "adverse yaw", "secondary controls", "trim", "control systems"] },
  { chapter: 7, title: "Aircraft Systems", targetSize: 400, topics: ["engines", "propellers", "induction", "ignition", "fuel", "lubrication/cooling", "electrical", "landing gear", "environmental"] },
  { chapter: 8, title: "Flight Instruments", targetSize: 325, topics: ["pitot-static", "altimeter", "airspeed", "VSI", "gyroscopic instruments", "compass", "glass cockpit"] },
  { chapter: 9, title: "Flight Manuals and Other Documents", targetSize: 225, topics: ["AFM/POH", "limitations", "required documents", "airworthiness", "maintenance", "inoperative equipment"] },
  { chapter: 10, title: "Weight and Balance", targetSize: 250, topics: ["weight effects", "CG", "arms/moments", "loading calculations", "graphs/tables", "adverse balance"] },
  { chapter: 11, title: "Aircraft Performance", targetSize: 325, topics: ["atmosphere", "pressure/density altitude", "takeoff/landing", "climb", "range/endurance", "performance charts"] },
  { chapter: 12, title: "Weather Theory", targetSize: 240, topics: ["atmosphere", "moisture", "stability", "clouds", "fog", "fronts", "thunderstorms", "icing"] },
  { chapter: 13, title: "Aviation Weather Services", targetSize: 240, topics: ["METAR/SPECI", "TAF", "PIREPs", "AIRMET/SIGMET", "data link weather", "weather charts"] },
  { chapter: 14, title: "Airport Operations", targetSize: 240, topics: ["traffic patterns", "runways", "markings", "signs", "lighting", "runway safety"] },
  { chapter: 15, title: "Airspace", targetSize: 240, topics: ["Class A-G", "VFR minimums", "special use airspace", "TFRs", "operating requirements"] },
  { chapter: 16, title: "Navigation", targetSize: 240, topics: ["pilotage", "dead reckoning", "charts", "flight planning", "VOR", "GPS", "wind correction"] },
  { chapter: 17, title: "Aeromedical Factors", targetSize: 240, topics: ["hypoxia", "hyperventilation", "spatial disorientation", "carbon monoxide", "IMSAFE", "fatigue", "scuba"] },
];

// Question banks are intentionally separate from the quiz engine. Large chapter banks can be
// generated/reviewed in machine-readable files without changing UI code.
const banks = import.meta.glob<Question[]>("./question-banks/chapter-*.json", { eager: true, import: "default" });

export function getChapterQuestions(chapter: number): Question[] {
  const key = Object.keys(banks).find((path) => path.endsWith(`chapter-${String(chapter).padStart(2, "0")}.json`));
  return key ? banks[key] : [];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildQuiz(chapter: number, count = 20, excludeIds: string[] = []): Question[] {
  const fullBank = getChapterQuestions(chapter);
  if (fullBank.length <= count) return shuffle(fullBank);

  // Prefer questions the student has not seen recently. If the exclusion list is too
  // large, automatically fall back to the full bank so unlimited practice always works.
  const excluded = new Set(excludeIds);
  const unseen = fullBank.filter((q) => !excluded.has(q.id));
  const bank = unseen.length >= count ? unseen : fullBank;

  // Coverage-first + family-aware selection. First choose across topics while avoiding
  // duplicate question families, then fill remaining slots from the shuffled bank.
  const shuffled = shuffle(bank);
  const byTopic = new Map<string, Question[]>();
  shuffled.forEach((q) => byTopic.set(q.topic, [...(byTopic.get(q.topic) || []), q]));
  const topics = shuffle([...byTopic.keys()]);
  const selected: Question[] = [];
  const usedIds = new Set<string>();
  const usedFamilies = new Set<string>();
  let safety = 0;
  while (selected.length < count && topics.length && safety++ < 5000) {
    const topic = topics[safety % topics.length];
    const bucket = byTopic.get(topic)!;
    const idx = bucket.findIndex((q) => !usedFamilies.has(q.family));
    const next = idx >= 0 ? bucket.splice(idx, 1)[0] : bucket.shift();
    if (next && !usedIds.has(next.id)) {
      selected.push(next); usedIds.add(next.id); usedFamilies.add(next.family);
    }
    if (!bucket.length) topics.splice(topics.indexOf(topic), 1);
  }
  for (const q of shuffled) {
    if (selected.length >= count) break;
    if (!usedIds.has(q.id)) { selected.push(q); usedIds.add(q.id); }
  }
  return shuffle(selected.slice(0, count));
}
