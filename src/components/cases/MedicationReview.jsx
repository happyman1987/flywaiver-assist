import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { reviewMedications, flaggedMedications, listKeysForClass, LIST_LABELS, LIST_EFFECTIVE } from "@/lib/medicationReview";

const FLAGS = {
  not_waiverable: { label: "Not waiverable", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  not_listed: { label: "Not on approved lists", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  waiver_required: { label: "Waiver required", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  on_list: { label: "On approved list", className: "bg-emerald-600 text-white hover:bg-emerald-600/90" },
};

export default function MedicationReview({ text, flyingClass, annotations = {}, onAnnotate }) {
  const items = useMemo(() => reviewMedications(text || "", flyingClass), [text, flyingClass]);
  const flagged = flaggedMedications(items);
  if (!items.length) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Approved medication list review</p>
        <Badge variant="outline" className="text-xs font-normal">{items.length} checked</Badge>
      </div>

      <div className="space-y-3">
        {items.map((it, i) => {
          const annotation = annotations[it.medication] || "";
          return (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{it.medication}</span>
                <Badge className={`text-xs font-normal ${FLAGS[it.flag].className}`}>{FLAGS[it.flag].label}</Badge>
              </div>
              {it.matches.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {it.matches.map((m, j) => (
                    <li key={j}>
                      <span className="font-medium text-foreground">{m.list_label}</span> — {m.status_text}
                      {m.indication ? ` · Listed for: ${m.indication}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Not found on the approved medication lists that apply to this flying class — review this medication
                    and annotate your determination.
                  </p>
                  {onAnnotate ? (
                    <Textarea
                      rows={2}
                      value={annotation}
                      onChange={(e) => onAnnotate(it.medication, e.target.value)}
                      placeholder="Your determination for this medication (cited in the Aeromedical Summary)"
                      className="text-xs"
                    />
                  ) : annotation ? (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Determination: </span>
                      {annotation}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
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