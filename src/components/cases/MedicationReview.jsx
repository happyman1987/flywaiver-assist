import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { reviewMedications, flaggedMedications, LIST_EFFECTIVE } from "@/lib/medicationReview";

const FLAGS = {
  not_waiverable: { label: "Not waiverable", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  not_listed: { label: "Not on approved lists", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  waiver_required: { label: "Waiver required", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  on_list: { label: "On approved list", className: "bg-emerald-600 text-white hover:bg-emerald-600/90" },
};

export default function MedicationReview({ text }) {
  const items = useMemo(() => reviewMedications(text || ""), [text]);
  const flagged = flaggedMedications(items);
  if (!items.length) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Approved medication list review</p>
        <Badge variant="outline" className="text-xs font-normal">{items.length} checked</Badge>
      </div>

      <div className="space-y-2.5">
        {items.map((it, i) => (
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
              <p className="mt-1 text-xs text-muted-foreground">
                Not found on the aircrew, GBO, or OTC approved medication lists. Medications not on the list, singly or
                in combination, require review by AF/SG3P (rated officers) and MAJCOM/SG (non-rated personnel).
              </p>
            )}
          </div>
        ))}
      </div>

      {flagged.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {flagged.length} medication(s) need waiver action or list review — the Aeromedical Summary cites each one.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Checked against the AF approved medication lists: aircrew — {LIST_EFFECTIVE.aircrew}; GBO — {LIST_EFFECTIVE.gbo};
        OTC — {LIST_EFFECTIVE.otc}. Verify against the current list before the final disposition.
      </p>
    </div>
  );
}