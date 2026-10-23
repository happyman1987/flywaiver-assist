import MEDICATION_LISTS from "@/lib/medicationLists.json";

export const LIST_KEYS = ["aircrew", "gbo", "otc"];

export const LIST_LABELS = {
  aircrew: "Aircrew — manned platforms and ATC",
  gbo: "Ground Based Operator (GBO)",
  otc: "Over-the-counter (no flight surgeon approval)",
};

export const LIST_EFFECTIVE = Object.fromEntries(LIST_KEYS.map((k) => [k, MEDICATION_LISTS[k].effective]));

// The approved-medication lists are duty specific: the aircrew list governs flying duties and ATC,
// the GBO list governs ground based operators, and the OTC list applies to everyone. Only the lists
// that govern the member's flying class are consulted, so a requirement belonging to another duty is
// never shown for a member it does not apply to.
const AIRCREW_CLASSES = ["FC-I", "FC-II", "FC-III", "ATC"];

export function listKeysForClass(flyingClass) {
  const duty = String(flyingClass || "").trim().toUpperCase();
  if (duty === "GBO") return ["gbo", "otc"];
  if (AIRCREW_CLASSES.includes(duty)) return ["aircrew", "otc"];
  return LIST_KEYS;
}

export const STATUS_LABELS = {
  no_down_status_required: "No DOWN status required",
  ground_trial: "DOWN status not required after ground trial",
  symptoms_controlled_no_side_effects: "DOWN status not required once symptoms controlled, no side effects",
  waiver_required: "Waiver required",
  waiver_required_flying_1_2: "Waiver required — Flying I/II",
  waiver_required_flying_3: "Waiver required — Flying III",
  waiver_required_flying_3_atc: "Waiver required — Flying III / ATC",
  not_waiverable: "Not waiverable",
};

const DOSE_WORDS = new RegExp(
  "^(mg|mcg|gm?|ml|cc|iu|units?|tabs?|caps?|puffs?|drops?|sprays?|po|iv|im|prn|qd|qhs|bid|tid|qid|q\\d+h|" +
  "daily|nightly|morning|evening|weekly|monthly|once|twice|thrice|three|four|times|every|hours?|days?|weeks?|months?|" +
  "as|when|if|needed|necessary|required|take|takes|taken|taking|use|uses|using|used|currently|current|started|stopped|" +
  "and|or|with|the|of|for|a|an|to|per|by|mouth|topical|oral|inhaled|nasal|ophthalmic|otic|dermal)$"
);

const NOISE_ALIASES = new Set([
  "topical", "oral", "ophthalmic", "otic", "nasal", "dermal", "injectable", "inhaled", "inhaler",
  "gel", "gels", "cream", "creams", "ointment", "solution", "suspension", "tablet", "tablets",
  "capsule", "capsules", "generic", "form", "only", "agents", "agent", "derivatives", "derivative",
  "complexed", "alone", "metered-dose", "controlled", "release", "extended", "preparation", "preparations",
]);

// "Ibuprofen 400 mg TID, taken as needed" → "ibuprofen"
export const normalizeMedication = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9%./\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DOSE_WORDS.test(w) && !/^\d+([./-]\d+)?%?$/.test(w))
    .join(" ")
    .trim();

// Medication names a provider may write, one per line / after a comma or semicolon.
export function splitMedications(text) {
  return String(text || "")
    .split(/[\n\r;,]+/)
    .map((s) => s.trim())
    .filter((s) => {
      const n = normalizeMedication(s);
      return n.length >= 4 && /[a-z]{3}/.test(n);
    });
}

const aliasesFor = (entry) => {
  const parts = [];
  const push = (s) => {
    String(s || "")
      .split(/[(),;/]+/)
      .forEach((p) => parts.push(p));
  };
  push(entry.generic);
  parts.push(entry.generic.replace(/\([^)]*\)/g, " "));
  (entry.trade || "").split(/[,;/]+/).forEach((t) => {
    parts.push(t);
    t.split(/\s+/).forEach((w) => parts.push(w));
  });
  const out = new Set();
  for (const part of parts) {
    const a = normalizeMedication(part);
    if (a.length >= 5 && !NOISE_ALIASES.has(a)) out.add(a);
    a.split(" ").forEach((w) => {
      if (w.length >= 6 && !NOISE_ALIASES.has(w)) out.add(w);
    });
  }
  return [...out].sort((a, b) => b.length - a.length);
};

const INDEX = LIST_KEYS.map((key) => ({
  key,
  label: LIST_LABELS[key],
  entries: MEDICATION_LISTS[key].medications.map((entry) => ({ entry, aliases: aliasesFor(entry) })),
}));

const matchesName = (norm, alias) => {
  if (!norm || !alias) return false;
  if (norm === alias) return true;
  if (norm.includes(alias)) return true;
  if (alias.split(" ").every((w) => norm.split(" ").includes(w))) return true;
  return false;
};

const statusText = (statuses) =>
  statuses.length ? statuses.map((s) => STATUS_LABELS[s] || s).join("; ") : "on the list, no disposition column marked";

const flagFor = (matches) => {
  if (matches.some((m) => m.statuses.includes("not_waiverable"))) return "not_waiverable";
  if (matches.some((m) => m.statuses.some((s) => s.startsWith("waiver_required")))) return "waiver_required";
  if (!matches.length) return "not_listed";
  return "on_list";
};

// Every medication the case documents is checked against the approved-medication lists that govern
// the member's flying class.
export function reviewMedications(text, flyingClass) {
  const lists = INDEX.filter((l) => listKeysForClass(flyingClass).includes(l.key));
  return splitMedications(text).map((medication) => {
    const norm = normalizeMedication(medication);
    const matches = [];
    for (const list of lists) {
      for (const { entry, aliases } of list.entries) {
        if (!aliases.some((a) => matchesName(norm, a))) continue;
        if (matches.some((m) => m.list === list.key && m.generic === entry.generic)) continue;
        matches.push({
          list: list.key,
          list_label: list.label,
          category: entry.category,
          generic: entry.generic,
          trade: entry.trade,
          indication: entry.indication,
          statuses: entry.statuses,
          status_text: statusText(entry.statuses),
          notes: entry.notes,
        });
      }
    }
    return {
      medication,
      normalized: norm,
      matches,
      flag: flagFor(matches),
      status_text: matches.length ? matches.map((m) => `${LIST_LABELS[m.list]} — ${m.status_text}`).join("; ") : "not on the approved medication lists",
    };
  });
}

// Compact review the narrative is asked to cite. Medications that are not on any list carry the
// flight surgeon's own annotation, when one has been written for them.
export function medicationReviewSummary(items, annotations = {}, flyingClass, removed = []) {
  const removedNames = new Set((removed || []).map((r) => r.medication));
  const current = items.filter((it) => !removedNames.has(it.medication));
  const excluded = (removed || []).map(
    (r) => `- ${r.medication}: documented in the record but reconciled out of the member's current regimen${r.reason ? ` — ${r.reason}` : ""}.`
  );
  if (!current.length && !excluded.length) return "";
  const appliedLists = listKeysForClass(flyingClass).map((k) => LIST_LABELS[k]).join(" / ");
  const lines = current
    .map((it) => {
      const annotation = String(annotations[it.medication] || "").trim();
      if (!it.matches.length) {
        return `- ${it.medication}: not found on the approved medication lists that apply to this flying class (${appliedLists}).${annotation ? ` Flight surgeon's review of this medication: ${annotation}` : " Reviewed by the flight surgeon with no annotation recorded."}`;
      }
      return `- ${it.medication}: ${it.matches.map((m) => `${m.list_label} — ${m.status_text}`).join("; ")}`;
    })
    .join("\n");
  const excludedBlock = excluded.length
    ? `EXCLUDED AT MEDICATION RECONCILIATION (documented in the record, but NOT part of the member's current regimen — do not report these as current medications and do not cite an approved-list disposition or a waiver requirement for them; state that they were reconciled out, with the reason given):\n${excluded.join("\n")}`
    : "";
  return [lines, excludedBlock].filter(Boolean).join("\n");
}

export function flaggedMedications(items) {
  return items.filter((it) => it.flag === "not_listed" || it.flag === "not_waiverable" || it.flag === "waiver_required");
}