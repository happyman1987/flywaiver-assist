import React, { useState, useEffect } from "react";
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

export default function MissingInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justifications, setJustifications] = useState({});
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
      } catch (e) {
        toast({ title: "Case not found", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const generate = async () => {
    setGenerating(true);
    try {
      const items = c.missing_info || [];
      const missing_justifications = items.map((m) => ({
        item: m.item,
        justification: justifications[items.findIndex((x) => x.item === m.item)] || ""
      }));
      await base44.entities.WaiverCase.update(id, { missing_justifications });
      const payload = {
        ...c,
        age: c.age ?? null,
        diagnosis: c.conditions?.[0]?.diagnosis || c.diagnosis,
        category: c.conditions?.[0]?.category || c.category,
        missing_justifications
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
          <p className="text-sm font-medium">Missing Information Review</p>
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
            {generating ? "Generating Summary…" : "Generate Summary Anyway"}
          </Button>
        </div>
      </main>
    </div>
  );
}