"use client";
/* eslint-disable @next/next/no-img-element */
import { Camera, Plus, ArrowRight, FolderOpen, Hammer } from "lucide-react";
import { useState } from "react";
import type { Project } from "@/lib/project";
export function NativeHome({
  projects,
  start,
  open,
  remove,
  resume,
}: {
  projects: Project[];
  start: () => void;
  open: (p: Project) => void;
  remove: (p: Project) => void;
  resume?: () => void;
}) {
  return (
    <main className="native-dashboard">
      <div className="native-welcome">
        <span className="eyebrow">YOUR NEXT GREAT IDEA</span>
        <h1>My projects</h1>
        <p>A little vision. Something you made.</p>
      </div>
      <button className="native-create" onClick={start}>
        <span className="native-create-icon">
          <Plus size={28} />
        </span>
        <span>
          <strong>Start a project</strong>
          <small>Turn your space into a plan</small>
        </span>
        <ArrowRight size={22} />
      </button>
      {resume && (
        <button className="native-resume" onClick={resume}>
          Continue your draft <ArrowRight size={18} />
        </button>
      )}
      <div className="native-section-title">
        <h2>Your workspace</h2>
        <span>{projects.length} projects</span>
      </div>
      {!projects.length ? (
        <section className="native-empty">
          <FolderOpen size={42} />
          <h2>Make room for your first idea.</h2>
          <p>Start with a photo. We’ll guide you from there.</p>
          <button className="primary" onClick={start}>
            Create my first project
          </button>
        </section>
      ) : (
        <div className="native-projects">
          {projects.map((p) => (
            <article key={p.id} className="native-project-card">
              <button className="native-project-open" onClick={() => open(p)}>
                <img src={p.generatedImage || p.originalImage} alt={p.title} />
                <span>
                  <small>{p.projectType}</small>
                  <strong>{p.title}</strong>
                  <small>
                    {p.steps.length
                      ? `${p.completed} of ${p.steps.length} steps complete`
                      : "Design saved · plan pending"}
                  </small>
                </span>
                <ArrowRight size={20} />
              </button>
              <button
                className="text-button"
                onClick={() => remove(p)}
                aria-label={`Remove ${p.title}`}
              >
                Remove project
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
const tips = [
  {
    icon: Camera,
    title: "Start with your space.",
    text: "Take a clear photo or pick one from your library. Include the whole area you want to change.",
  },
  {
    icon: Plus,
    title: "Tell us your idea.",
    text: "Describe what you want to build, then add measurements and your preferences.",
  },
  {
    icon: Hammer,
    title: "Make it yours.",
    text: "Review your design, materials and steps. Your projects stay in your account so you can come back anytime.",
  },
];
export function FirstProjectGuide({ finish }: { finish: () => void }) {
  const [step, setStep] = useState(0);
  const tip = tips[step];
  const Icon = tip.icon;
  return (
    <main className="native-tutorial">
      <span className="eyebrow">YOUR FIRST PROJECT</span>
      <div className="tutorial-art">
        <Icon size={76} strokeWidth={1.4} />
      </div>
      <div className="tutorial-dots" aria-label={`Step ${step + 1} of 3`}>
        {tips.map((_, i) => (
          <span key={i} className={step === i ? "active" : ""} />
        ))}
      </div>
      <h1>{tip.title}</h1>
      <p>{tip.text}</p>
      <button
        className="primary"
        onClick={() => (step === 2 ? finish() : setStep(step + 1))}
      >
        {step === 2 ? "Add my photo" : "Next"}
        <ArrowRight size={20} />
      </button>
      {step > 0 && (
        <button className="text-button" onClick={() => setStep(step - 1)}>
          Back
        </button>
      )}
      <button className="text-button" onClick={finish}>
        Skip tutorial
      </button>
    </main>
  );
}
