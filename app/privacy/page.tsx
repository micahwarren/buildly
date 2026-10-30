import { legal } from "@/lib/legal-content";
export default function Legal() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      {legal.privacy.map((item, i) =>
        item.heading ? (
          <h2 key={i}>{item.text}</h2>
        ) : (
          <p key={i}>{item.text}</p>
        ),
      )}
    </main>
  );
}
