"use client";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteProjectDialog({
  title,
  cloud,
  onDelete,
  onClose,
}: {
  title: string;
  cloud: boolean;
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => element?.close();
  }, []);
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (await onDelete()) onClose();
      else setError("Couldn’t delete this project. Please try again.");
    } catch {
      setError("Couldn’t delete this project. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="delete-project-dialog"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="delete-project-icon">
        <Trash2 size={26} />
      </div>
      <h2 id="delete-project-title">Delete this project?</h2>
      <div className="delete-project-name">{title}</div>
      <p id="delete-project-description">
        {cloud
          ? "This removes the project from your account and this device."
          : "This removes the project from this device."}{" "}
        This can’t be undone.
      </p>
      {error && (
        <p className="delete-project-error" role="alert">
          {error}
        </p>
      )}
      <div className="delete-project-actions">
        <button
          ref={cancel}
          className="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? "Deleting…" : "Delete project"}
        </button>
      </div>
    </dialog>
  );
}
