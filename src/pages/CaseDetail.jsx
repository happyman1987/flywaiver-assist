import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Loader2, Pencil, Copy, Check, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rec = await base44.entities.WaiverCase.get(id);
        setC(rec);
        setNarrative(rec.narrative || "");
      } catch (e) {
        toast({ title: "Case not found", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const saveNarrative = async () => {
    setSaving(true);
    try {
      await base44.entities.WaiverCase.update(id, { narrative });
      setC((p) => ({ ...p, narrative }));
      setEditing(false);
      toast({ title: "Narrative saved" });
    } catch (e) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyNarrative = async () => {
    await navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadNarrative = () => {
    const blob = new Blob([narrative], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AMS_${(c.member_name || "case").replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!c) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="w-4 h-4 mr-2" /> Cases</Button>
          <Badge className="capitalize">{c.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => navigate(`/cases/${id}/edit`)}><Pencil className="w-4 h-4 mr-2" /> Edit Case</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Member Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
            <Field label="Name" value={c.member_name} />
            <Field label="Rank" value={c.rank} />
            <Field label="Unit" value={c.unit} />
            <Field label="Flying Class" value={c.flying_class} />
            <Field label="Age / Sex" value={`${c.age ?? "—"} / ${c.sex || "—"}`} />
            <Field label="DoD ID" value={c.dod_id} />
            <Field label="Diagnosis" value={c.diagnosis} />
            <Field label="Category" value={c.category} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle className="text-base">Aeromedical Summary (AMS)</CardTitle>
            <div className="flex gap-2">
              {narrative && !editing && (
                <>
                  <Button variant="ghost" size="sm" onClick={copyNarrative}>
                    {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadNarrative}><FileDown className="w-4 h-4 mr-1" /> Export</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!narrative ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-4">No narrative generated yet.</p>
                <Button onClick={() => navigate(`/cases/${id}/edit`)}>Generate Summary</Button>
              </div>
            ) : editing ? (
              <div className="space-y-3">
                <Textarea rows={20} value={narrative} onChange={(e) => setNarrative(e.target.value)} className="font-mono text-sm" />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setEditing(false); setNarrative(c.narrative || ""); }}>Cancel</Button>
                  <Button onClick={saveNarrative} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-relaxed space-y-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold">
                <ReactMarkdown>{narrative}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}