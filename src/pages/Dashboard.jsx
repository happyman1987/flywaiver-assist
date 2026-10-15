import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Plane, Loader2 } from "lucide-react";
import DiagnosisImage from "@/components/DiagnosisImage";

const statusVariant = {
  draft: "secondary",
  generated: "default",
  submitted: "default"
};

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await base44.entities.WaiverCase.filter({}, { sort: "-created_date", limit: 50 });
        setCases(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Fly Waiver Package Assistant</h1>
              <p className="text-xs text-muted-foreground">USAF Aerospace Medicine — Aeromedical Summary generation</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/cases/new"><Plus className="w-4 h-4 mr-2" /> New Case</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Waiver Cases</h2>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center">
              <FileText className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No waiver cases yet.</p>
              <Button asChild><Link to="/cases/new"><Plus className="w-4 h-4 mr-2" /> Create your first case</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {cases.map((c) => (
              <Link to={`/cases/${c.id}`} key={c.id}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DiagnosisImage diagnosis={c.diagnosis} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{c.member_name}</p>
                          <Badge variant={statusVariant[c.status] || "secondary"} className="capitalize">{c.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{c.diagnosis}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{c.flying_class || "—"}</p>
                      <p>{c.unit || "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}