import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLog";
import LogoutButton from "@/components/LogoutButton";
import MedicationReview from "@/components/cases/MedicationReview";
import { medicationReviewSummary, reviewMedications, splitMedications } from "@/lib/medicationReview";

export default function MissingInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justifications, setJustifications] = useState({});
  const [removed, setRemoved] = useState([]);
  const [annotations, setAnnotations] = useState({});
  // Mirrors of the reconciliation state, so a save triggered from a blur always writes what is on screen.
  const removedRef = useRef([]);
  const annotationsRef = useRef({});
  const saveTimerRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rec = await base44.entities.WaiverCase.get(id);
        setC(rec);
        const map = {};
        (rec.missing_info || []).forEach((m, i) => {
          map[i] = rec.missing_justifications?.find((j) => j.item === m.item)?.justification || "";
        });
        setJustifications(map);
        setRemoval(rec.removed_medications || []);
        annotationsRef.current = Object.fromEntries((rec.medication_annotations || []).map((a) => [a.medication, a.annotation || ""]));
        setAnnotations(annotationsRef.current);
      } catch (e) {
        toast({ title: "Case not found", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Reconciled medications and annotations are stored on the case as they are made, so the package
  // keeps the flight surgeon's decisions even if the summary is generated later.
  const persistReconciliation = async () => {
    try {
      await base44.entities.WaiverCase.update(id, {
        removed_medications: removedRef.current,
        medication_annotations: Object.entries(annotationsRef.current)
          .filter(([, v]) => String(v || "").trim())
          .map(([medication, annotation]) => ({ medication, annotation }))
      });
    } catch (e) {
      toast({ title: "Could not save the medication reconciliation", variant: "destructive" });
    }
  };

  const setRemoval = (next) => {
    removedRef.current = next;
    setRemoved(next);
  };

  const removeMedication = (medication) => {
    setRemoval([...removedRef.current.filter((r) => r.medication !== medication), { medication, reason: "" }]);
    persistReconciliation();
  };

  const restoreMedication = (medication) => {
    setRemoval(removedRef.current.filter((r) => r.medication !== medication));
    persistReconciliation();
  };

  // Typed entries are saved shortly after typing stops, so a reason or a determination is kept even
  // when the field is left without a blur.
  const queueReconciliationSave = () => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistReconciliation, 900);
  };

  const setRemovalReason = (medication, reason) => {
    setRemoval(removedRef.current.map((r) => (r.medication === medication ? { ...r, reason } : r)));
    queueReconciliationSave();
  };

  const updateAnnotation = (medication, annotation) => {
    annotationsRef.current = { ...annotationsRef.current, [medication]: annotation };
    setAnnotations(annotationsRef.current);
    queueReconciliationSave();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const items = c.missing_info || [];
      const missing_justifications = items.map((m) => ({
        item: m.item,
        justification: justifications[items.findIndex((x) => x.item === m.item)] || ""
      }));
      const medication_annotations = Object.entries(annotationsRef.current)
        .filter(([, v]) => String(v || "").trim())
        .map(([medication, annotation]) => ({ medication, annotation }));
      await base44.entities.WaiverCase.update(id, { missing_justifications, removed_medications: removedRef.current, medication_annotations });
      const payload = {
        ...c,
        age: c.age ?? null,
        diagnosis: c.conditions?.[0]?.diagnosis || c.diagnosis,
        category: c.conditions?.[0]?.category || c.category,
        missing_justifications,
        removed_medications: removedRef.current,
        medication_review: medicationReviewSummary(
          reviewMedications(c.medications, c.flying_class),
          annotationsRef.current,
          c.flying_class,
          removedRef.current
        )
      };
      const res = await base44.functions.invoke("GenerateNarrative", payload);
      const narrative = res.data?.narrative;
      if (!narrative) throw new Error("No narrative returned");
      await base44.entities.WaiverCase.update(id, { narrative, status: "generated" });
      logAuditEvent("narrative_generated", id, c.member_name);
      toast({ title: "Aeromedical Summary generated" });
      navigate(`/cases/${id}`);
    } catch (err) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!c) return null;
  const items = c.missing_info || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${id}/edit`)}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Edit</Button>
          <p className="text-sm font-medium">Pre-Generation Review</p>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Missing information detected</p>
              <p className="text-amber-800">The USAF waiver guide requires or recommends the following for this case. Document why each item is not available, or go back and add it before generating the summary.</p>
            </div>
          </CardContent>
        </Card>

        {splitMedications(c.medications).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Medication reconciliation</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Confirm every medication the record lists is part of the member's current regimen. Remove any that was a
                single dose or a completed short course, is no longer being taken, or was given in an emergency setting —
                removed medications are left out of the summary.
              </p>
            </CardHeader>
            <CardContent>
              <MedicationReview
                text={c.medications}
                flyingClass={c.flying_class}
                removed={removed}
                annotations={annotations}
                onAnnotate={updateAnnotation}
                onRemove={removeMedication}
                onRestore={restoreMedication}
                onReason={setRemovalReason}
                onSave={persistReconciliation}
              />
            </CardContent>
          </Card>
        )}

        {items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No missing information was detected. You can generate the summary.</CardContent></Card>
        ) : items.map((m, i) => (
          <Card key={i}>
            <CardHeader className="flex-row justify-between items-start">
              <div>
                <CardTitle className="text-base">{m.item}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{m.requirement}</p>
              </div>
              <Badge variant={m.severity === "required" ? "destructive" : "secondary"} className="capitalize shrink-0">{m.severity}</Badge>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                placeholder="Document why this information is not in the package (e.g. 'Pending cardiology consult scheduled 2026-11-01')"
                value={justifications[i] || ""}
                onChange={(e) => setJustifications((j) => ({ ...j, [i]: e.target.value }))}
              />
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-between gap-2 sticky bottom-0 bg-slate-50 py-3">
          <Button variant="outline" onClick={() => navigate(`/cases/${id}/edit`)}>Back to Edit</Button>
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {generating ? "Generating Summary…" : "Generate Aeromedical Summary"}
          </Button>
        </div>
      </main>
    </div>
  );
}