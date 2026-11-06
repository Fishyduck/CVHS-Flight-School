import { useState } from "react";
import { NotebookPen } from "lucide-react";

// Mount with an owner/module key so notes never carry over between students.
export default function StudyNotes({ owner, moduleId }: { owner: string; moduleId: number }) {
  const storageKey = `cvhs-flight-school-notes-${owner}-${moduleId}-v1`;
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? ""; }
    catch { return ""; }
  });
  const [message, setMessage] = useState("Notes are stored only in this browser, separately for each account.");

  function updateNotes(value: string) {
    setNotes(value);
    try {
      localStorage.setItem(storageKey, value);
      setMessage("Saved in this browser. Notes do not sync between devices.");
    } catch {
      setMessage("Could not save. Copy your notes before closing this lesson.");
    }
  }

  return (
    <details className="study-notes">
      <summary><NotebookPen aria-hidden="true" /> My study notes <span>Saved on this device</span></summary>
      <label htmlFor="study-notes">Key ideas and questions for the next club meeting</label>
      <textarea id="study-notes" rows={4} value={notes} maxLength={20000} onChange={(event) => updateNotes(event.target.value)} placeholder="What stood out? What would you like to revisit?" aria-describedby="notes-status" />
      <p id="notes-status" role="status">{message}</p>
    </details>
  );
}
