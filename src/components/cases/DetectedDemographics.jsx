import React from "react";
import { Button } from "@/components/ui/button";
import { Check, IdCard, RefreshCw } from "lucide-react";

const FIELDS = [
  { key: "member_name", label: "Member Name" },
  { key: "rank", label: "Rank" },
  { key: "unit", label: "Unit / Squadron" },
  { key: "dod_id", label: "DoD ID" },
  { key: "age", label: "Age" },
  { key: "sex", label: "Sex" }
];

// Records abbreviate rank ("Maj", "MSgt", "Capt"); the case stores the full rank name.
const RANK_ALIASES = {
  "2lt": "Second Lieutenant",
  "2d lt": "Second Lieutenant",
  "1lt": "First Lieutenant",
  "1st lt": "First Lieutenant",
  cpt: "Captain",
  capt: "Captain",
  maj: "Major",
  "lt col": "Lieutenant Colonel",
  ltcol: "Lieutenant Colonel",
  col: "Colonel",
  "brig gen": "Brigadier General",
  "maj gen": "Major General",
  "lt gen": "Lieutenant General",
  ltgen: "Lieutenant General",
  gen: "General",
  ab: "Airman Basic",
  amn: "Airman",
  a1c: "Airman First Class",
  sra: "Senior Airman",
  ssgt: "Staff Sergeant",
  tsgt: "Technical Sergeant",
  msgt: "Master Sergeant",
  smsgt: "Senior Master Sergeant",
  cmsgt: "Chief Master Sergeant",
  cpl: "Corporal (USSF)",
  pfc: "Private First Class (USSF)",
  pvt: "Private (USSF)"
};

const normalizeRank = (value) => {
  const raw = String(value || "").trim().replace(/\./g, "").replace(/\s+/g, " ");
  if (!raw) return "";
  return RANK_ALIASES[raw.toLowerCase()] || raw;
};

const sameValue = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

// The Age field is a number input, so a documented "28 years old" is reduced to its age in years —
// anything that is not an age (such as a date of birth) is left as documented.
const ageValue = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^\s*(\d{1,3})(?![0-9])/);
  return match && Number(match[1]) < 121 ? match[1] : raw;
};

// Member details the documents state, each applied to the case only when the clinician clicks it.
export default function DetectedDemographics({ detected, current, onApply, onApplyAll }) {
  const rows = FIELDS.map((field) => {
    const value = field.key === "rank"
      ? normalizeRank(detected?.[field.key])
      : field.key === "age"
        ? ageValue(detected?.[field.key])
        : String(detected?.[field.key] ?? "").trim();
    const currentValue = field.key === "rank" ? normalizeRank(current?.[field.key]) : current?.[field.key];
    return { ...field, value, applied: Boolean(value) && sameValue(currentValue, value) };
  }).filter((row) => row.value);

  if (!rows.length) return null;

  const pending = rows.filter((row) => !row.applied);

  return (
    <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IdCard className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Member details found in the documents</p>
        </div>
        {pending.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApplyAll(Object.fromEntries(pending.map((row) => [row.key, row.value])))}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Update All
          </Button>
        )}
      </div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{row.label}</span>
            <span className="flex-1 truncate text-sm font-medium" title={row.value}>{row.value}</span>
            {row.applied ? (
              <span className="flex items-center gap-1 pr-2 text-xs text-muted-foreground">
                <Check className="w-3.5 h-3.5" /> Applied
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onApply(row.key, row.value)}>
                Update
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Click Update to copy a detected value into the case.</p>
    </div>
  );
}