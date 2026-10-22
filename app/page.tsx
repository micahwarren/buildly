"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
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
    [width, setWidth] = useState("12"),
    [length, setLength] = useState("16"),
    [budget, setBudget] = useState("I'm not sure"),
    [experience, setExperience] = useState("Beginner"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(0),
    [project, setProject] = useState<Project | null>(null),
    [saved, setSaved] = useState<Project[]>([]),
    [tab, setTab] = useState("Overview"),
    [question, setQuestion] = useState(""),
    [asking, setAsking] = useState(false),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false),
    [homeBefore, setHomeBefore] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("buildly-projects");
      if (stored) setSaved(JSON.parse(stored));
    } catch {
      setError("Saved projects could not be opened in this browser.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (view !== "generating") return;
    const timer = setInterval(() => setLoading((v) => Math.min(v + 1, 4)), 700);
    return () => clearInterval(timer);
  }, [view]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(v: string) {
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
  function store(p: Project) {
    const next = [p, ...saved.filter((s) => s.id !== p.id)];
    try {
      localStorage.setItem("buildly-projects", JSON.stringify(next));
      setSaved(next);
      notify("Project saved on this device.");
    } catch {
      setError(
        "Your device storage is full. Try a smaller photo or remove an older project.",
      );
    }
  }
  function update(p: Project) {
    setProject(p);
    if (saved.some((s) => s.id === p.id)) {
      const next = saved.map((s) => (s.id === p.id ? p : s));
      try {
        localStorage.setItem("buildly-projects", JSON.stringify(next));
        setSaved(next);
      } catch {
        setError("Progress could not be saved. Device storage may be full.");
      }
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
        const scale = Math.min(1, 1400 / image.width);
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
  async function generate() {
    if (!description.trim()) {
      setError("Tell us a little about your idea first.");
      return;
    }
    setLoading(0);
    go("generating");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImage: photo,
          projectType: type,
          description,
          width: Number(width),
          length: Number(length),
          budget,
          experienceLevel: experience,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      await new Promise((r) => setTimeout(r, 3200));
      setProject(data);
      setTab("Overview");
      go("result");
    } catch (e) {
      go("wizard");
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }
  async function ask() {
    if (!question.trim() || !project || asking) return;
    setAsking(true);
    const q = question;
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, project }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      update({
        ...project,
        conversation: [
          ...project.conversation,
          { role: "You", text: q },
          { role: "Buildly sample guide", text: data.answer },
        ],
      });
    } catch {
      setError("Your question could not be answered. Please try again.");
    } finally {
      setAsking(false);
    }
  }
  function download() {
    if (!project) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          `${project.title}\nIllustrative prices only\n\n` +
            project.materials
              .map(
                (m) =>
                  `${m.quantity} × ${m.item} (${m.dimensions}) — ${money(m.quantity * m.unitCost)}`,
              )
              .join("\n"),
        ],
        { type: "text/plain" },
      ),
    );
    a.download = "buildly-shopping-list.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <header>
        <button
          className="logo"
          onClick={() => go("home")}
          aria-label="Buildly home"
        >
          <span className="logo-mark">
            <House size={23} strokeWidth={2.5} />
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
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> BIG IDEAS. BUILT BY YOU.
              </div>
              <h1>
                See it.
                <br />
                Plan it.
                <br />
                <em>Build it.</em>
              </h1>
              <p>
                That backyard idea? Let’s make it real.
                <br className="desktop" /> Take a photo, tell us your vision,
                and get a clear path from{" "}
                <strong>“what if” to “I built that.”</strong>
              </p>
              <button className="primary big" onClick={() => start()}>
                Start my project <ArrowRight size={21} />
              </button>
              <div className="hero-note">
                <CheckCircle2 size={16} /> No experience needed <span>·</span>{" "}
                Free to try
              </div>
            </div>
            <div className="hero-visual">
              <img
                src={homeBefore ? photos.before : photos.hero}
                alt={
                  homeBefore
                    ? "Illustration of a backyard before a project"
                    : "Illustration of a backyard with a wood pergola and deck"
                }
              />
              <div className="hero-toggle">
                <button
                  aria-pressed={homeBefore}
                  onClick={() => setHomeBefore(true)}
                >
                  Before
                </button>
                <button
                  aria-pressed={!homeBefore}
                  onClick={() => setHomeBefore(false)}
                >
                  After
                </button>
              </div>
              <div className="photo-label">
                <span className="small-dot" /> YOUR NEXT CHAPTER STARTS OUTSIDE
              </div>
              <div className="project-float">
                <div className="float-icon">
                  <House size={24} />
                </div>
                <div>
                  <strong>A space to make memories.</strong>
                  <span>You bring the idea. We’ll bring the plan.</span>
                </div>
                <span className="float-arrow">
                  <ArrowUpRight size={25} />
                </span>
              </div>
              <div className="image-caption">
                Illustrated concept · Imagine the possibilities.
              </div>
            </div>
          </section>
          <section className="trust-strip">
            <span>More possibility. Less guesswork.</span>
            <div>
              <CheckCircle2 /> Made for real homeowners
            </div>
            <div>
              <Leaf /> Your space. Your vision.
            </div>
            <div>
              <Hammer /> A plan you can follow
            </div>
          </section>
          <section className="section" id="how">
            <div className="section-heading">
              <div>
                <div className="eyebrow">FROM IDEA TO “LOOK WHAT I MADE”</div>
                <h2>
                  A big project.
                  <br />
                  Three simple steps.
                </h2>
              </div>
              <p>
                You don’t need to know where to start.
                <br />
                That’s what we’re here for.
              </p>
            </div>
            <div className="how-grid">
              {[
                {
                  icon: Camera,
                  title: "Take a photo",
                  text: "Show us your backyard, patio, or that corner with potential.",
                },
                {
                  icon: MessageCircle,
                  title: "Tell us your idea",
                  text: "A shady spot for Sunday lunch? Just tell us in your own words.",
                },
                {
                  icon: Hammer,
                  title: "Get your project plan",
                  text: "Explore a concept, estimated materials, and clear next steps.",
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
                <div className="eyebrow">A LITTLE INSPIRATION</div>
                <h2>What will you build?</h2>
              </div>
              <span className="hand-note">Make room for the good stuff. ↙</span>
            </div>
            <div className="category-grid">
              {categories.map((c) => (
                <button
                  key={c.name}
                  className="category"
                  onClick={() => start(c.name)}
                >
                  <img src={c.image} alt={`${c.name} project inspiration`} />
                  <span>
                    {c.name}s <ArrowRight size={19} />
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="bottom-cta">
            <TreePine size={38} />
            <h2>
              Your favorite place could be
              <br />
              right outside your door.
            </h2>
            <p>Let’s see what’s possible.</p>
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
          <button
            className="back"
            onClick={() =>
              step === 0
                ? go("home")
                : step === 2 && detail > 0
                  ? setDetail(detail - 1)
                  : setStep(step - 1)
            }
          >
            <ArrowLeft size={18} /> Back
          </button>
          {step === 0 && (
            <>
              <div className="center">
                <div className="eyebrow">LET’S START WITH YOUR SPACE</div>
                <h1>Where do you want to build?</h1>
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
                    <h3>A little potential starts here.</h3>
                    <p>Drag your photo here, or choose an option below.</p>
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
              <p className="muted center">
                JPG, PNG, or WebP · Up to 15 MB · Your photo stays part of your
                project.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <div className="center">
                <h1>What would you like to build?</h1>
                <p>Pick a project. Then tell us what you’re imagining.</p>
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
                Just describe it like you would to a friend. There’s no wrong
                way.
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
                <div className="eyebrow">A FEW DETAILS · {detail + 1} OF 3</div>
                <h1>
                  {
                    [
                      "About how big should it be?",
                      "What’s your budget?",
                      "How comfortable are you building things?",
                    ][detail]
                  }
                </h1>
                <p>
                  {
                    [
                      "A rough idea is all we need for this sample concept.",
                      "We’ll keep your budget with your project. Sample estimates may differ.",
                      "We’ll keep your experience level with your project.",
                    ][detail]
                  }
                </p>
              </div>
              {detail === 0 ? (
                <>
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
                </>
              ) : (
                <div className="options">
                  {(detail === 1
                    ? [
                        "Under $1,000",
                        "$1,000–$2,500",
                        "$2,500–$5,000",
                        "$5,000+",
                        "I'm not sure",
                      ]
                    : ["Beginner", "Some experience", "Experienced"]
                  ).map((s) => (
                    <button
                      className={
                        "choice " +
                        ((detail === 1 ? budget : experience) === s
                          ? "selected"
                          : "")
                      }
                      key={s}
                      onClick={() =>
                        detail === 1 ? setBudget(s) : setExperience(s)
                      }
                    >
                      {s}
                      {(detail === 1 ? budget : experience) === s && (
                        <Check size={20} />
                      )}
                    </button>
                  ))}
                </div>
              )}
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
                onClick={() =>
                  detail < 2 ? setDetail(detail + 1) : generate()
                }
              >
                {detail < 2 ? "Continue" : "Create my sample project"}{" "}
                <ArrowRight size={20} />
              </button>
              <p className="muted center">
                Demo mode · No API key required. You’ll see an illustrative
                sample plan.
              </p>
            </>
          )}
        </main>
      )}
      {view === "generating" && (
        <main className="generating">
          <div className="loading-house">
            <House size={52} />
          </div>
          <span className="badge">DEMO MODE</span>
          <h1>Putting your idea together…</h1>
          <p>Preparing a sample concept for your {type.toLowerCase()}.</p>
          <div className="loading-list">
            {[
              "Keeping your photo with your project",
              "Adding your idea and dimensions",
              "Preparing an inspiration image",
              "Estimating sample materials",
              "Putting your next steps together",
            ].map((s, i) => (
              <div key={s} className={i <= loading ? "done" : ""}>
                {i <= loading ? (
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
              <span className="eyebrow">YOUR IDEA, ONE STEP CLOSER</span>
              <h1>Here’s your project.</h1>
              <p>
                {project.width} × {project.length} ft{" "}
                {project.projectType.toLowerCase()} · Sample concept
              </p>
            </div>
            <button className="primary" onClick={() => store(project)}>
              <Bookmark size={20} /> Save my project
            </button>
          </div>
          <div className="demo-banner">
            <ImageIcon size={23} />
            <div>
              <strong>Demo preview</strong>
              <span>
                The inspiration image is a sample, not an edit of your photo.
                Plans and prices are illustrative.
              </span>
            </div>
          </div>
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
              />
              <div className="design-actions">
                <span>Slide to compare · Sample imagery only</span>
                <button
                  className="secondary"
                  onClick={() => {
                    update({
                      ...project,
                      generatedImage:
                        project.generatedImage === photos.pergola
                          ? photos.deck
                          : photos.pergola,
                    });
                    notify("Showing another sample inspiration image.");
                  }}
                >
                  Try another sample
                </button>
              </div>
              <h2>
                Your {project.width} × {project.length}{" "}
                {project.projectType.toLowerCase()}
              </h2>
              <div className="stats">
                <div>
                  <span>Estimated materials</span>
                  <strong>
                    {money(project.estimatedCostLow)}–
                    {money(project.estimatedCostHigh)}
                  </strong>
                  <small>Illustrative, not live prices</small>
                </div>
                <div>
                  <Clock />
                  <span>Estimated build time</span>
                  <strong>{project.estimatedHours}</strong>
                </div>
                <div>
                  <Hammer />
                  <span>Difficulty</span>
                  <strong>{project.difficulty}</strong>
                </div>
                <div>
                  <Users />
                  <span>Recommended helpers</span>
                  <strong>2 people</strong>
                </div>
              </div>
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
                    Sample quantities and US prices. Verify against your
                    approved design.
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
                        </td>
                        <td>{m.quantity}</td>
                        <td>{money(m.unitCost)}</td>
                        <td>{money(m.unitCost * m.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="total">
                <span>Estimated sample materials total</span>
                <strong>
                  {money(
                    project.materials.reduce(
                      (s, m) => s + m.quantity * m.unitCost,
                      0,
                    ),
                  )}
                </strong>
              </div>
              <button className="primary" onClick={download}>
                <Download size={18} /> Save shopping list
              </button>
              <p className="muted">
                No retailer connection. Taxes, delivery, labor, permits, and
                site-specific changes are excluded.
              </p>
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
                <span className="badge">BUILD MODE · PREPARATION GUIDE</span>
                <strong>
                  {project.completed} / {project.steps.length} complete
                </strong>
              </div>
              <progress value={project.completed} max={project.steps.length} />
              {project.completed === project.steps.length ? (
                <div className="center">
                  <CheckCircle2 size={48} />
                  <h2>Your preparation guide is complete.</h2>
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
              <p>
                AI-generated plans may contain errors. This demo is not an
                AI-generated or certified plan. Consult a qualified professional
                for structural, electrical, plumbing, gas, excavation, and other
                permit-sensitive work.
              </p>
            </section>
          )}
          {tab === "Ask about my project" && (
            <section className="panel assistant">
              <h2>A little help along the way.</h2>
              <p>
                Ask about your project. Demo mode uses sample responses, not a
                live AI assistant.
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
                  disabled={asking || !question.trim()}
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
              <p>Saved in this browser, on this device. No account required.</p>
            </div>
            <button className="primary" onClick={() => start()}>
              <Plus size={20} /> New project
            </button>
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
                      {p.projectType} · DEMO CONCEPT
                    </span>
                    <h3>{p.title}</h3>
                    <p>
                      {money(p.estimatedCostLow)}–{money(p.estimatedCostHigh)}
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
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this project from this device?",
                          )
                        ) {
                          const next = saved.filter((s) => s.id !== p.id);
                          localStorage.setItem(
                            "buildly-projects",
                            JSON.stringify(next),
                          );
                          setSaved(next);
                        }
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
      <footer>
        <button className="logo" onClick={() => go("home")}>
          <span className="logo-mark">
            <House size={20} />
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
