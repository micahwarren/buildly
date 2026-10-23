"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Camera,
  Upload,
  TreePine,
  Hammer,
  Layers,
  House,
  Fence,
  Plus,
  Menu,
  X,
  Bookmark,
  Printer,
  Download,
  Clock,
  Users,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
  Leaf,
  Sun,
  Image as ImageIcon,
} from "lucide-react";
import { brand, photos, type Project } from "@/lib/project";
import { ProjectComparison } from "@/components/ProjectComparison";
import { ProgressSteps } from "@/components/ProgressSteps";
import { parseProjectBackup } from "@/lib/project-backup";
import { useAccount } from "@/lib/accounts/use-account";
import { useProjectLibrary } from "@/lib/accounts/use-project-library";
import { readDraft, writeDraft, readLocalProjects } from "@/lib/local-projects";
import { ProjectDetailsForm } from "@/components/ProjectDetailsForm";
import { RefineProject } from "@/components/RefineProject";
import { ShoppingList } from "@/components/ShoppingList";
import { PlanReview } from "@/components/PlanReview";
import { shoppingText } from "@/lib/shopping";
import type { ProjectDetails } from "@/lib/project-details";
import { DeckAnimation } from "@/components/DeckAnimation";
import { AccountDialog } from "@/components/AccountDialog";
const categories = [
  { name: "Deck", image: photos.deck, icon: Layers },
  { name: "Pergola", image: photos.pergola, icon: Sun },
  { name: "Patio", image: photos.patio, icon: House },
  { name: "Fence", image: photos.fence, icon: Fence },
  { name: "Shed", image: photos.shed, icon: Hammer },
];
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export default function Home() {
  const [view, setView] = useState("home"),
    [step, setStep] = useState(0),
    [detail, setDetail] = useState(0),
    [photo, setPhoto] = useState(""),
    [type, setType] = useState("Pergola"),
    [description, setDescription] = useState(""),
    [details, setDetails] = useState<ProjectDetails>({}),
    [width, setWidth] = useState("12"),
    [length, setLength] = useState("16"),
    [budget, setBudget] = useState("I'm not sure"),
    [experience, setExperience] = useState("Beginner"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(0),
    [project, setProject] = useState<Project | null>(null),
    [tab, setTab] = useState("Overview"),
    [question, setQuestion] = useState(""),
    [asking, setAsking] = useState(false),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false),
    [imageAvailable, setImageAvailable] = useState<boolean | null>(null),
    [generatingDemo, setGeneratingDemo] = useState(false),
    [regenerating, setRegenerating] = useState(false),
    [rebuilding, setRebuilding] = useState(false),
    [refining, setRefining] = useState(false),
    [showAccount, setShowAccount] = useState(false),
    [draftStatus, setDraftStatus] = useState("");
  const account = useAccount();
  const library = useProjectLibrary(account);
  const {
    saved,
    scope: libraryScope,
    ready: libraryReady,
    save: saveProject,
  } = library;
  const accountUserId = account.user?.id;
  const restoredScope = useRef("");
  const navigationRevision = useRef(0);
  const pendingAccountProject = useRef<Project | null>(null);
  const backupFile = useRef<HTMLInputElement>(null);

  const file = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setImageAvailable(data.imageGenerationAvailable === true))
      .catch(() => setImageAvailable(false));
  }, []);
  useEffect(() => {
    if (account.recovery) setShowAccount(true);
  }, [account.recovery]);
  useEffect(() => {
    if (library.warning) setError(library.warning);
  }, [library.warning]);
  useEffect(() => {
    if (account.error) setError(account.error);
  }, [account.error]);
  useEffect(() => {
    if (!libraryReady || restoredScope.current === libraryScope) return;
    let cancelled = false;
    const initialRestore = !restoredScope.current;
    const navigationAtStart = navigationRevision.current;
    setReady(false);
    async function restore() {
      try {
        if (initialRestore && navigationRevision.current > 0) return;
        if (pendingAccountProject.current && accountUserId) {
          const p = pendingAccountProject.current;
          pendingAccountProject.current = null;
          setProject(p);
          setView("result");
          await saveProject(p);
        } else {
          const draft = await readDraft(libraryScope);
          if (
            cancelled ||
            (initialRestore && navigationRevision.current !== navigationAtStart)
          )
            return;
          setProject(null);
          setView("home");
          setPhoto("");
          setDescription("");
          setDetails({});
          if (draft) {
            setStep(draft.step);
            setDetail(draft.detail);
            setPhoto(draft.photo);
            setType(draft.type);
            setDescription(draft.description);
            setDetails(draft.details || {});
            setWidth(draft.width);
            setLength(draft.length);
            setBudget(draft.budget);
            setExperience(draft.experience);
            const recovered = draft.projectId
              ? (await readLocalProjects(libraryScope)).find(
                  (p) => p.id === draft.projectId,
                )
              : undefined;
            if (
              cancelled ||
              (initialRestore &&
                navigationRevision.current !== navigationAtStart)
            )
              return;
            if (recovered) {
              setProject(recovered);
              setView("result");
              setToast("Your project was restored.");
            } else if (draft.photo) {
              setView("wizard");
              setToast("Your unfinished project was restored.");
            }
          }
        }
      } catch {
        if (!cancelled)
          setError(
            "Draft recovery could not open. Your saved projects may still be available under My projects.",
          );
      } finally {
        if (!cancelled) {
          restoredScope.current = libraryScope;
          setReady(true);
        }
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [libraryReady, libraryScope, accountUserId, saveProject]);
  useEffect(() => {
    if (
      !ready ||
      !library.ready ||
      restoredScope.current !== library.scope ||
      !["wizard", "generating", "result"].includes(view)
    )
      return;
    let current = true;
    setDraftStatus("Saving draft…");
    writeDraft(library.scope, {
      view: view === "generating" ? "wizard" : view,
      step,
      detail,
      photo,
      type,
      description,
      width,
      length,
      budget,
      experience,
      details,
      projectId: view === "result" ? project?.id : undefined,
    })
      .then(() => {
        if (current) setDraftStatus("Draft saved on this device");
      })
      .catch(() => {
        if (current) {
          setDraftStatus("Draft could not be saved");
          setError(
            "Your browser could not save this draft. Keep this tab open and download a backup of any completed project.",
          );
        }
      });
    return () => {
      current = false;
    };
  }, [
    ready,
    library.ready,
    library.scope,
    view,
    step,
    detail,
    photo,
    type,
    description,
    width,
    length,
    budget,
    experience,
    details,
    project?.id,
  ]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        view === "generating" ||
        regenerating ||
        rebuilding ||
        refining ||
        library.saving ||
        draftStatus === "Saving draft…"
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [view, regenerating, rebuilding, refining, library.saving, draftStatus]);
  useEffect(() => {
    if (view !== "generating") return;
    const timer = setInterval(
      () => setLoading((v) => Math.min(v + 1, 2)),
      1800,
    );
    return () => clearInterval(timer);
  }, [view]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(v: string) {
    navigationRevision.current++;
    setView(v);
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function start(t?: string) {
    if (t) setType(t);
    setStep(0);
    setDetail(0);
    go("wizard");
  }
  function notify(s: string) {
    setToast(s);
  }
  async function store(p: Project) {
    const where = await library.save(p);
    if (where !== "failed")
      notify(
        where === "cloud"
          ? "Project saved to your account."
          : "Project saved on this device.",
      );
    if (!account.user) {
      pendingAccountProject.current = p;
      setShowAccount(true);
    }
  }
  function update(p: Project) {
    const next = { ...p, updatedAt: new Date().toISOString() };
    setProject(next);
    void library.save(next);
  }
  function downloadBackup() {
    if (!project) return;
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ format: "buildly-project-v1", project }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "buildly-project-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Please choose a backup smaller than 20 MB.");
      const p = parseProjectBackup(await file.text());
      p.updatedAt = new Date().toISOString();
      setProject(p);
      await library.save(p);
      go("result");
      setTab("Overview");
      notify("Project backup opened.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That backup could not be opened.",
      );
    }
  }
  async function upload(f?: File) {
    setError("");
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Please choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError("Please choose a photo smaller than 15 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1400 / image.width, 1400 / image.height);
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        canvas
          .getContext("2d")
          ?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.onerror = () =>
        setError("That photo could not be read. Please choose another.");
      image.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  }
  async function generate(demo = false) {
    if (!description.trim()) {
      setError("Tell us a little about your idea first.");
      return;
    }
    setGeneratingDemo(demo);
    setLoading(0);
    go("generating");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: demo ? "demo" : "ai",
          originalImage: photo,
          projectType: type,
          description,
          width: Number(width),
          length: Number(length),
          budget,
          experienceLevel: experience,
          details,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      if (demo) await new Promise((r) => setTimeout(r, 1000));
      setProject(data);
      await library.save(data);
      setTab("Overview");
      go("result");
    } catch (e) {
      go("wizard");
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }
  async function regenerateDesign() {
    if (!project || regenerating || rebuilding || refining || asking) return;
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImage: project.originalImage,
          projectType: project.projectType,
          description: project.description,
          width: project.width,
          length: project.length,
          budget: project.budget,
          experienceLevel: project.experienceLevel,
          details: project.details,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      update({
        ...project,
        ...data,
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        conversation: project.conversation,
        completed: 0,
        shopping: [],
        review: undefined,
        updatedAt: new Date().toISOString(),
      });
      notify("Your new photo preview is ready.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create another design. Please try again.",
      );
    } finally {
      setRegenerating(false);
    }
  }
  async function rebuildPlan(updatedDetails?: ProjectDetails) {
    if (!project || rebuilding || regenerating || refining || asking) return;
    setRebuilding(true);
    setError("");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImage: project.originalImage,
          generatedImage: project.generatedImage,
          projectType: project.projectType,
          description: project.description,
          width: project.width,
          length: project.length,
          budget: project.budget,
          experienceLevel: project.experienceLevel,
          details: updatedDetails || project.details,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      update({
        ...project,
        ...data,
        details: updatedDetails || project.details,
        completed: 0,
        shopping: [],
        review: undefined,
      });
      notify(
        "Materials and steps rebuilt from this design. Step progress starts fresh.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not rebuild the plan. Your project is unchanged.",
      );
    } finally {
      setRebuilding(false);
    }
  }
  async function ask() {
    if (
      !question.trim() ||
      !project ||
      asking ||
      rebuilding ||
      regenerating ||
      refining
    )
      return;
    setAsking(true);
    const q = question;
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          project: {
            ...project,
            originalImage: "",
            generatedImage: "",
            conversation: project.conversation.slice(-12),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      update({
        ...project,
        conversation: [
          ...project.conversation,
          { role: "You", text: q },
          { role: "Buildly AI", text: data.answer },
        ],
      });
    } catch (error) {
      setQuestion(q);
      setError(
        error instanceof Error
          ? error.message
          : "Your question could not be answered. Please try again.",
      );
    } finally {
      setAsking(false);
    }
  }
  async function refine(change: string, updatedDetails: Project["details"]) {
    if (!project || refining || rebuilding || regenerating || asking) return;
    setRefining(true);
    setError("");
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          title: project.title,
          originalImage: project.originalImage,
          generatedImage: project.generatedImage,
          projectType: project.projectType,
          description: project.description,
          width: project.width,
          length: project.length,
          budget: project.budget,
          experienceLevel: project.experienceLevel,
          details: updatedDetails,
          change,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      const savedTo = await library.save(data);
      setProject(data);
      setTab("Overview");
      if (savedTo === "failed")
        setError(
          "Your revision is ready but could not be saved. Download its project backup before leaving.",
        );
      else
        notify(
          "Revised version saved. Your previous version is still in My projects.",
        );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Revision failed. Your previous version is unchanged.",
      );
    } finally {
      setRefining(false);
    }
  }
  function download() {
    if (!project) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([shoppingText(project)], { type: "text/plain" }),
    );
    a.download = "buildly-shopping-list.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <>
      <header className={view === "home" ? "home-header" : undefined}>
        <button
          className="logo"
          onClick={() => go("home")}
          aria-label="Buildly home"
        >
          <span className="logo-mark">
            <img src="/buildly-logo.png" alt="" width="40" height="40" />
          </span>
          {brand.name}
          <span className="logo-dot">.</span>
        </button>
        <nav className={mobile ? "open" : ""}>
          <button
            onClick={() => {
              go("home");
              setTimeout(
                () =>
                  document
                    .getElementById("how")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            How it works
          </button>
          <button
            onClick={() => {
              go("home");
              setTimeout(
                () =>
                  document
                    .getElementById("ideas")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            Explore projects
          </button>
          <button onClick={() => go("saved")}>
            <Bookmark size={17} /> My projects
            {saved.length > 0 && <span className="count">{saved.length}</span>}
          </button>
          <button onClick={() => setShowAccount(true)}>
            {account.user ? "My account" : "Sign in / Create account"}
          </button>
        </nav>
        <button className="primary header-cta" onClick={() => start()}>
          Start my project <ArrowRight size={18} />
        </button>
        <button
          className="mobile-menu"
          aria-label="Toggle navigation"
          onClick={() => setMobile(!mobile)}
        >
          {mobile ? <X /> : <Menu />}
        </button>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {view === "home" && (
        <main className="home-simple">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">LESS GUESSWORK. MORE BUILDING.</div>
              <h1>
                Big ideas.
                <br />
                <em>Built by you.</em>
              </h1>
              <p>
                Upload a photo and tell us what you want to build. Get a design,
                a materials list, and step-by-step instructions.
              </p>
              <button className="primary big" onClick={() => start()}>
                Start my project <ArrowRight size={21} />
              </button>
              <div className="hero-note">Photo → Idea → Your plan</div>
            </div>
            <DeckAnimation />
          </section>
          <section className="section" id="how">
            <div className="section-heading">
              <h2>From photo to plan.</h2>
            </div>
            <div className="how-grid">
              {[
                {
                  icon: Camera,
                  title: "Take a photo",
                  text: "Upload a photo of your space.",
                },
                {
                  icon: MessageCircle,
                  title: "Tell us your idea",
                  text: "Describe what you want to build.",
                },
                {
                  icon: Hammer,
                  title: "Get your project plan",
                  text: "See the design, materials, costs, and steps.",
                },
              ].map((c, i) => (
                <article className="how-card" key={c.title}>
                  <div className="how-top">
                    <c.icon size={29} />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="ideas-section section" id="ideas">
            <div className="section-heading">
              <div>
                <h2>What will you build?</h2>
              </div>
            </div>
            <div className="project-pills">
              {categories.map((c) => (
                <button key={c.name} onClick={() => start(c.name)}>
                  <c.icon size={23} />
                  {c.name}
                  <ArrowRight size={18} />
                </button>
              ))}
              <button onClick={() => start("Something else")}>
                <Plus size={23} />
                Something else
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
          <section className="bottom-cta">
            <TreePine size={38} />
            <h2>What do you want to build?</h2>

            <button className="primary big" onClick={() => start()}>
              Start my project <ArrowRight size={20} />
            </button>
            <span>No account needed to get started.</span>
          </section>
        </main>
      )}
      {view === "wizard" && (
        <main className="wizard">
          <ProgressSteps step={step} />
          {photo && (
            <p className="save-status" aria-live="polite">
              {draftStatus}
            </p>
          )}
          <button
            className="back"
            onClick={() => (step === 0 ? go("home") : setStep(step - 1))}
          >
            <ArrowLeft size={18} /> Back
          </button>
          {step === 0 && (
            <>
              <div className="center">
                <h1>Add a photo of your space</h1>
                <p>Take a picture or choose one from your device.</p>
              </div>
              <div
                className={"upload " + (photo ? "has-photo" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  upload(e.dataTransfer.files[0]);
                }}
              >
                {photo ? (
                  <img src={photo} alt="Your uploaded project area" />
                ) : (
                  <>
                    <div className="upload-icon">
                      <Camera size={40} />
                    </div>
                    <h3>Upload your photo</h3>
                    <p>Drop a photo here.</p>
                  </>
                )}
              </div>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <input
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <div className="actions center-actions">
                {photo ? (
                  <>
                    <button
                      className="secondary"
                      onClick={() => file.current?.click()}
                    >
                      Choose a different photo
                    </button>
                    <button className="primary" onClick={() => setStep(1)}>
                      Use this photo <ArrowRight size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="secondary"
                      onClick={() => camera.current?.click()}
                    >
                      <Camera size={20} /> Take a photo
                    </button>
                    <button
                      className="primary"
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={20} /> Choose a photo
                    </button>
                  </>
                )}
              </div>
              <p className="muted center">JPG, PNG, or WebP · Up to 15 MB</p>
            </>
          )}
          {step === 1 && (
            <>
              <div className="center">
                <h1>What would you like to build?</h1>
                <p>Choose a type and describe your idea.</p>
              </div>
              <div className="type-grid">
                {[...categories, { name: "Something else", icon: Plus }].map(
                  (c) => (
                    <button
                      key={c.name}
                      className={
                        "choice " + (type === c.name ? "selected" : "")
                      }
                      onClick={() => setType(c.name)}
                    >
                      <c.icon size={30} />
                      {c.name}
                      {type === c.name && <Check size={17} />}
                    </button>
                  ),
                )}
              </div>
              <label className="field">
                Tell us what you’re imagining
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder="I'd love a wooden pergola over my patio, with room for a table and six chairs."
                />
              </label>
              <p className="muted">
                Include the materials and features you want.
              </p>
              <button
                className="primary next"
                disabled={!description.trim()}
                onClick={() => {
                  setStep(2);
                  setDetail(0);
                }}
              >
                Continue <ArrowRight size={20} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="center">
                <h1>How big is your project?</h1>
                <p>Enter approximate dimensions in feet.</p>
              </div>
              <div className="dimensions">
                <label>
                  Width (feet)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </label>
                <span>×</span>
                <label>
                  {type === "Fence" ? "Fence length" : "Length"} (feet)
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setWidth("12");
                  setLength("16");
                  notify(
                    "Using 12 × 16 ft as a sample. Verify measurements before building.",
                  );
                }}
              >
                I’m not sure — use sample dimensions
              </button>
              <details className="optional-settings">
                <summary>
                  Budget, experience & site details <span>Optional</span>
                </summary>
                <div className="optional-fields">
                  <label className="field">
                    Budget
                    <select
                      aria-label="Budget"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    >
                      {[
                        "Under $1,000",
                        "$1,000–$2,500",
                        "$2,500–$5,000",
                        "$5,000+",
                        "I'm not sure",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Building experience
                    <select
                      aria-label="Building experience"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                    >
                      {["Beginner", "Some experience", "Experienced"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <ProjectDetailsForm
                    value={details}
                    onChange={setDetails}
                    prefix="wizard"
                  />
                </div>
              </details>
              <button
                className="primary next"
                disabled={
                  !width ||
                  !length ||
                  +width < 1 ||
                  +width > 100 ||
                  +length < 1 ||
                  +length > 200
                }
                onClick={() => generate(false)}
              >
                Get my design & plan <ArrowRight size={20} />
              </button>
              <p className="muted center">
                {imageAvailable === false
                  ? "Photo previews aren’t available on this site yet. A sample plan will not show your project in your yard."
                  : "AI uses your photo to create your design and plan. Allow a few minutes."}
              </p>
              {
                <button className="text-button" onClick={() => generate(true)}>
                  Explore a sample plan instead (no photo edit)
                </button>
              }
            </>
          )}
        </main>
      )}
      {view === "generating" && (
        <main className="generating">
          <div className="loading-house">
            <House size={52} />
          </div>
          <span className="badge">
            {generatingDemo ? "SAMPLE PLAN" : "YOUR PHOTO → YOUR DESIGN"}
          </span>
          <h1>
            {generatingDemo
              ? "Preparing your sample plan…"
              : "Creating your backyard preview…"}
          </h1>
          <p>
            {generatingDemo
              ? "This sample won’t include an edit of your photo."
              : "We’re adding your idea to your photo. This can take a few minutes—please keep this page open."}
          </p>
          <div className="loading-list">
            {[
              "Photo received",
              "Project details ready",
              generatingDemo
                ? "Preparing illustrative sample"
                : "Editing your actual photo…",
            ].map((s, i) => (
              <div key={s} className={i < loading ? "done" : ""}>
                {i < loading ? (
                  <CheckCircle2 size={23} />
                ) : (
                  <span className="empty-circle" />
                )}
                {s}
              </div>
            ))}
          </div>
        </main>
      )}
      {view === "result" && project && (
        <main className="result">
          <button className="back" onClick={() => go("saved")}>
            <ArrowLeft size={18} /> My projects
          </button>
          <div className="result-heading">
            <div>
              <h1>Here’s your project.</h1>
              <p>
                {project.width} × {project.length} ft{" "}
                {project.projectType.toLowerCase()} ·{" "}
                {project.visualizationMode === "ai"
                  ? "AI photo concept"
                  : "Sample plan"}
              </p>
            </div>
            <button className="primary" onClick={() => store(project)}>
              <Bookmark size={20} /> Save my project
            </button>
          </div>
          <div className="project-save-bar">
            <span aria-live="polite">
              {library.saving
                ? "Saving your project…"
                : library.synced.has(project.id)
                  ? "Saved to your account"
                  : saved.some(
                        (p) =>
                          p.id === project.id &&
                          p.updatedAt === project.updatedAt,
                      )
                    ? "Saved automatically on this device"
                    : "Not saved yet — keep this tab open"}
            </span>
            <button className="text-button" onClick={downloadBackup}>
              <Download size={17} /> Download project backup
            </button>
          </div>
          <div className="demo-banner">
            <ImageIcon size={23} />
            <div>
              <strong>
                {project.visualizationMode === "ai"
                  ? "Your space, reimagined"
                  : "Sample plan — no photo preview generated"}
              </strong>
              <span>
                {project.visualizationMode === "ai"
                  ? "AI concept. Confirm measurements and plan details before building."
                  : "This is a separate generic illustration, not a preview of your property. Use Create a photo preview to visualize the project in your yard."}
              </span>
            </div>
          </div>
          {project.visualizationMode === "ai" && (
            <details
              className="panel plan-status"
              open={project.planStatus !== "design-based"}
              aria-label="Design-based plan"
            >
              <summary>
                {project.planStatus === "design-based"
                  ? "Plan ready · Review details"
                  : "Your plan needs another try"}
              </summary>
              <h3>
                {project.planStatus === "design-based"
                  ? "Plan for this design"
                  : "This design needs a matching plan"}
              </h3>
              <p>
                {project.planSummary ||
                  "This saved project has a category-based estimate. Rebuild it using your description, original photo and this design."}
              </p>
              <button
                className="secondary"
                disabled={rebuilding || regenerating || refining || asking}
                onClick={() => rebuildPlan()}
              >
                {rebuilding
                  ? "Reviewing photos and building your plan…"
                  : "Rebuild plan from this design"}
              </button>
              <p className="muted">
                Keeps your image. Replaces materials and steps; resets progress.
              </p>
              {!!project.planQuestions?.length && (
                <div>
                  <h4>Details to confirm before building</h4>
                  <ul>
                    {project.planQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          )}
          {project.visualizationMode === "ai" && (
            <RefineProject
              key={project.id}
              project={project}
              busy={refining || rebuilding || regenerating || asking}
              onRefine={refine}
              onReplan={rebuildPlan}
            />
          )}
          <div className="tabs" role="tablist" aria-label="Project sections">
            {[
              "Overview",
              "Materials",
              "Tools",
              "Build steps",
              "Project details",
              "Ask about my project",
            ].map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <>
              <ProjectComparison
                originalImage={project.originalImage}
                generatedImage={project.generatedImage}
                live={project.visualizationMode === "ai"}
              />
              <div className="design-actions">
                <span>
                  {project.visualizationMode === "ai"
                    ? "Your original photo is always kept."
                    : "Sample illustrations cannot show how your yard will look."}
                </span>
                <button
                  className="secondary"
                  disabled={regenerating || rebuilding || refining || asking}
                  onClick={regenerateDesign}
                >
                  {regenerating
                    ? "Creating your photo preview…"
                    : project.visualizationMode === "ai"
                      ? "Try another design"
                      : "Create a photo preview"}
                </button>
              </div>
              <h2>
                Your {project.width} × {project.length}{" "}
                {project.projectType.toLowerCase()}
              </h2>
              <div className="stats">
                <div>
                  <span>
                    {project.materials.some((m) => !m.quantity || !m.unitCost)
                      ? "Materials — partial estimate"
                      : "Estimated materials"}
                  </span>
                  <strong>
                    {project.materials.some(
                      (m) => m.quantity > 0 && m.unitCost > 0,
                    )
                      ? `${money(project.estimatedCostLow)}–${money(project.estimatedCostHigh)}`
                      : "Scope review needed"}
                  </strong>
                  <small>Illustrative, not live prices</small>
                </div>
                <div>
                  <Clock />
                  <span>Estimated hands-on labor</span>
                  <strong>{project.estimatedHours}</strong>
                </div>
                <div>
                  <Hammer />
                  <span>Difficulty</span>
                  <strong>{project.difficulty}</strong>
                </div>
                <div>
                  <Users />
                  <span>Suggested crew</span>
                  <strong>
                    {project.recommendedCrew || "See project details"}
                  </strong>
                </div>
              </div>
              <p>
                {project.assumptions.find((a) =>
                  a.startsWith("Time is a planning allowance:"),
                )}
              </p>
              <div className="plan-links">
                {["Materials", "Tools", "Build steps", "Project details"].map(
                  (s, i) => (
                    <button key={s} onClick={() => setTab(s)}>
                      <span>0{i + 1}</span>
                      <strong>{s}</strong>
                      <ArrowRight />
                    </button>
                  ),
                )}
              </div>
            </>
          )}
          {tab === "Materials" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Your shopping list</h2>
                  <p>
                    Planning quantities and reference US prices. Confirm product
                    specifications and measurements before purchasing.
                  </p>
                </div>
                <button className="secondary" onClick={() => window.print()}>
                  <Printer size={18} /> Print
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Quantity</th>
                      <th>Unit estimate</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.materials.map((m) => (
                      <tr key={m.item}>
                        <td>
                          <strong>{m.item}</strong>
                          <small>{m.dimensions}</small>
                          {m.purpose && <small>Used for: {m.purpose}</small>}
                          {m.quantityBasis && (
                            <small>Quantity basis: {m.quantityBasis}</small>
                          )}
                        </td>
                        <td>{m.quantity || "Verify"}</td>
                        <td>{m.unitCost ? money(m.unitCost) : "Verify"}</td>
                        <td>
                          {m.quantity && m.unitCost
                            ? money(m.unitCost * m.quantity)
                            : "Not priced"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="total">
                <span>
                  Priced items subtotal{" "}
                  {project.materials.some((m) => !m.quantity || !m.unitCost)
                    ? "(incomplete)"
                    : ""}
                </span>
                <strong>
                  {project.materials.some(
                    (m) => m.quantity > 0 && m.unitCost > 0,
                  )
                    ? money(
                        project.materials.reduce(
                          (s, m) => s + m.quantity * m.unitCost,
                          0,
                        ),
                      )
                    : "Not priced"}
                </strong>
              </div>
              <button className="primary" onClick={download}>
                <Download size={18} /> Save shopping list
              </button>
              <p className="muted">
                Items marked Verify are excluded from totals. No retailer
                connection. Taxes, delivery, labor, permits, and site-specific
                changes are excluded.
              </p>
              <ShoppingList
                key={project.id}
                project={project}
                onChange={update}
              />
            </section>
          )}
          {tab === "Tools" && (
            <section className="panel">
              <h2>Get your tools together.</h2>
              <p>Check what you have before buying or renting.</p>
              <div className="tools-grid">
                {["Tools you probably have", "Tools you may need"].map(
                  (title, i) => (
                    <div key={title}>
                      <h3>{title}</h3>
                      {project.tools
                        .slice(i === 0 ? 0 : 4, i === 0 ? 4 : undefined)
                        .map((t) => (
                          <label className="tool" key={t}>
                            <input type="checkbox" /> {t}
                          </label>
                        ))}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {tab === "Build steps" && (
            <section className="panel build-mode">
              <div className="section-heading">
                <span className="badge">BUILD MODE · PROJECT GUIDE</span>
                <strong>
                  {project.completed} / {project.steps.length} complete
                </strong>
              </div>
              <progress value={project.completed} max={project.steps.length} />
              {project.completed === project.steps.length ? (
                <div className="center">
                  <CheckCircle2 size={48} />
                  <h2>Your project guide is complete.</h2>
                  <p>
                    Keep your approved site-specific design and inspection
                    requirements with your project.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => update({ ...project, completed: 0 })}
                  >
                    Review steps again
                  </button>
                </div>
              ) : (
                <>
                  <div className="step-illustration">
                    <Hammer size={65} />
                    <span>
                      {String(project.completed + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="eyebrow">
                    STEP {project.completed + 1} OF {project.steps.length}
                  </span>
                  <h2>{project.steps[project.completed].title}</h2>
                  <p className="step-text">
                    {project.steps[project.completed].text}
                  </p>
                  {(
                    [
                      ["What to do", project.steps[project.completed].actions],
                      [
                        "Materials for this step",
                        project.steps[project.completed].materials,
                      ],
                      [
                        "Tools for this step",
                        project.steps[project.completed].tools,
                      ],
                      [
                        "Check before moving on",
                        project.steps[project.completed].checks,
                      ],
                      [
                        "Stop and resolve first",
                        project.steps[project.completed].stopConditions,
                      ],
                    ] as [string, string[] | undefined][]
                  ).map(([heading, items]) =>
                    items?.length ? (
                      <div key={heading}>
                        <h3>{heading}</h3>
                        {heading === "What to do" ? (
                          <ol>
                            {items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ol>
                        ) : (
                          <ul>
                            {items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null,
                  )}

                  <button
                    className="text-button"
                    onClick={() => {
                      setTab("Ask about my project");
                      setQuestion(
                        `What does this step mean: ${project.steps[project.completed].title}?`,
                      );
                    }}
                  >
                    <MessageCircle size={19} /> Ask about this step
                  </button>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={project.completed === 0}
                      onClick={() =>
                        update({
                          ...project,
                          completed: Math.max(0, project.completed - 1),
                        })
                      }
                    >
                      Previous step
                    </button>
                    <button
                      className="primary"
                      disabled={
                        project.planStatus === "unavailable" || rebuilding
                      }
                      onClick={() =>
                        update({
                          ...project,
                          completed: project.completed + 1,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                    >
                      Done — next step <ArrowRight size={20} />
                    </button>
                  </div>
                  <p className="muted">
                    Save your project to keep progress on this device.
                  </p>
                </>
              )}
            </section>
          )}
          {tab === "Project details" && (
            <section className="panel">
              <h2>A clear picture before you build.</h2>
              <h3>Your idea</h3>
              <p>{project.description}</p>
              <div className="details-grid">
                <div>
                  <h3>Project details</h3>
                  <p>
                    {project.width} × {project.length} feet
                    <br />
                    Budget: {project.budget}
                    <br />
                    Experience: {project.experienceLevel}
                  </p>
                </div>
                <div>
                  <h3>Assumptions</h3>
                  <ul>
                    {project.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h3>Before you build</h3>
              {project.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <h3>Site information supplied by you</h3>
              <ul>
                {Object.entries(project.details || {}).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
              <p>
                Plans may contain errors and are not certified construction
                drawings. Resolve structural specifications and local
                requirements before building.
              </p>
              <PlanReview
                key={project.id}
                project={project}
                onChange={update}
              />
            </section>
          )}
          {tab === "Ask about my project" && (
            <section className="panel assistant">
              <h2>A little help along the way.</h2>
              <p>
                The AI assistant uses your saved request, site details,
                materials, instructions and recent conversation. To apply
                changes, use Refine this project.
              </p>
              <div className="suggestions">
                {[
                  "Can I make this two feet wider?",
                  "What if my yard isn’t level?",
                  "Can I use cedar instead?",
                ].map((q) => (
                  <button
                    className="secondary"
                    key={q}
                    onClick={() => setQuestion(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="conversation" aria-live="polite">
                {project.conversation.map((m, i) => (
                  <div
                    className={m.role === "You" ? "message user" : "message"}
                    key={i}
                  >
                    <strong>{m.role}</strong>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <label className="field">
                  Your question
                  <textarea
                    maxLength={1000}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What would you like to know?"
                  />
                </label>
                <button
                  className="primary"
                  disabled={
                    asking ||
                    rebuilding ||
                    regenerating ||
                    refining ||
                    !question.trim()
                  }
                >
                  {asking ? "Preparing response…" : "Ask about my project"}{" "}
                  <ArrowRight size={18} />
                </button>
              </form>
            </section>
          )}
          <div className="safety-note">
            <Leaf size={23} />
            <p>
              A good project starts with a safe plan. Concepts are not
              construction-ready engineering. Verify dimensions, permits,
              utilities, and structural requirements before building.
            </p>
          </div>
        </main>
      )}
      {view === "saved" && (
        <main className="saved-page">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR NEXT “I BUILT THAT”</span>
              <h1>My projects</h1>
              <p>
                {account.user
                  ? "Your account projects and local copies. Cloud-save status appears on each project."
                  : "Projects are saved automatically on this device. Create an account to keep them across devices."}
              </p>
              {!account.user && (
                <button
                  className="text-button"
                  onClick={() => setShowAccount(true)}
                >
                  Create an account or sign in
                </button>
              )}
              {account.user && library.guestCount > 0 && (
                <button
                  className="text-button"
                  disabled={library.saving}
                  onClick={() => void library.importGuests()}
                >
                  Copy this device’s guest projects to my account (
                  {library.guestCount})
                </button>
              )}
            </div>
            <button className="primary" onClick={() => start()}>
              <Plus size={20} /> New project
            </button>
          </div>
          <div className="backup-actions">
            <button
              className="secondary"
              onClick={() => backupFile.current?.click()}
            >
              Import project backup
            </button>
            <input
              ref={backupFile}
              type="file"
              hidden
              accept="application/json,.json"
              onChange={(e) => void importBackup(e.target.files?.[0])}
            />
          </div>
          {ready && saved.length === 0 ? (
            <div className="empty-state">
              <House size={54} />
              <h2>Every great project starts with an idea.</h2>
              <p>Your saved projects will be right here.</p>
              <button className="primary" onClick={() => start()}>
                Start my first project <ArrowRight size={20} />
              </button>
            </div>
          ) : (
            <div className="saved-grid">
              {saved.map((p) => (
                <article className="saved-card" key={p.id}>
                  <img
                    src={p.generatedImage}
                    alt={`${p.projectType} sample inspiration`}
                  />
                  <div>
                    <span className="eyebrow">
                      {p.projectType} ·{" "}
                      {p.visualizationMode === "ai"
                        ? "AI PHOTO CONCEPT"
                        : "SAMPLE PLAN"}
                    </span>
                    <h3>{p.title}</h3>
                    <p>
                      {money(p.estimatedCostLow)}–{money(p.estimatedCostHigh)}
                    </p>
                    <p className="save-status">
                      {library.synced.has(p.id)
                        ? "Saved to your account"
                        : "Saved on this device"}
                    </p>
                    <small>
                      {new Date(p.createdAt).toLocaleDateString()} ·{" "}
                      {p.completed} of {p.steps.length} steps complete
                    </small>
                    <progress value={p.completed} max={p.steps.length} />
                    <button
                      className="primary"
                      onClick={() => {
                        setProject(p);
                        setTab("Overview");
                        go("result");
                      }}
                    >
                      Continue project <ChevronRight size={19} />
                    </button>
                    <button
                      className="delete-button"
                      onClick={async () => {
                        if (
                          window.confirm(
                            account.user
                              ? "Remove this project from your account and this device?"
                              : "Remove this project from this device?",
                          )
                        )
                          await library.remove(p.id);
                      }}
                    >
                      Remove project
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      )}
      {showAccount && (
        <AccountDialog account={account} close={() => setShowAccount(false)} />
      )}
      <footer>
        <button className="logo" onClick={() => go("home")}>
          <span className="logo-mark">
            <img src="/buildly-logo.png" alt="" width="28" height="28" />
          </span>
          {brand.name}.
        </button>
        <span>{brand.tagline}</span>
        <small>
          © {new Date().getFullYear()} Buildly · Thoughtfully planned. Proudly
          built.
        </small>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={21} />
          {toast}
        </div>
      )}
    </>
  );
}
