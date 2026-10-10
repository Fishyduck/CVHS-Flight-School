import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assessmentDir = path.join(root, 'src', 'assessments');
const expectedFiles = Array.from({ length: 17 }, (_, i) => `chapter-${String(i + 1).padStart(2, '0')}.json`);
const actualFiles = fs.readdirSync(assessmentDir).filter((name) => /^chapter-\d\d\.json$/.test(name)).sort();
const errors = [];
const ids = new Set();
const prompts = new Set();
let total = 0;

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  errors.push(`Expected exactly 17 chapter files (${expectedFiles.join(', ')}), found: ${actualFiles.join(', ')}`);
}

for (const [offset, file] of expectedFiles.entries()) {
  const chapter = offset + 1;
  const fullPath = path.join(assessmentDir, file);
  if (!fs.existsSync(fullPath)) continue;
  const questions = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(questions)) {
    errors.push(`${file}: root must be an array.`);
    continue;
  }
  if (questions.length !== 30) errors.push(`${file}: expected 30 questions, found ${questions.length}.`);
  total += questions.length;

  for (const [index, q] of questions.entries()) {
    const where = `${file} Q${index + 1}`;
    if (q.chapter !== chapter) errors.push(`${where}: chapter field is ${q.chapter}, expected ${chapter}.`);
    if (typeof q.id !== 'string' || !q.id.trim()) errors.push(`${where}: missing id.`);
    else if (ids.has(q.id)) errors.push(`${where}: duplicate id ${q.id}.`);
    else ids.add(q.id);

    const normalizedPrompt = String(q.prompt || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalizedPrompt.length < 20) errors.push(`${where}: prompt is too short.`);
    if (prompts.has(normalizedPrompt)) errors.push(`${where}: duplicate prompt.`);
    prompts.add(normalizedPrompt);

    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      errors.push(`${where}: exactly four choices are required.`);
    } else {
      const normalizedChoices = q.choices.map((choice) => String(choice).trim().toLowerCase());
      if (normalizedChoices.some((choice) => !choice)) errors.push(`${where}: blank choice.`);
      if (new Set(normalizedChoices).size !== 4) errors.push(`${where}: choices must be unique.`);
      if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`${where}: invalid correctIndex.`);

      if (Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3) {
        const correctLength = q.choices[q.correctIndex].trim().length;
        const wrongLengths = q.choices.filter((_, i) => i !== q.correctIndex).map((choice) => choice.trim().length);
        const meanWrong = wrongLengths.reduce((a, b) => a + b, 0) / wrongLengths.length;
        // This catches answer-length giveaways. It is deliberately conservative; a few concise definition items can still pass.
        if (correctLength > 45 && meanWrong / correctLength < 0.55) {
          errors.push(`${where}: distractors are much shorter than the keyed answer (possible answer-length cue).`);
        }
      }
    }

    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 40) errors.push(`${where}: explanation is missing or too thin.`);
    if (typeof q.sourcePage !== 'string' || !q.sourcePage.includes(`Chapter ${chapter}`)) errors.push(`${where}: missing chapter source reference.`);
    if (typeof q.learningObjective !== 'string' || q.learningObjective.trim().length < 15) errors.push(`${where}: missing learning objective.`);
    if (typeof q.topic !== 'string' || !q.topic.trim()) errors.push(`${where}: missing topic.`);
    if (typeof q.subtopic !== 'string' || !q.subtopic.trim()) errors.push(`${where}: missing subtopic.`);
    if (String(q.prompt).includes('verify exact page') || String(q.sourcePage).includes('verify exact page')) errors.push(`${where}: placeholder source text remains.`);
  }
}

if (total !== 510) errors.push(`Expected 510 total questions, found ${total}.`);

const reflectionsPath = path.join(root, 'src', 'reflections.ts');
const reflectionsText = fs.readFileSync(reflectionsPath, 'utf8');
for (let chapter = 1; chapter <= 17; chapter += 1) {
  const pattern = new RegExp(`\\n\\s*${chapter}:\\s*\\{`);
  if (!pattern.test(reflectionsText)) errors.push(`reflections.ts: missing Chapter ${chapter} reflection.`);
}
if ((reflectionsText.match(/prompt:/g) || []).length < 17 || (reflectionsText.match(/model:/g) || []).length < 17) {
  errors.push('reflections.ts: expected at least 17 prompt/model pairs.');
}

if (errors.length) {
  console.error(`Assessment validation FAILED with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Assessment validation passed: 17 chapters, 510 unique questions, four choices each, 17 reflections.`);
