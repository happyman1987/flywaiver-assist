import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, Sparkles, FileUp, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLog";

const FLYING_CLASSES = ["FC-I", "FC-II", "FC-III", "ATC", "GBO", "OSF", "SWA", "Other"];
const CATEGORIES = ["Cardiology","Dermatology","Gastroenterology","Hematology","Internal Medicine","Malignancies / Cancers","Neurology","Obstetrics and Gynecology","Ophthalmology","Orthopaedics","Otolaryngology (ENT)","Psychiatry / Neuropsychiatry","Pulmonology","Urology","Other"];

const EMPTY = {
  member_name: "", rank: "", unit: "", flying_class: "", age: "", sex: "", dod_id: "",
  diagnosis: "", category: "", conditions: [{ diagnosis: "", category: "" }], history: "", diagnostics: "", medications: "",
  treatment_course: "", current_status: "", aeromedical_concerns: "", uploaded_docs: []
};

export default function CaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const c = await base44.entities.WaiverCase.get(id);
        setForm({ ...EMPTY, ...c, conditions: c.conditions?.length ? c.conditions : [{ diagnosis: c.diagnosis || "", category: c.category || "" }] });
      } catch (e) {
        toast({ title: "Could not load case", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateCondition = (i, k, v) => setForm((f) => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }));
  const addCondition = () => setForm((f) => ({ ...f, conditions: [...f.conditions, { diagnosis: "", category: "" }] }));
  const removeCondition = (i) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm((f) => ({ ...f, uploaded_docs: [...(f.uploaded_docs || []), file_uri] }));
      toast({ title: "Document uploaded (stored privately)", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExtract = async () => {
    if (!form.uploaded_docs?.length) {
      toast({ title: "Upload a document first", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const res = await base44.functions.invoke("ExtractMedicalInfo", { file_uri: form.uploaded_docs[form.uploaded_docs.length - 1] });
      const ext = res.data?.extraction?.output || {};
      const extConditions = (Array.isArray(ext.conditions) ? ext.conditions : [])
        .filter((c) => c && c.diagnosis)
        .map((c) => ({ diagnosis: c.diagnosis, category: c.category || "" }));
      setForm((f) => {
        const existing = f.conditions.filter((c) => c.diagnosis || c.category);
        const merged = extConditions.length ? [...existing, ...extConditions] : existing;
        const conditions = merged.length ? merged : [{ diagnosis: "", category: "" }];
        return {
          ...f,
          conditions,
          diagnosis: conditions[0]?.diagnosis || f.diagnosis || "",
          category: conditions[0]?.category || f.category || "",
          history: f.history || ext.history || "",
          diagnostics: f.diagnostics || ext.diagnostics || "",
          medications: f.medications || ext.medications || "",
          treatment_course: f.treatment_course || ext.treatment_course || "",
          current_status: f.current_status || ext.current_status || ""
        };
      });
      toast({ title: extConditions.length ? `${extConditions.length} diagnosis(es) added with waiver guide sections` : "Medical info extracted from document" });
    } catch (err) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const save = async (status) => {
    if (!form.member_name || !form.conditions[0]?.diagnosis) {
      toast({ title: "Member name and at least one diagnosis are required", variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const payload = { ...form, age: form.age ? Number(form.age) : null, status: status || form.status || "draft", diagnosis: form.conditions[0]?.diagnosis || "", category: form.conditions[0]?.category || "" };
      let record;
      if (id) {
        record = await base44.entities.WaiverCase.update(id, payload);
        logAuditEvent("case_updated", id, record.member_name);
      } else {
        record = await base44.entities.WaiverCase.create(payload);
        logAuditEvent("case_created", record.id, record.member_name);
      }
      return record;
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const rec = await save("draft");
    if (rec) {
      toast({ title: "Draft saved" });
      if (!id) navigate(`/cases/${rec.id}/edit`);
    }
  };

  const handleGenerate = async () => {
    const rec = await save("draft");
    if (!rec) return;
    const caseId = rec.id;
    setGenerating(true);
    try {
      const payload = { ...form, age: form.age ? Number(form.age) : null, diagnosis: form.conditions[0]?.diagnosis || "", category: form.conditions[0]?.category || "" };
      const checkRes = await base44.functions.invoke("CheckMissingInfo", payload);
      const missing = checkRes.data?.items || [];
      if (missing.length > 0) {
        await base44.entities.WaiverCase.update(caseId, { missing_info: missing, missing_justifications: [] });
        navigate(`/cases/${caseId}/missing-info`);
        return;
      }
      const res = await base44.functions.invoke("GenerateNarrative", payload);
      const narrative = res.data?.narrative;
      if (!narrative) throw new Error("No narrative returned");
      await base44.entities.WaiverCase.update(caseId, { narrative, status: "generated" });
      logAuditEvent("narrative_generated", caseId, rec.member_name);
      toast({ title: "Aeromedical Summary generated" });
      navigate(`/cases/${caseId}`);
    } catch (err) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Cases
          </Button>
          <p className="text-sm font-medium">{id ? "Edit Case" : "New Waiver Case"}</p>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Member info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Member Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Member Name *</Label>
              <Input value={form.member_name} onChange={(e) => set("member_name", e.target.value)} placeholder="Last, First MI" />
            </div>
            <div className="space-y-1.5">
              <Label>Rank</Label>
              <Input value={form.rank} onChange={(e) => set("rank", e.target.value)} placeholder="e.g. Capt" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit / Squadron</Label>
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Flying Class / Duty</Label>
              <Select value={form.flying_class} onValueChange={(v) => set("flying_class", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FLYING_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Age</Label>
              <Input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>DoD ID</Label>
              <Input value={form.dod_id} onChange={(e) => set("dod_id", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Document upload */}
        <Card>
          <CardHeader><CardTitle className="text-base">Medical Documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Upload a medical record, consult note, or lab report to auto-extract details. Files are stored privately.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2 inline" />
                  {uploading ? "Uploading…" : "Upload Document"}
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.json" onChange={handleUpload} disabled={uploading} />
                </label>
              </Button>
              <Button variant="outline" onClick={handleExtract} disabled={extracting || !form.uploaded_docs?.length}>
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                Extract Info from Document
              </Button>
            </div>
            {form.uploaded_docs?.length > 0 && (
              <p className="text-xs text-muted-foreground">{form.uploaded_docs.length} document(s) attached</p>
            )}
          </CardContent>
        </Card>

        {/* Clinical info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Clinical Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Diagnoses / Conditions *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="w-4 h-4 mr-1" /> Add Condition
                </Button>
              </div>
              {form.conditions.map((cond, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <Input value={cond.diagnosis} onChange={(e) => updateCondition(i, "diagnosis", e.target.value)} placeholder="e.g. Hypertension" />
                  </div>
                  <div className="col-span-5">
                    <Select value={cond.category} onValueChange={(v) => updateCondition(i, "category", v)}>
                      <SelectTrigger><SelectValue placeholder="Waiver guide section" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {form.conditions.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCondition(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Each condition maps to a section of the USAF waiver guide. The narrative will address every listed condition.</p>
            </div>
            <div className="space-y-1.5">
              <Label>History of Present Illness / PMH</Label>
              <Textarea rows={3} value={form.history} onChange={(e) => set("history", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Studies / Testing Performed</Label>
              <Textarea rows={3} value={form.diagnostics} onChange={(e) => set("diagnostics", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Medications</Label>
              <Textarea rows={2} value={form.medications} onChange={(e) => set("medications", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Treatment Course</Label>
              <Textarea rows={2} value={form.treatment_course} onChange={(e) => set("treatment_course", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Clinical Status</Label>
              <Textarea rows={2} value={form.current_status} onChange={(e) => set("current_status", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Aeromedical Concerns / Notes</Label>
              <Textarea rows={2} value={form.aeromedical_concerns} onChange={(e) => set("aeromedical_concerns", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between gap-2 sticky bottom-0 bg-slate-50 py-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || generating}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={saving || generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {generating ? "Generating Summary…" : "Generate Aeromedical Summary"}
          </Button>
        </div>
      </main>
    </div>
  );
}