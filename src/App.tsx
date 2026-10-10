import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  CircleUserRound,
  Clock3,
  LogOut,
  Menu,
  ShieldCheck,
  ExternalLink,
  FileText,
  Library,
  X,
  Plane, BrainCircuit, PanelsTopLeft, Wind, Waves, SlidersHorizontal, Cog, Gauge, Files, Scale, ChartNoAxesCombined, CloudSun, Radar, TowerControl, CircleDotDashed, Compass, HeartPulse,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { buildQuiz, type Question } from "./questionBank";
import { getReflection } from "./reflections";
import { getStoredAttempts, putStoredAttempt, putStoredAttempts, type StoredQuizAttempt } from "./storage";

const modules = [
  { id: 1, title: 'Introduction To Flying', icon: Plane, pdf: "https://www.faa.gov/sites/faa.gov/files/03_phak_ch1.pdf" },
  { id: 2, title: 'Aeronautical Decision-Making', icon: BrainCircuit, pdf: "https://www.faa.gov/sites/faa.gov/files/04_phak_ch2.pdf" },
  { id: 3, title: 'Aircraft Construction', icon: PanelsTopLeft, pdf: "https://www.faa.gov/sites/faa.gov/files/05_phak_ch3_0.pdf" },
  { id: 4, title: 'Principles of Flight', icon: Wind, pdf: "https://www.faa.gov/sites/faa.gov/files/06_phak_ch4_0.pdf" },
  { id: 5, title: 'Aerodynamics of Flight', icon: Waves, pdf: "https://www.faa.gov/sites/faa.gov/files/07_phak_ch5_0.pdf" },
  { id: 6, title: 'Flight Controls', icon: SlidersHorizontal, pdf: "https://www.faa.gov/sites/faa.gov/files/08_phak_ch6.pdf" },
  { id: 7, title: 'Aircraft Systems', icon: Cog, pdf: "https://www.faa.gov/sites/faa.gov/files/09_phak_ch7.pdf" },
  { id: 8, title: 'Flight Instruments', icon: Gauge, pdf: "https://www.faa.gov/sites/faa.gov/files/10_phak_ch8.pdf" },
  { id: 9, title: 'Flight Manuals and Other Documents', icon: Files, pdf: "https://www.faa.gov/sites/faa.gov/files/11_phak_ch9.pdf" },
  { id: 10, title: 'Weight and Balance', icon: Scale, pdf: "https://www.faa.gov/sites/faa.gov/files/12_phak_ch10.pdf" },
  { id: 11, title: 'Aircraft Performance', icon: ChartNoAxesCombined, pdf: "https://www.faa.gov/sites/faa.gov/files/13_phak_ch11.pdf" },
  { id: 12, title: 'Weather Theory', icon: CloudSun, pdf: "https://www.faa.gov/sites/faa.gov/files/14_phak_ch12.pdf" },
  { id: 13, title: 'Aviation Weather Services', icon: Radar, pdf: "https://www.faa.gov/sites/faa.gov/files/15_phak_ch13.pdf" },
  { id: 14, title: 'Airport Operations', icon: TowerControl, pdf: "https://www.faa.gov/sites/faa.gov/files/16_phak_ch14.pdf" },
  { id: 15, title: 'Airspace', icon: CircleDotDashed, pdf: "https://www.faa.gov/sites/faa.gov/files/17_phak_ch15.pdf" },
  { id: 16, title: 'Navigation', icon: Compass, pdf: "https://www.faa.gov/sites/faa.gov/files/18_phak_ch16.pdf" },
  { id: 17, title: 'Aeromedical Factors', icon: HeartPulse, pdf: "https://www.faa.gov/sites/faa.gov/files/19_phak_ch17.pdf" }
];

const GUEST_OWNER = "guest";
const LEGACY_GUEST_PROGRESS_KEY = "cvhs-flight-school-progress";
const progressStorageKey = (owner: string) => `cvhs-flight-school-progress-${owner}-v2`;
const draftStorageKey = (owner: string, moduleId: number) => `cvhs-flight-school-quiz-draft-${owner}-${moduleId}-v2`;

type AuthMode = "login" | "signup" | "reset" | "new-password";

interface QuizAttempt extends StoredQuizAttempt {
  responses?: { question: Question; selectedIndex: number }[];
}

type QuizDraft = {
  moduleId: number;
  questions: Question[];
  answers: Record<number, number>;
  index: number;
  reflectionAnswer?: string;
  updatedAt: string;
};

function normalizeProgress(value: unknown): Record<number, number> {
  if (Array.isArray(value)) return Object.fromEntries(value.map((id) => [Number(id), 100]));
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([id]) => Number(id) >= 1 && Number(id) <= 17)
      .map(([id, status]) => [Number(id), Number(status) === 100 ? 100 : 0]),
  );
}

function mergeProgress(...sources: Record<number, number>[]): Record<number, number> {
  const merged: Record<number, number> = {};
  for (let id = 1; id <= 17; id += 1) {
    if (sources.some((source) => Number(source[id]) === 100)) merged[id] = 100;
  }
  return merged;
}

function readProgress(owner: string): Record<number, number> {
  try {
    const direct = localStorage.getItem(progressStorageKey(owner));
    if (direct) return normalizeProgress(JSON.parse(direct));
    if (owner === GUEST_OWNER) {
      const legacy = localStorage.getItem(LEGACY_GUEST_PROGRESS_KEY);
      if (legacy) {
        const migrated = normalizeProgress(JSON.parse(legacy));
        localStorage.setItem(progressStorageKey(owner), JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch { /* ignore corrupt local data */ }
  return {};
}

function writeProgress(owner: string, progress: Record<number, number>) {
  localStorage.setItem(progressStorageKey(owner), JSON.stringify(normalizeProgress(progress)));
}

function mergeAttempts(local: QuizAttempt[], cloud: QuizAttempt[]): QuizAttempt[] {
  const byKey = new Map<string, QuizAttempt>();
  for (const attempt of [...cloud, ...local]) {
    const key = attempt.attempt_uuid || `legacy-${attempt.id ?? "unknown"}-${attempt.module_id}-${attempt.attempted_at}`;
    const prior = byKey.get(key);
    byKey.set(key, prior ? { ...prior, ...attempt, sync_pending: attempt.sync_pending ?? prior.sync_pending } : attempt);
  }
  return [...byKey.values()].sort((a, b) => b.attempted_at.localeCompare(a.attempted_at));
}


function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [moduleProgress, setModuleProgress] = useState<Record<number, number>>(() => readProgress(GUEST_OWNER));
  const [quizModule, setQuizModule] = useState<(typeof modules)[number] | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizOwner, setQuizOwner] = useState(GUEST_OWNER);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [reflectionAnswer, setReflectionAnswer] = useState("");
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [lastCompletedAttempt, setLastCompletedAttempt] = useState<QuizAttempt | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeModule, setActiveModule] = useState<(typeof modules)[number] | null>(null);

  const currentOwner = session?.user.id ?? GUEST_OWNER;
  const progress = useMemo(
    () => Math.round(modules.reduce((sum, module) => sum + (moduleProgress[module.id] || 0), 0) / modules.length),
    [moduleProgress],
  );

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("new-password");
        setAuthOpen(true);
        setAuthMessage("Enter a new password for your account.");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const owner = session?.user.id ?? GUEST_OWNER;
    let cancelled = false;
    let syncInFlight = false;

    setModuleProgress(readProgress(owner));
    void getStoredAttempts<QuizAttempt>(owner).then((attempts) => {
      if (!cancelled) setQuizAttempts(attempts);
    });

    if (!session || !supabase) {
      return () => { cancelled = true; };
    }

    const syncUserData = async () => {
      if (syncInFlight) return;
      syncInFlight = true;
      try {
        const latestLocalProgress = readProgress(owner);
        const { data: cloudProgress, error: progressReadError } = await supabase!
          .from("student_progress")
          .select("module_progress, completed_modules")
          .eq("user_id", owner)
          .maybeSingle();

        let mergedProgress = readProgress(owner);
        if (!progressReadError) {
          mergedProgress = mergeProgress(
            readProgress(owner),
            normalizeProgress(cloudProgress?.module_progress),
            normalizeProgress(cloudProgress?.completed_modules),
          );
          writeProgress(owner, mergedProgress);
          await supabase!.from("student_progress").upsert(
            {
              user_id: owner,
              module_progress: mergedProgress,
              completed_modules: Object.keys(mergedProgress).map(Number).sort((a, b) => a - b),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        }
        if (!cancelled) setModuleProgress(mergedProgress);

        let latestLocalAttempts = await getStoredAttempts<QuizAttempt>(owner);
        const pending = latestLocalAttempts.filter(
          (attempt) => attempt.sync_pending && attempt.attempt_uuid && attempt.responses?.length,
        );
        for (const attempt of pending) {
          const { sync_pending: _syncPending, id: _id, ...payload } = attempt;
          const { error } = await supabase!.from("quiz_attempts").upsert(
            { ...payload, user_id: owner },
            { onConflict: "attempt_uuid" },
          );
          if (!error) {
            const synced = { ...attempt, sync_pending: false };
            await putStoredAttempt(owner, synced);
            latestLocalAttempts = latestLocalAttempts.map((item) =>
              item.attempt_uuid === attempt.attempt_uuid ? synced : item,
            );
          }
        }

        const cloudAttempts: QuizAttempt[] = [];
        let attemptsError: unknown = null;
        const pageSize = 500;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase!
            .from("quiz_attempts")
            .select("*")
            .eq("user_id", owner)
            .order("attempted_at", { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) { attemptsError = error; break; }
          const page = (data || []) as QuizAttempt[];
          cloudAttempts.push(...page.map((attempt) => ({ ...attempt, sync_pending: false })));
          if (page.length < pageSize) break;
        }

        if (!attemptsError) {
          const merged = mergeAttempts(latestLocalAttempts, cloudAttempts);
          await putStoredAttempts(owner, merged);
          if (!cancelled) setQuizAttempts(merged);
        } else if (!cancelled) {
          setQuizAttempts(latestLocalAttempts);
        }
      } catch (error) {
        // Network outages must not interrupt local quizzes or discard pending attempts.
        console.warn("Account synchronization will retry when connectivity returns.", error);
      } finally {
        syncInFlight = false;
      }
    };

    void syncUserData();
    const handleOnline = () => void syncUserData();
    const retryTimer = window.setInterval(() => void syncUserData(), 60_000);
    window.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [session]);

  async function saveProgressForOwner(owner: string, nextProgress: Record<number, number>) {
    const merged = mergeProgress(readProgress(owner), nextProgress);
    writeProgress(owner, merged);
    if (owner === currentOwner) setModuleProgress(merged);

    if (owner !== GUEST_OWNER && session?.user.id === owner && supabase) {
      await supabase.from("student_progress").upsert(
        {
          user_id: owner,
          module_progress: merged,
          completed_modules: Object.keys(merged).map(Number).sort((a, b) => a - b),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
  }

  function validDraftQuestions(questions: Question[], moduleId: number) {
    return questions.length === 30 &&
      new Set(questions.map((question) => question.id)).size === 30 &&
      questions.every((question) => question.chapter === moduleId && question.choices.length === 4 && question.correctIndex >= 0 && question.correctIndex <= 3);
  }

  function startQuiz(module: (typeof modules)[number]) {
    const owner = currentOwner;
    try {
      const raw = localStorage.getItem(draftStorageKey(owner, module.id));
      if (raw) {
        const draft = JSON.parse(raw) as QuizDraft;
        if (draft.moduleId === module.id && validDraftQuestions(draft.questions || [], module.id)) {
          setQuizOwner(owner);
          setQuizQuestions(draft.questions);
          setQuizIndex(Math.min(Math.max(draft.index || 0, 0), draft.questions.length));
          setQuizAnswers(draft.answers || {});
          setQuizFinished(false);
          setReflectionAnswer(draft.reflectionAnswer || "");
          setLastCompletedAttempt(null);
          setQuizModule(module);
          return;
        }
      }
    } catch { /* invalid draft: start fresh */ }
    startFreshQuiz(module, owner);
  }

  function startFreshQuiz(module: (typeof modules)[number], owner = currentOwner) {
    const questions = buildQuiz(module.id);
    localStorage.removeItem(draftStorageKey(owner, module.id));
    setQuizOwner(owner);
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizFinished(false);
    setQuizSubmitting(false);
    setReflectionAnswer("");
    setLastCompletedAttempt(null);
    setQuizModule(module);
  }

  async function finishQuiz() {
    if (quizSubmitting || !quizModule || quizQuestions.length !== 30 || !reflectionAnswer.trim()) return;
    if (quizQuestions.some((_, index) => quizAnswers[index] === undefined)) return;
    setQuizSubmitting(true);
    const correct = quizQuestions.reduce((sum, question, index) => sum + (quizAnswers[index] === question.correctIndex ? 1 : 0), 0);
    const score = Math.round((correct / quizQuestions.length) * 100);
    const passed = score >= 70;
    const reflection = getReflection(quizModule.id);
    const attempt: QuizAttempt = {
      attempt_uuid: crypto.randomUUID(),
      module_id: quizModule.id,
      score,
      passed,
      question_count: quizQuestions.length,
      attempted_at: new Date().toISOString(),
      quiz_version: "cvhs-standardized-v1",
      responses: quizQuestions.map((question, index) => ({ question, selectedIndex: quizAnswers[index] })),
      reflection_prompt: reflection.prompt,
      reflection_answer: reflectionAnswer.trim(),
      reflection_model: reflection.model,
      sync_pending: quizOwner !== GUEST_OWNER,
    };

    localStorage.removeItem(draftStorageKey(quizOwner, quizModule.id));
    const previousAttempts = await getStoredAttempts<QuizAttempt>(quizOwner);
    const ownerAttempts = [attempt, ...previousAttempts.filter((item) => item.attempt_uuid !== attempt.attempt_uuid)];
    await putStoredAttempt(quizOwner, attempt);
    if (quizOwner === currentOwner) setQuizAttempts(ownerAttempts);
    setLastCompletedAttempt(attempt);
    setQuizFinished(true);
    setQuizSubmitting(false);

    if (passed) void saveProgressForOwner(quizOwner, { [quizModule.id]: 100 });

    if (quizOwner !== GUEST_OWNER && session?.user.id === quizOwner && supabase) {
      const { sync_pending: _syncPending, id: _id, ...payload } = attempt;
      void supabase.from("quiz_attempts").upsert(
        { ...payload, user_id: quizOwner },
        { onConflict: "attempt_uuid" },
      ).then(({ error }) => {
        if (error) return;
        void getStoredAttempts<QuizAttempt>(quizOwner).then(async (stored) => {
          const updatedAttempt = { ...attempt, sync_pending: false };
          await putStoredAttempt(quizOwner, updatedAttempt);
          const updated = stored.map((item) =>
            item.attempt_uuid === attempt.attempt_uuid ? updatedAttempt : item,
          );
          if (quizOwner === currentOwner) setQuizAttempts(updated);
          setLastCompletedAttempt((last) => last && last.attempt_uuid === attempt.attempt_uuid ? { ...last, sync_pending: false } : last);
        });
      });
    }
  }

  function retakeQuiz() {
    if (!quizModule) return;
    startFreshQuiz(quizModule, quizOwner);
  }

  useEffect(() => {
    if (!quizModule || quizFinished || !quizQuestions.length) return;
    const draft: QuizDraft = {
      moduleId: quizModule.id,
      questions: quizQuestions,
      answers: quizAnswers,
      index: quizIndex,
      reflectionAnswer,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftStorageKey(quizOwner, quizModule.id), JSON.stringify(draft));
  }, [quizModule, quizQuestions, quizAnswers, quizIndex, quizFinished, reflectionAnswer, quizOwner]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthMessage("");
    if (!supabase) {
      setAuthMessage("Connect Supabase to activate student accounts.");
      return;
    }
    setAuthBusy(true);
    if (authMode === "reset") {
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      setAuthBusy(false);
      setAuthMessage(error ? error.message : "Password reset email sent. Check your inbox.");
      return;
    }
    if (authMode === "new-password") {
      const { error } = await supabase.auth.updateUser({ password });
      setAuthBusy(false);
      if (error) setAuthMessage(error.message);
      else { setAuthMessage("Password updated. You are signed in."); setTimeout(() => setAuthOpen(false), 900); }
      return;
    }
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (result.error) { setAuthMessage(result.error.message); return; }
    if (authMode === "signup" && !result.data.session) {
      setAuthMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    setAuthOpen(false); setEmail(""); setPassword("");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
  }


  const brandAsset = (file: string) => `${import.meta.env.BASE_URL}brand/${file}`;

  const Sidebar = () => (
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="CVHS Flight School home">
        <img className="sidebar-logo" src={brandAsset("cvhs-wordmark-reverse-transparent-cropped.png")} alt="CVHS Flight School" />
      </a>
      <nav aria-label="Primary navigation">
        <a className="active" href="#modules" onClick={() => setMobileOpen(false)}>
          <BookOpen /> Course modules
        </a>
        <a href="#resources" onClick={() => setMobileOpen(false)}>
          <Library /> Important resources
        </a>
      </nav>
      <div className="source-note">
        <ShieldCheck />
        <p><strong>FAA-based curriculum</strong><span>FAA-H-8083-25C</span></p>
      </div>
    </aside>
  );

  return (
    <div className="app" id="top">
      <div className={`mobile-panel ${mobileOpen ? "open" : ""}`}>
        <button className="icon-button panel-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button>
        <Sidebar />
      </div>
      {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className="desktop-sidebar"><Sidebar /></div>

      <main>
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button>
          <a className="mobile-wordmark" href="#top" aria-label="CVHS Flight School home"><img src={brandAsset("cvhs-wordmark-transparent-cropped.png")} alt="CVHS Flight School" /></a>
          <div className="route"><span>TRAINING PORTAL</span><b>GROUND SCHOOL</b></div>
          <div className="account-area">
            {session ? (
              <>
                <div className="student-id"><CircleUserRound /><span><b>Student account</b><small>{session.user.email}</small></span></div>
                <button className="button subtle" onClick={() => void signOut()}><LogOut /> Sign out</button>
              </>
            ) : (
              <button className="button primary" onClick={() => setAuthOpen(true)}><CircleUserRound /> Log in / Sign up</button>
            )}
          </div>
        </header>

        <div className="page">
          <section className="course-header" aria-labelledby="course-title">
            <div>
              <p className="eyebrow">PRIVATE PILOT FOUNDATIONS</p>
              <h1 id="course-title">Ground School</h1>
              <p>Seventeen modules aligned to the chapters of the FAA Pilot’s Handbook of Aeronautical Knowledge.</p>
            </div>
            <div className="progress-card" aria-label={`${progress}% complete`}>
              <div><span>COURSE PROGRESS</span><b>{progress}%</b></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              <p>Modules are complete after a quiz score of 70% or higher.</p>
              {!session && <small>Progress is saved on this device. Sign in to sync it to your account.</small>}
            </div>
          </section>

          <section id="modules" className="modules-section" aria-labelledby="modules-title">
            <div className="section-heading">
              <div><p className="eyebrow">FAA-H-8083-25C</p><h2 id="modules-title">Course modules</h2></div>
              <span>17 CHAPTERS</span>
            </div>
            <div className="module-grid">
              {modules.map((module) => {
                const percent = moduleProgress[module.id] || 0;
                const done = percent === 100;
                const moduleAttempts = quizAttempts.filter((attempt) => attempt.module_id === module.id);
                const bestScore = moduleAttempts.length ? Math.max(...moduleAttempts.map((attempt) => attempt.score)) : null;
                return (
                  <article className={`module-card ${done ? "complete" : ""}`} key={module.id}>
                    <div className="module-top"><span>MODULE {String(module.id).padStart(2, "0")}</span><b className={`status-badge ${done ? "done" : "pending"}`}>{done ? "COMPLETE" : "NOT COMPLETE"}</b></div>
                    <div className="module-title-row"><span className={`module-icon module-icon-${((module.id - 1) % 4) + 1}`}><module.icon /></span><h3>{module.title}</h3></div>
                    <p>Chapter {module.id}</p>
                    <div className="module-actions">
                      <button className="open-button" onClick={() => setActiveModule(module)}>
                        {done ? "Review module" : "Open module"} <ArrowRight />
                      </button>
                      <button className="practice-quiz-button" onClick={() => startQuiz(module)}>{moduleAttempts.length ? "Take another quiz" : "Take module quiz"}</button>
                      {moduleAttempts.length > 0 && <details className="score-log"><summary>QUIZ HISTORY · {moduleAttempts.length} {moduleAttempts.length === 1 ? "ATTEMPT" : "ATTEMPTS"} · BEST {bestScore}%</summary>{moduleAttempts.map((attempt, i) => <button key={attempt.attempt_uuid || i} className="history-attempt-button" onClick={() => setReviewAttempt(attempt)}><b>{attempt.score}%</b><span>{attempt.passed ? "Passed" : "Not passed"} · {new Date(attempt.attempted_at).toLocaleString()}</span><em>Review</em></button>)}</details>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="resources" className="resources-section" aria-labelledby="resources-title">
            <div className="section-heading"><div><p className="eyebrow">REFERENCE LIBRARY</p><h2 id="resources-title">Important resources</h2></div><span>OFFICIAL FAA</span></div>
            <article className="resource-card">
              <FileText />
              <div><span>FAA-H-8083-25C</span><h3>Pilot’s Handbook of Aeronautical Knowledge</h3><p>The complete FAA textbook used across all 17 course modules.</p></div>
              <a className="button primary" href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf" target="_blank" rel="noreferrer">Open textbook <ExternalLink /></a>
            </article>
            <article className="resource-card"><FileText /><div><span>FAA REFERENCE</span><h3>Aeronautical Information Manual (AIM)</h3><p>Official basic flight information and ATC procedures.</p></div><a className="button subtle" href="https://www.faa.gov/air_traffic/publications/atpubs/aim_html/" target="_blank" rel="noreferrer">Open AIM <ExternalLink /></a></article>
            <article className="resource-card"><FileText /><div><span>PRIVATE PILOT STANDARD</span><h3>Airman Certification Standards (ACS)</h3><p>The FAA knowledge, risk-management, and skill standards for pilot certification.</p></div><a className="button subtle" href="https://www.faa.gov/training_testing/testing/acs" target="_blank" rel="noreferrer">Open ACS <ExternalLink /></a></article>
            <article className="resource-card"><FileText /><div><span>FAA FLIGHT TRAINING</span><h3>Airplane Flying Handbook</h3><p>FAA guidance for flight training, maneuvers, takeoffs, landings, and emergencies.</p></div><a className="button subtle" href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook" target="_blank" rel="noreferrer">Open handbook <ExternalLink /></a></article>
            <article className="resource-card"><FileText /><div><span>FAA WEATHER</span><h3>Aviation Weather Handbook</h3><p>Weather theory, hazards, products, and aviation weather decision-making.</p></div><a className="button subtle" href="https://www.faa.gov/regulationspolicies/handbooksmanuals/aviation/faa-h-8083-28b-aviation-weather-handbook" target="_blank" rel="noreferrer">Open weather handbook <ExternalLink /></a></article>
            <article className="resource-card"><FileText /><div><span>FAA CHARTS</span><h3>Aeronautical Chart Users' Guide</h3><p>Current chart symbols, terminology, and examples for VFR and IFR charts.</p></div><a className="button subtle" href="https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/aero_guide/" target="_blank" rel="noreferrer">Open chart guide <ExternalLink /></a></article>
          </section>
        </div>

        <footer>
          <div className="footer-brand"><img src={brandAsset("cvhs-secondary-seal.png")} alt="CVHS Flight School seal" /><b>CVHS FLIGHT SCHOOL</b></div>
          <p>Educational material does not replace instruction from an authorized instructor, current FAA publications, or aircraft-specific documentation.</p>
        </footer>
      </main>

      {activeModule && (
        <div className="modal-backdrop module-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveModule(null)}>
          <section className="module-modal" role="dialog" aria-modal="true" aria-labelledby="module-title">
            <div className="module-modal-head"><div><p className="eyebrow">MODULE {String(activeModule.id).padStart(2, "0")} · FAA COURSE READING</p><h2 id="module-title">{activeModule.title}</h2></div><button className="icon-button" aria-label="Close module" onClick={() => setActiveModule(null)}><X /></button></div>
            <div className="module-toolbar"><span>Chapter {activeModule.id} · FAA-H-8083-25C</span><a href={activeModule.pdf} target="_blank" rel="noreferrer">Open PDF in new tab <ExternalLink /></a></div>
            <iframe className="pdf-frame" src={`${activeModule.pdf}#view=FitH`} title={`FAA Chapter ${activeModule.id}: ${activeModule.title}`} />
            <div className="mobile-pdf-reader" role="region" aria-label="Mobile chapter reader">
              <BookOpen />
              <h3>Read Chapter {activeModule.id}</h3>
              <p>For reliable multi-page reading on phones and tablets, open the FAA chapter in your device's PDF viewer. You can swipe or scroll through every page, then return here for the quiz.</p>
              <a className="button primary mobile-pdf-button" href={activeModule.pdf} target="_blank" rel="noreferrer">Open full chapter PDF <ExternalLink /></a>
              <small>The chapter opens in a new tab so your place in CVHS Flight School stays available.</small>
            </div>
            <div className="module-modal-foot"><div><p>Reading does not change completion status. Score 70% or higher on this module's quiz to mark it complete. Quizzes can be retaken anytime.</p></div><button className="button primary" onClick={() => { startQuiz(activeModule); setActiveModule(null); }}>Next: Module quiz <ArrowRight /></button></div>
          </section>
        </div>
      )}


      {quizModule && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setQuizModule(null)}>
          <section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
            <button className="icon-button modal-close" aria-label="Close quiz" onClick={() => setQuizModule(null)}><X /></button>
            <p className="eyebrow">MODULE {String(quizModule.id).padStart(2, "0")} · KNOWLEDGE CHECK</p>
            <h2 id="quiz-title">{quizModule.title} Quiz</h2>
            {quizQuestions.length === 0 ? (
              <>
                <div className="quiz-status"><span>30-QUESTION ASSESSMENT</span><b>Assessment unavailable</b></div>
                <div className="quiz-question"><span>VALIDATION ERROR</span><h3>This standardized assessment could not be loaded safely.</h3><p>The quiz is disabled because its 30-question assessment file failed a structural validation check. Reload the site or contact the club administrator.</p></div>
                <div className="quiz-footer"><button className="button subtle" onClick={() => { setQuizModule(null); setActiveModule(quizModule); }}>Back to module</button></div>
              </>
            ) : quizFinished ? (() => {
              const correct = quizQuestions.reduce((sum, q, index) => sum + (quizAnswers[index] === q.correctIndex ? 1 : 0), 0);
              const score = Math.round((correct / quizQuestions.length) * 100);
              const passed = score >= 70;
              return <>
                <div className="quiz-status"><span>ATTEMPT COMPLETE</span><b>{score}% · {passed ? "PASS" : "KEEP PRACTICING"}</b></div>
                <div className="quiz-question"><span>{correct} OF {quizQuestions.length} CORRECT</span><h3>{passed ? "Module complete — keep testing your knowledge anytime." : "Review the module or retry the same assessment in a new order."}</h3><p>{passed ? "Your first passing score marks this module complete. Future attempts remain available and are saved in your quiz history." : "A 70% score is required for module completion. There is no limit on quiz attempts."}</p></div>
                <div className="quiz-question reflection-result"><span>EXPLAIN YOUR THINKING · UNSCORED</span><h3>Model answer</h3><p><strong>Your response:</strong> {lastCompletedAttempt?.reflection_answer}</p><p><strong>Model answer:</strong> {lastCompletedAttempt?.reflection_model}</p></div>
                <div className="quiz-footer"><button className="button subtle" disabled={!lastCompletedAttempt} onClick={() => { if (lastCompletedAttempt) setReviewAttempt(lastCompletedAttempt); setQuizModule(null); }}>Review all answers</button><button className="button primary" onClick={retakeQuiz}>New attempt</button></div>
              </>;
            })() : (() => {
              const isReflection = quizIndex === quizQuestions.length;
              const q = quizQuestions[quizIndex];
              const chosen = quizAnswers[quizIndex];
              const answered = chosen !== undefined;
              return <>
                <div className="quiz-status"><span>{isReflection ? "UNSCORED REFLECTION · AUTO-SAVED" : `QUESTION ${quizIndex + 1} OF ${quizQuestions.length} · AUTO-SAVED`}</span><b>{isReflection ? "Explain your thinking" : `${q.topic} · ${q.difficulty.toUpperCase()}`}</b></div>
                {isReflection ? <div className="quiz-question"><h3>{getReflection(quizModule.id).prompt}</h3><textarea style={{width:"100%",minHeight:180,padding:14}} value={reflectionAnswer} onChange={e => setReflectionAnswer(e.target.value)} placeholder="Explain your reasoning here (not graded)" /><p>This response is saved with your attempt and is not graded. The model answer appears after submission.</p></div> : <div className="quiz-question"><span>{q.type.toUpperCase()}</span><h3>{q.prompt}</h3>
                  <div className="quiz-choices">{q.choices.map((choice, index) => <button key={index} className={`quiz-choice ${chosen === index ? "selected" : ""}`} onClick={() => setQuizAnswers({ ...quizAnswers, [quizIndex]: index })}><b>{String.fromCharCode(65 + index)}</b><span>{choice}</span></button>)}</div>
                  {answered && <div className="quiz-source">Reference: {q.sourcePage}{q.figureReference ? ` · ${q.figureReference}` : ""}</div>}
                </div>}
                <div className="quiz-footer"><button className="button subtle" disabled={quizIndex === 0} onClick={() => setQuizIndex(quizIndex - 1)}>Previous</button>{quizIndex < quizQuestions.length ? <button className="button primary" disabled={!answered} onClick={() => setQuizIndex(quizIndex + 1)}>{quizIndex === quizQuestions.length - 1 ? "Continue to reflection" : "Next question"} <ArrowRight /></button> : <button className="button primary" disabled={!reflectionAnswer.trim() || quizSubmitting} onClick={() => void finishQuiz()}>{quizSubmitting ? "Saving attempt..." : "Submit quiz and reflection"}</button>}</div>
              </>;
            })()}
          </section>
        </div>
      )}

      {reviewAttempt && <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && setReviewAttempt(null)}>
        <section className="quiz-modal" role="dialog" aria-modal="true" aria-label="Quiz attempt review" style={{overflowY:"auto",maxHeight:"90vh"}}>
          <button className="icon-button modal-close" onClick={() => setReviewAttempt(null)} aria-label="Close review"><X /></button>
          <h2>Attempt review · {reviewAttempt.score}%</h2>
          <p>{new Date(reviewAttempt.attempted_at).toLocaleString()} · {reviewAttempt.passed ? "Passed" : "Not passed"} · {reviewAttempt.quiz_version}</p>
          {reviewAttempt.responses?.length ? reviewAttempt.responses.map((r,i) => <div className="quiz-question" key={i} style={{marginBottom:16}}>
            <span>QUESTION {i+1} · {r.selectedIndex === r.question.correctIndex ? "CORRECT" : "INCORRECT"}</span>
            <h3>{r.question.prompt}</h3>
            <p><strong>Your answer:</strong> {r.question.choices[r.selectedIndex] || "No answer"}</p>
            <p><strong>Correct answer:</strong> {r.question.choices[r.question.correctIndex]}</p>
            <p><strong>Explanation:</strong> {r.question.explanation}</p>
            <small>Reference: {r.question.sourcePage}</small>
          </div>) : <p>Detailed responses were not stored for this older attempt.</p>}
          <div className="quiz-question"><h3>Explain your thinking (ungraded)</h3><p>{reviewAttempt.reflection_prompt}</p><p><strong>Your response:</strong> {reviewAttempt.reflection_answer || "No response provided"}</p><h3>Model answer / rubric</h3><p>{reviewAttempt.reflection_model}</p></div>
          <div className="quiz-footer"><button className="button primary" onClick={() => setReviewAttempt(null)}>Close review</button></div>
        </section>
      </div>}

      {authOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="icon-button modal-close" aria-label="Close account window" onClick={() => setAuthOpen(false)}><X /></button>
            <span className="auth-icon brand-auth-icon"><img src={brandAsset("cvhs-brand-mark.png")} alt="" /></span>
            <p className="eyebrow">STUDENT ACCOUNT</p>
            <h2 id="auth-title">{authMode === "login" ? "Welcome back" : authMode === "signup" ? "Create your account" : authMode === "reset" ? "Reset your password" : "Choose a new password"}</h2>
            <p className="modal-copy">{authMode === "reset" ? "We’ll email you a secure password-reset link." : authMode === "new-password" ? "Enter the new password you want to use." : "Save your course progress and continue on any device."}</p>
            {authMode !== "new-password" && <div className="auth-tabs" role="tablist">
              <button className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>Log in</button>
              <button className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>Sign up</button>
            </div>}
            <form onSubmit={submitAuth}>
              {authMode !== "new-password" && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
              {authMode !== "reset" && <label>{authMode === "new-password" ? "New password" : "Password"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>}
              {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
              <button className="button primary wide" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "login" ? "Log in" : authMode === "signup" ? "Create account" : authMode === "reset" ? "Send reset email" : "Update password"}</button>
              {authMode === "login" && <button type="button" className="text-button" onClick={() => { setAuthMode("reset"); setAuthMessage(""); }}>Forgot password?</button>}
              {authMode === "reset" && <button type="button" className="text-button" onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>Back to log in</button>}
            </form>
            {!isSupabaseConfigured && <p className="setup-note"><Clock3 /> Account setup is ready; add the free Supabase keys to activate it.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
