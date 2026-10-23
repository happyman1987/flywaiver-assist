import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, X } from "lucide-react";

const FLAGS = {
  not_waiverable: { label: "Not waiverable", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  not_listed: { label: "Not on approved lists", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
  waiver_required: { label: "Waiver required", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  on_list: { label: "On approved list", className: "bg-emerald-600 text-white hover:bg-emerald-600/90" },
};

export default function MedicationRow({ item, removed, annotation = "", justification = "", onAnnotate, onJustify, onRemove, onRestore, onReason, onSave }) {
  const isRemoved = !!removed;

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={isRemoved ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.medication}</span>
        {isRemoved ? (
          <Badge variant="secondary" className="text-xs font-normal">Removed from the package</Badge>
        ) : (
          <Badge className={`text-xs font-normal ${FLAGS[item.flag].className}`}>{FLAGS[item.flag].label}</Badge>
        )}
        <span className="ml-auto">
          {isRemoved && onRestore && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onRestore(item.medication)}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
            </Button>
          )}
          {!isRemoved && onRemove && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.medication)}>
              <X className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          )}
        </span>
      </div>

      {isRemoved ? (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Left out of the waiver package — not cited in the Aeromedical Summary as a current medication.
          </p>
          {onReason ? (
            <Input
              value={removed.reason || ""}
              onChange={(e) => onReason(item.medication, e.target.value)}
              onBlur={onSave}
              placeholder="Reason (e.g. single dose, completed course, given in the emergency department)"
              className="h-8 text-xs"
            />
          ) : removed.reason ? (
            <p className="text-xs"><span className="text-muted-foreground">Reason: </span>{removed.reason}</p>
          ) : null}
        </div>
      ) : item.matches.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {item.matches.map((m, j) => (
            <li key={j}>
              <span className="font-medium text-foreground">{m.list_label}</span> — {m.status_text}
              {m.indication ? ` · Listed for: ${m.indication}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Not found on the approved medication lists that apply to this flying class — review this medication and document
            your determination, including whether a waiver should be granted for its use.
          </p>
          {onAnnotate ? (
            <Textarea
              rows={2}
              value={annotation}
              onChange={(e) => onAnnotate(item.medication, e.target.value)}
              onBlur={onSave}
              placeholder="e.g. Not listed for this duty — no aeromedically significant side effects; recommend a waiver be granted (cited in the Aeromedical Summary)"
              className="text-xs"
            />
          ) : annotation ? (
            <p className="text-xs"><span className="text-muted-foreground">Determination: </span>{annotation}</p>
          ) : null}
        </div>
      )}

      {!isRemoved && item.flag === "waiver_required" && (onJustify || justification) && (
        <div className="mt-1.5 space-y-1.5">
          {onJustify ? (
            <>
              <p className="text-xs text-muted-foreground">
                This medication requires a waiver for this duty. Document whether the waiver should be granted for its use.
              </p>
              <Textarea
                rows={2}
                value={justification}
                onChange={(e) => onJustify(item.medication, e.target.value)}
                onBlur={onSave}
                placeholder="e.g. Stable on this medication for six months with no aeromedically significant side effects — recommend the waiver be granted"
                className="text-xs"
              />
            </>
          ) : (
            <p className="text-xs"><span className="text-muted-foreground">Waiver documentation: </span>{justification}</p>
          )}
        </div>
      )}
    </div>
  );
}