export async function loadStateWhenRevisionChanges(knownRevision) {
  const revisionResponse = await fetch("/api/state/revision", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!revisionResponse.ok) return { revision: knownRevision, db: null };

  const revisionPayload = await revisionResponse.json();
  const revision = Number(revisionPayload.revision);
  if (!Number.isFinite(revision) || revision === knownRevision) {
    return { revision: knownRevision, db: null };
  }

  const stateResponse = await fetch("/api/state", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!stateResponse.ok) return { revision: knownRevision, db: null };
  const statePayload = await stateResponse.json();
  return { revision: Number(statePayload.revision ?? revision), db: statePayload.db ?? null };
}
