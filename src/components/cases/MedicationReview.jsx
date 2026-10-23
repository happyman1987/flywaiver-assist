import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import MedicationRow from "@/components/cases/MedicationRow";
import { reviewMedications, flaggedMedications, listKeysForClass, LIST_LABELS, LIST_EFFECTIVE } from "@/lib/medicationReview";

// The approved-medication-list review for the member's flying class. When removal handlers are given,
// a medication can be reconciled out of the package (single dose, completed course, emergency use).
export default function MedicationReview({ text, flyingClass, removed = [], annotations = {}, waiverJustifications = {}, onAnnotate, onJustify, onRemove, onRestore, onReason, onSave, hideRemoved = false }) {
  const items = useMemo(() => reviewMedications(text || "", flyingClass), [text, flyingClass]);
  const removedByName = useMemo(() => Object.fromEntries((removed || []).map((r) => [r.medication, r])), [removed]);
  const current = items.filter((it) => !removedByName[it.medication]);
  const flagged = flaggedMedications(current);
  if (!items.length) return null;
  // The package itself carries only the medications still on the member's regimen: reconciled-out
  // medications are not shown at all.
  const shown = hideRemoved ? current : items;
  if (!shown.length) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Approved medication list review</p>
        <Badge variant="outline" className="text-xs font-normal">
          {hideRemoved ? `${current.length} current medication${current.length === 1 ? "" : "s"}` : `${current.length} of ${items.length} current`}
        </Badge>
      </div>

      <div className="space-y-3">
        {shown.map((it, i) => (
          <MedicationRow
            key={i}
            item={it}
            removed={removedByName[it.medication]}
            annotation={annotations[it.medication] || ""}
            justification={waiverJustifications[it.medication] || ""}
            onAnnotate={onAnnotate}
            onJustify={onJustify}
            onRemove={onRemove}
            onRestore={onRestore}
            onReason={onReason}
            onSave={onSave}
          />
        ))}
      </div>

      {flagged.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {flagged.length} medication(s) to review — the Aeromedical Summary cites each one.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Checked against the AF approved medication lists for this duty:{" "}
        {listKeysForClass(flyingClass).map((k) => `${LIST_LABELS[k]} — ${LIST_EFFECTIVE[k]}`).join("; ")}. Verify against
        the current list before the final disposition.
      </p>
    </div>
  );
}