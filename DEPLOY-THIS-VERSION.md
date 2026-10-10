# CVHS Flight School — deploy this source version

The live GitHub Pages website does NOT update when a ZIP is downloaded or extracted.

1. Extract this ZIP and copy the contents into the existing Git clone, preserving its `.git` folder.
2. Do not copy `.env.local`, `node_modules`, or `dist` to GitHub.
3. Run `npm install`, `npm run build`, then `git add .`, `git commit -m "Improve quiz answer-choice quality"`, and `git push origin main`.
4. In GitHub Actions, wait for the deploy workflow to succeed. Refresh the live page with Ctrl+Shift+R.
5. Verify Chapter 2 question CH02-V1-15 displays only Detect / Estimate / Choose / Identify (shuffled order).

This release improves answer-choice consistency, but heuristic checks do not prove the pedagogical validity of every distractor. See ASSESSMENT-AUDIT-ALL-510.csv for remaining flagged questions.
