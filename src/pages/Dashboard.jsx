import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, FileText, Archive, Trash2, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CaseListCard from "@/components/CaseListCard";

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await base44.entities.WaiverCase.filter({ archived: { $ne: true } }, { sort: "-created_date", limit: 50 });
        setCases(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleArchive = async (item) => {
    await base44.entities.WaiverCase.update(item.id, { archived: true });
    setCases((prev) => prev.filter((c) => c.id !== item.id));
  };

  const handleDelete = async () => {
    await base44.entities.WaiverCase.delete(deleteTarget.id);
    setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <Button variant="ghost" asChild>
          <Link to="/archived"><Archive className="w-4 h-4 mr-2" /> Archived</Link>
        </Button>
        <Button asChild>
          <Link to="/cases/new"><Plus className="w-4 h-4 mr-2" /> New Case</Link>
        </Button>
      </AppHeader>

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
              <CaseListCard
                key={c.id}
                item={c}
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(c)}>
                      <Archive className="w-4 h-4" /><span className="hidden sm:inline ml-1">Archive</span>
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="w-4 h-4" /><span className="hidden sm:inline ml-1">Delete</span>
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this waiver?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the waiver case for {deleteTarget?.member_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}