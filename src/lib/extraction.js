// Shared handling of an extraction result from a medical record or a previous waiver.

const normalize = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Adds extracted history text to a field without duplicating what is already recorded there.
export function appendHistory(existing, addition) {
  const current = (existing || "").trim();
  const extra = (addition || "").trim();
  if (!extra) return current;
  if (!current) return extra;
  if (normalize(current).includes(normalize(extra))) return current;
  return `${current}\n\n${extra}`;
}

export function extractedConditions(ext) {
  return (Array.isArray(ext?.conditions) ? ext.conditions : [])
    .filter((c) => c && c.diagnosis)
    .map((c) => ({ diagnosis: c.diagnosis, category: c.category || "" }));
}

// Extracted diagnoses are appended; clinical fields already on the case are kept.
export function mergeExtraction(form, ext = {}) {
  const newConditions = extractedConditions(ext);
  const existing = (form.conditions || []).filter((c) => c.diagnosis || c.category);
  const merged = newConditions.length ? [...existing, ...newConditions] : existing;
  const conditions = merged.length ? merged : [{ diagnosis: "", category: "" }];
  return {
    conditions,
    diagnosis: conditions[0]?.diagnosis || form.diagnosis || "",
    category: conditions[0]?.category || form.category || "",
    history: form.history || ext.history || "",
    diagnostics: form.diagnostics || ext.diagnostics || "",
    medications: form.medications || ext.medications || "",
    treatment_course: form.treatment_course || ext.treatment_course || "",
    current_status: form.current_status || ext.current_status || ""
  };
}