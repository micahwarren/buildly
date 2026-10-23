import { useState } from "react";
import type { Material, Project } from "@/lib/project";
import {
  shoppingLine,
  safeProductUrl,
  type ShoppingEntry,
} from "@/lib/shopping";
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
function ShoppingRow({
  material,
  entry,
  onSave,
}: {
  material: Material;
  entry?: ShoppingEntry;
  onSave: (value: ShoppingEntry) => void;
}) {
  const [label, setLabel] = useState(
    entry?.packageLabel || material.purchase?.label || "",
  );
  const [coverage, setCoverage] = useState(
    String(entry?.coverage ?? material.purchase?.coverage ?? ""),
  );
  const [price, setPrice] = useState(
    entry?.price == null ? "" : String(entry.price),
  );
  const [supplier, setSupplier] = useState(entry?.supplier || "");
  const [url, setUrl] = useState(entry?.url || "");
  const [error, setError] = useState("");
  const line = shoppingLine(material, entry);
  const query = encodeURIComponent(material.item);
  return (
    <article className="shopping-item">
      <h3>{material.item}</h3>
      <p>
        Need: {material.quantity || "Verify"}{" "}
        {material.quantityUnit || material.dimensions}
      </p>
      <p>
        <strong>
          Suggested purchase: {line.count ?? "Verify quantity"} × {line.label}
        </strong>
      </p>
      {material.purchase?.notes && <p>{material.purchase.notes}</p>}
      <p>
        <a
          href={`https://www.homedepot.com/s/${query}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Search Home Depot
        </a>
        {" · "}
        <a
          href={`https://www.lowes.com/search?searchTerm=${query}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Search Lowe’s
        </a>
      </p>
      <details>
        <summary>Select package and record a quote</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !label.trim() ||
              !Number.isFinite(+coverage) ||
              +coverage <= 0 ||
              +coverage > 1000000 ||
              (price !== "" &&
                (!Number.isFinite(+price) || +price < 0 || +price > 1000000)) ||
              !safeProductUrl(url.trim())
            ) {
              setError(
                "Enter a package label, positive coverage, valid price and an HTTPS product link (or leave the link blank).",
              );
              return;
            }
            setError("");
            onSave({
              item: material.item,
              packageLabel: label.trim(),
              coverage: +coverage,
              price: price === "" ? null : +price,
              supplier: supplier.trim(),
              url: url.trim(),
              purchased: entry?.purchased || false,
              updatedAt: new Date().toISOString(),
            });
          }}
        >
          <label className="field">
            Package / stock size
            <input
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="For example, 100-count box"
            />
          </label>
          <label className="field">
            Coverage per package (
            {material.quantityUnit || "same units as required quantity"})
            <input
              type="number"
              min="0.001"
              max="1000000"
              step="any"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            />
          </label>
          <label className="field">
            Your price per package (USD)
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="field">
            Supplier
            <input
              maxLength={200}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </label>
          <label className="field">
            Product link (optional)
            <input
              type="url"
              maxLength={2000}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="secondary" type="submit">
            Save package and quote
          </button>
        </form>
      </details>
      {entry && (
        <div>
          <p>
            Your quoted line total:{" "}
            <strong>
              {line.total === null ? "Not priced" : money(line.total)}
            </strong>
            {entry.supplier ? ` · ${entry.supplier}` : ""}
          </p>
          <small>
            Quote entered by you on{" "}
            {new Date(entry.updatedAt).toLocaleDateString()}; availability and
            price may change.
          </small>
          {entry.url && safeProductUrl(entry.url) && (
            <p>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                Open selected product
              </a>
            </p>
          )}
          <label className="tool">
            <input
              type="checkbox"
              checked={entry.purchased}
              onChange={(e) =>
                onSave({ ...entry, purchased: e.target.checked })
              }
            />{" "}
            Purchased {material.item}
          </label>
        </div>
      )}
    </article>
  );
}
export function ShoppingList({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const lines = project.materials.map((material) =>
    shoppingLine(
      material,
      project.shopping?.find((entry) => entry.item === material.item),
    ),
  );
  const quoted = lines.filter((line) => line.total !== null);
  return (
    <section className="shopping-list">
      <h2>Turn the list into a shopping trip</h2>
      <p>
        Suggested packages are estimates, not a cutting plan. Verify sizes,
        spans, treatment and connector compatibility before buying. Search links
        open retailer results; prices below come from quotes you enter.
      </p>
      <p>
        <strong>
          Your quoted subtotal:{" "}
          {quoted.length
            ? money(quoted.reduce((sum, line) => sum + line.total!, 0))
            : "No quotes yet"}
        </strong>{" "}
        · {quoted.length} of {lines.length} items priced. Tax, delivery and
        unpriced items are additional.
      </p>
      {project.materials.map((material) => (
        <ShoppingRow
          key={material.item}
          material={material}
          entry={project.shopping?.find(
            (entry) => entry.item === material.item,
          )}
          onSave={(entry) =>
            onChange({
              ...project,
              shopping: [
                ...(project.shopping || []).filter(
                  (previous) => previous.item !== entry.item,
                ),
                entry,
              ],
            })
          }
        />
      ))}
    </section>
  );
}
