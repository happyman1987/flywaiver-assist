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
  "then|in|and|or|with|the|of|for|a|an|to|per|by|mouth|topical|oral|inhaled|nasal|ophthalmic|otic|dermal)$"
);

// A fragment opens a medication entry only if it starts with a name or a dose. Directions that merely
// continue the entry above them — "then 50 mg PO daily in month 2", "increased to 100 mg",
// "discontinued in month 4" — and narrative sentences are not medications of their own.
const FIRST_WORD_SKIP = new Set([
  "he", "she", "they", "we", "his", "her", "their", "the", "patient", "member", "reported", "reports",
  "report", "denies", "denied", "describes", "states", "notes", "noted", "continued", "continues",
  "discontinued", "initiated", "started", "stopped", "held", "increased", "decreased", "titrated",
  "adjusted", "reduced", "maintained", "switched", "changed", "added", "renewed", "transferred", "then",
  "and", "also", "after", "afterwards", "thereafter", "subsequently", "followed", "next", "for", "at",
  "by", "with", "without", "per", "due", "as", "when", "if", "prn", "no", "not", "never", "max",
  "maximum", "minimum", "dose", "dosing", "dosage", "therapy", "up", "down",
]);

const DOSE_UNIT = /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:mg|mcg|gm?|ml|cc|iu|units?|tabs?|tablets?|caps?|capsules?|puffs?|drops?|sprays?|patch(?:es)?|suppositor(?:y|ies))\b/i;

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

// Medication names a provider may write, one per line / after a comma or semicolon. Only fragments
// that open a medication survive, so dose instructions such as "then 50 mg PO daily in month 2" stay
// part of the medication they belong to instead of being reviewed as one of their own.
export function splitMedications(text) {
  return String(text || "")
    .split(/[\n\r;,]+|\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((fragment) => {
      const norm = normalizeMedication(fragment);
      if (norm.length < 4 || !/[a-z]{3}/.test(norm)) return false;
      const words = norm.split(" ").filter(Boolean);
      if (FIRST_WORD_SKIP.has(words[0])) return false;
      // Named on the approved lists, or written with its dose up front.
      if (words.some((w) => w.length >= 5 && NAME_WORDS.has(w))) return true;
      return DOSE_UNIT.test(fragment.split(/\s+/).slice(0, 6).join(" "));
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

// Every name the approved lists know, used to recognise a documented medication even when its dose
// is not written on the same line.
const NAME_WORDS = new Set(
  INDEX.flatMap((list) => list.entries.flatMap(({ aliases }) => aliases.flatMap((a) => a.split(" "))))
    .filter((w) => w.length >= 5)
);

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
// flight surgeon's own annotation, when one has been written for them, and a medication the lists
// place under a waiver requirement carries the flight surgeon's documentation of whether that waiver
// should be granted for its use. A medication reconciled out of the member's current regimen is
// dropped from the package — the summary never lists or cites it.
export function medicationReviewSummary(items, annotations = {}, flyingClass, removed = [], waiverJustifications = {}) {
  const removedNames = new Set((removed || []).map((r) => r.medication));
  const current = items.filter((it) => !removedNames.has(it.medication));
  if (!current.length) return "";
  const appliedLists = listKeysForClass(flyingClass).map((k) => LIST_LABELS[k]).join(" / ");
  const lines = current
    .map((it) => {
      const annotation = String(annotations[it.medication] || "").trim();
      if (!it.matches.length) {
        return `- ${it.medication}: not found on the approved medication lists that apply to this flying class (${appliedLists}).${annotation ? ` Flight surgeon's review of this medication: ${annotation}` : " Reviewed by the flight surgeon with no annotation recorded."}`;
      }
      const line = `- ${it.medication}: ${it.matches.map((m) => `${m.list_label} — ${m.status_text}`).join("; ")}`;
      const justification = String(waiverJustifications[it.medication] || "").trim();
      return it.flag === "waiver_required" && justification
        ? `${line}. Flight surgeon's documentation of whether the waiver should be granted for this medication's use: ${justification}`
        : line;
    })
    .join("\n");
  return lines;
}

export function flaggedMedications(items) {
  return items.filter((it) => it.flag === "not_listed" || it.flag === "not_waiverable" || it.flag === "waiver_required");
}