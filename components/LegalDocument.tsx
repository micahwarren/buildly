import { legal } from "@/lib/legal-content";
export function LegalDocument({ kind }: { kind: keyof typeof legal }) {
  const items = legal[kind];
  const sections: { title: string; text: string[] }[] = [];
  for (const p of items.slice(1)) {
    if (p.heading) sections.push({ title: p.text, text: [] });
    else sections[sections.length - 1]?.text.push(p.text);
  }
  const summary =
    kind === "privacy"
      ? [
          "Private projects, not a public gallery",
          "AI uses your photos with your permission",
          "Delete your account in Settings",
        ]
      : kind === "refunds"
        ? [
            "Request App Store refunds through Apple",
            "Missing tokens? Contact support",
            "Your consumer rights still apply",
          ]
        : [
            "1 token = 1 project · no subscription",
            "AI plans need on-site verification",
            "Your consumer rights still apply",
          ];
  return (
    <main className="legal-document">
      <header>
        <span className="legal-brand">SITE AI</span>
        <h1>
          {
            {
              privacy: "Privacy Policy",
              terms: "Terms & Conditions",
              refunds: "Refund Policy",
            }[kind]
          }
        </h1>
        <p className="legal-date">
          Updated {/^Last updated ([^.]+)\./.exec(items[0].text)?.[1]} · Nom
          Apps LLC
        </p>
      </header>
      <aside className="legal-summary">
        <h2>{kind === "privacy" ? "Privacy at a glance" : "The essentials"}</h2>
        <ul>
          {summary.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {kind === "refunds" ? (
          <a
            href="https://reportaproblem.apple.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Request a refund through Apple
          </a>
        ) : null}
      </aside>
      <p className="legal-intro">
        {items[0].text.replace(/^Last updated [^.]+\.\s*/, "")}
      </p>
      {sections.map((x, i) => (
        <section key={x.title}>
          <h2>
            <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            {x.title}
          </h2>
          {x.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
      ))}
      <footer>
        <a href="/privacy">Privacy</a>
        {" · "}
        <a href="/terms">Terms</a>
        {" · "}
        <a href="/refunds">Refunds</a>
        <br />
        Questions?{" "}
        <a href="mailto:support@nomappsllc.com">support@nomappsllc.com</a>
      </footer>
    </main>
  );
}
