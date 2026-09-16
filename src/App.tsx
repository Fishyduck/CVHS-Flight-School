import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  CircleUserRound,
  Clock3,
  LogOut,
  Menu,
  Plane,
  ShieldCheck,
  ExternalLink,
  FileText,
  Library,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { buildQuiz, getChapterQuestions, type Question } from "./questionBank";

const modules = [
  { id: 1, title: 'Introduction To Flying', pdf: "https://www.faa.gov/sites/faa.gov/files/03_phak_ch1.pdf" },
  { id: 2, title: 'Aeronautical Decision-Making', pdf: "https://www.faa.gov/sites/faa.gov/files/04_phak_ch2.pdf" },
  { id: 3, title: 'Aircraft Construction', pdf: "https://www.faa.gov/sites/faa.gov/files/05_phak_ch3_0.pdf" },
  { id: 4, title: 'Principles of Flight', pdf: "https://www.faa.gov/sites/faa.gov/files/06_phak_ch4_0.pdf" },
  { id: 5, title: 'Aerodynamics of Flight', pdf: "https://www.faa.gov/sites/faa.gov/files/07_phak_ch5_0.pdf" },
  { id: 6, title: 'Flight Controls', pdf: "https://www.faa.gov/sites/faa.gov/files/08_phak_ch6.pdf" },
  { id: 7, title: 'Aircraft Systems', pdf: "https://www.faa.gov/sites/faa.gov/files/09_phak_ch7.pdf" },
  { id: 8, title: 'Flight Instruments', pdf: "https://www.faa.gov/sites/faa.gov/files/10_phak_ch8.pdf" },
  { id: 9, title: 'Flight Manuals and Other Documents', pdf: "https://www.faa.gov/sites/faa.gov/files/11_phak_ch9.pdf" },
  { id: 10, title: 'Weight and Balance', pdf: "https://www.faa.gov/sites/faa.gov/files/12_phak_ch10.pdf" },
  { id: 11, title: 'Aircraft Performance', pdf: "https://www.faa.gov/sites/faa.gov/files/13_phak_ch11.pdf" },
  { id: 12, title: 'Weather Theory', pdf: "https://www.faa.gov/sites/faa.gov/files/14_phak_ch12.pdf" },
  { id: 13, title: 'Aviation Weather Services', pdf: "https://www.faa.gov/sites/faa.gov/files/15_phak_ch13.pdf" },
  { id: 14, title: 'Airport Operations', pdf: "https://www.faa.gov/sites/faa.gov/files/16_phak_ch14.pdf" },
  { id: 15, title: 'Airspace', pdf: "https://www.faa.gov/sites/faa.gov/files/17_phak_ch15.pdf" },
  { id: 16, title: 'Navigation', pdf: "https://www.faa.gov/sites/faa.gov/files/18_phak_ch16.pdf" },
  { id: 17, title: 'Aeromedical Factors', pdf: "https://www.faa.gov/sites/faa.gov/files/19_phak_ch17.pdf" }
];

const guestStorageKey = "cvhs-flight-school-progress";

type AuthMode = "login" | "signup" | "reset" | "new-password";

type QuizAttempt = { id?: number; module_id: number; score: number; passed: boolean; question_count: number; attempted_at: string };
type QuizDraft = { moduleId: number; questionIds: string[]; answers: Record<number, number>; index: number; updatedAt: string };
const draftKey = (moduleId: number) => `cvhs-flight-school-quiz-draft-${moduleId}`;
const seenKey = (moduleId: number) => `cvhs-flight-school-seen-questions-${moduleId}`;

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [moduleProgress, setModuleProgress] = useState<Record<number, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(guestStorageKey) || "{}");
      if (Array.isArray(saved)) return Object.fromEntries(saved.map((id: number) => [id, 100]));
      return Object.fromEntries(Object.entries(saved).map(([id, value]) => [Number(id), Number(value) === 100 ? 100 : 0]));
    } catch {
      return {};
    }
  });
  const [quizModule, setQuizModule] = useState<(typeof modules)[number] | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeModule, setActiveModule] = useState<(typeof modules)[number] | null>(null);

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
    if (!session || !supabase) return;
    void supabase
      .from("student_progress")
      .select("module_progress")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.module_progress) {
          const normalized = Object.fromEntries(Object.entries(data.module_progress).map(([id, value]) => [Number(id), Number(value) === 100 ? 100 : 0]));
          setModuleProgress(normalized);
          if (JSON.stringify(normalized) !== JSON.stringify(data.module_progress)) void saveProgress(normalized);
        }
      });
  }, [session]);

  useEffect(() => {
    if (!session || !supabase) {
      try { setQuizAttempts(JSON.parse(localStorage.getItem("cvhs-flight-school-quiz-attempts") || "[]")); } catch { setQuizAttempts([]); }
      return;
    }
    void supabase.from("quiz_attempts").select("id,module_id,score,passed,question_count,attempted_at").eq("user_id", session.user.id).order("attempted_at", { ascending: false }).then(({ data }) => {
      if (data) setQuizAttempts(data as QuizAttempt[]);
    });
  }, [session]);

  async function saveProgress(nextProgress: Record<number, number>) {
    setModuleProgress(nextProgress);
    localStorage.setItem(guestStorageKey, JSON.stringify(nextProgress));
    if (session && supabase) {
      await supabase.from("student_progress").upsert(
        {
          user_id: session.user.id,
          module_progress: nextProgress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
  }


  function startQuiz(module: (typeof modules)[number]) {
    // Resume an unfinished attempt if one exists on this device.
    try {
      const raw = localStorage.getItem(draftKey(module.id));
      if (raw) {
        const draft = JSON.parse(raw) as QuizDraft;
        const bank = getChapterQuestions(module.id);
        const map = new Map(bank.map((q) => [q.id, q]));
        const restored = draft.questionIds.map((id) => map.get(id)).filter(Boolean) as Question[];
        if (restored.length === draft.questionIds.length && restored.length > 0) {
          setQuizQuestions(restored);
          setQuizIndex(Math.min(draft.index, restored.length - 1));
          setQuizAnswers(draft.answers || {});
          setQuizFinished(false);
          setQuizModule(module);
          return;
        }
      }
    } catch { /* invalid draft: start fresh */ }
    startFreshQuiz(module);
  }

  function startFreshQuiz(module: (typeof modules)[number]) {
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey(module.id)) || "[]"); } catch { seen = []; }
    const questions = buildQuiz(module.id, 20, seen.slice(-160));
    const nextSeen = [...seen, ...questions.map((q) => q.id)].slice(-200);
    localStorage.setItem(seenKey(module.id), JSON.stringify(nextSeen));
    localStorage.removeItem(draftKey(module.id));
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizFinished(false);
    setQuizModule(module);
  }

  async function finishQuiz() {
    if (!quizModule || !quizQuestions.length) return;
    const correct = quizQuestions.reduce((sum, q, index) => sum + (quizAnswers[index] === q.correctIndex ? 1 : 0), 0);
    const score = Math.round((correct / quizQuestions.length) * 100);
    const passed = score >= 70;
    localStorage.removeItem(draftKey(quizModule.id));
    setQuizFinished(true);
    if (passed) await saveProgress({ ...moduleProgress, [quizModule.id]: 100 });
    const attempt: QuizAttempt = { module_id: quizModule.id, score, passed, question_count: quizQuestions.length, attempted_at: new Date().toISOString() };
    setQuizAttempts((current) => [attempt, ...current]);
    if (session && supabase) {
      const { data } = await supabase.from("quiz_attempts").insert({
        user_id: session.user.id,
        module_id: quizModule.id,
        score,
        passed,
        question_count: quizQuestions.length,
      }).select("id,module_id,score,passed,question_count,attempted_at").single();
      if (data) setQuizAttempts((current) => [data as QuizAttempt, ...current.filter((item) => item !== attempt)]);
    } else {
      const next = [attempt, ...quizAttempts];
      localStorage.setItem("cvhs-flight-school-quiz-attempts", JSON.stringify(next));
    }
  }

  function retakeQuiz() {
    if (!quizModule) return;
    startFreshQuiz(quizModule);
  }

  useEffect(() => {
    if (!quizModule || quizFinished || !quizQuestions.length) return;
    const draft: QuizDraft = {
      moduleId: quizModule.id,
      questionIds: quizQuestions.map((q) => q.id),
      answers: quizAnswers,
      index: quizIndex,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey(quizModule.id), JSON.stringify(draft));
  }, [quizModule, quizQuestions, quizAnswers, quizIndex, quizFinished]);

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


  const Sidebar = () => (
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="CVHS Flight School home">
        <span className="brand-mark"><Plane aria-hidden="true" /></span>
        <span><b>CVHS</b><small>FLIGHT SCHOOL</small></span>
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
                return (
                  <article className={`module-card ${done ? "complete" : ""}`} key={module.id}>
                    <div className="module-top"><span>MODULE {String(module.id).padStart(2, "0")}</span><b className={`status-badge ${done ? "done" : "pending"}`}>{done ? "COMPLETE" : "NOT COMPLETE"}</b></div>
                    <h3>{module.title}</h3>
                    <p>Chapter {module.id}</p>
                    <div className="module-actions">
                      <button className="open-button" onClick={() => setActiveModule(module)}>
                        {done ? "Review module" : "Open module"} <ArrowRight />
                      </button>
                      <button className="practice-quiz-button" onClick={() => startQuiz(module)}>{quizAttempts.some((a) => a.module_id === module.id) ? "Take another quiz" : "Take module quiz"}</button>
                      {quizAttempts.filter((a) => a.module_id === module.id).length > 0 && <div className="score-log"><span>QUIZ HISTORY</span>{quizAttempts.filter((a) => a.module_id === module.id).slice(0, 5).map((a, i) => <small key={`${a.attempted_at}-${i}`}><b>{a.score}%</b> · {new Date(a.attempted_at).toLocaleDateString()}</small>)}{quizAttempts.filter((a) => a.module_id === module.id).length > 5 && <small>+ {quizAttempts.filter((a) => a.module_id === module.id).length - 5} earlier attempts</small>}</div>}
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
          <b>CVHS FLIGHT SCHOOL</b>
          <p>Educational material does not replace instruction from an authorized instructor, current FAA publications, or aircraft-specific documentation.</p>
        </footer>
      </main>

      {activeModule && (
        <div className="modal-backdrop module-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveModule(null)}>
          <section className="module-modal" role="dialog" aria-modal="true" aria-labelledby="module-title">
            <div className="module-modal-head"><div><p className="eyebrow">MODULE {String(activeModule.id).padStart(2, "0")} · FAA COURSE READING</p><h2 id="module-title">{activeModule.title}</h2></div><button className="icon-button" aria-label="Close module" onClick={() => setActiveModule(null)}><X /></button></div>
            <div className="module-toolbar"><span>Chapter {activeModule.id} · FAA-H-8083-25C</span><a href={activeModule.pdf} target="_blank" rel="noreferrer">Open PDF in new tab <ExternalLink /></a></div>
            <iframe className="pdf-frame" src={activeModule.pdf} title={`FAA Chapter ${activeModule.id}: ${activeModule.title}`} />
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
                <div className="quiz-status"><span>20-QUESTION ASSESSMENT</span><b>Question bank staged</b></div>
                <div className="quiz-question"><span>ASSESSMENT ENGINE READY</span><h3>The Chapter {quizModule.id} bank is ready to receive reviewed questions.</h3><p>The engine is configured for topic-balanced 20-question attempts, randomized retakes, explanations, source-page references, question families, and a 70% passing score. This chapter currently has {getChapterQuestions(quizModule.id).length} production questions loaded.</p></div>
                <div className="quiz-footer"><button className="button subtle" onClick={() => { setQuizModule(null); setActiveModule(quizModule); }}>Back to module</button></div>
              </>
            ) : quizFinished ? (() => {
              const correct = quizQuestions.reduce((sum, q, index) => sum + (quizAnswers[index] === q.correctIndex ? 1 : 0), 0);
              const score = Math.round((correct / quizQuestions.length) * 100);
              const passed = score >= 70;
              return <>
                <div className="quiz-status"><span>ATTEMPT COMPLETE</span><b>{score}% · {passed ? "PASS" : "KEEP PRACTICING"}</b></div>
                <div className="quiz-question"><span>{correct} OF {quizQuestions.length} CORRECT</span><h3>{passed ? "Module complete — keep testing your knowledge anytime." : "Review the module or try another randomized attempt."}</h3><p>{passed ? "Your first passing score marks this module complete. Future attempts remain available and are saved in your quiz history." : "A 70% score is required for module completion. There is no limit on quiz attempts."}</p></div>
                <div className="quiz-footer"><button className="button subtle" onClick={() => { setQuizModule(null); setActiveModule(quizModule); }}>Review module</button><button className="button primary" onClick={retakeQuiz}>New attempt</button></div>
              </>;
            })() : (() => {
              const q = quizQuestions[quizIndex];
              const chosen = quizAnswers[quizIndex];
              const answered = chosen !== undefined;
              return <>
                <div className="quiz-status"><span>QUESTION {quizIndex + 1} OF {quizQuestions.length} · AUTO-SAVED</span><b>{q.topic} · {q.difficulty.toUpperCase()}</b></div>
                <div className="quiz-question"><span>{q.type.toUpperCase()}</span><h3>{q.prompt}</h3>
                  <div className="quiz-choices">{q.choices.map((choice, index) => <button key={index} className={`quiz-choice ${chosen === index ? "selected" : ""}`} onClick={() => setQuizAnswers({ ...quizAnswers, [quizIndex]: index })}><b>{String.fromCharCode(65 + index)}</b><span>{choice}</span></button>)}</div>
                  {answered && <div className="quiz-source">Source: Chapter {q.chapter}, {q.sourcePage}{q.figureReference ? ` · ${q.figureReference}` : ""}</div>}
                </div>
                <div className="quiz-footer"><button className="button subtle" disabled={quizIndex === 0} onClick={() => setQuizIndex(quizIndex - 1)}>Previous</button>{quizIndex < quizQuestions.length - 1 ? <button className="button primary" disabled={!answered} onClick={() => setQuizIndex(quizIndex + 1)}>Next question <ArrowRight /></button> : <button className="button primary" disabled={!answered || Object.keys(quizAnswers).length < quizQuestions.length} onClick={() => void finishQuiz()}>Submit quiz</button>}</div>
              </>;
            })()}
          </section>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="icon-button modal-close" aria-label="Close account window" onClick={() => setAuthOpen(false)}><X /></button>
            <span className="auth-icon"><Plane /></span>
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
