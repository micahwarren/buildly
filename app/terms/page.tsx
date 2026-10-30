import { legal } from "@/lib/legal-content";
export default function Legal() {
  return (
    <main className="legal-page">
      <h1>Terms & Conditions</h1>
      {legal.terms.map((item, i) =>
        item.heading ? (
          <h2 key={i}>{item.text}</h2>
        ) : (
          <p key={i}>{item.text}</p>
        ),
      )}
    </main>
  );
}
