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
  const [confirm, setConfirm] = useState(null);

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

  const handleConfirm = async () => {
    const { type, item } = confirm;
    if (type === "archive") {
      await base44.entities.WaiverCase.update(item.id, { archived: true });
    } else {
      await base44.entities.WaiverCase.delete(item.id);
    }
    setCases((prev) => prev.filter((c) => c.id !== item.id));
    setConfirm(null);
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

      <main className="max-w-5xl mx-auto px-6 py-8 opacity-100">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Waiver Cases</h2>
        {loading ?
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> :
        cases.length === 0 ?
        <Card>
            <CardContent className="py-16 flex flex-col items-center text-center">
              <FileText className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No waiver cases yet.</p>
              <Button asChild><Link to="/cases/new"><Plus className="w-4 h-4 mr-2" /> Create your first case</Link></Button>
            </CardContent>
          </Card> :

        <div className="grid gap-3">
            {cases.map((c) =>
          <CaseListCard
            key={c.id}
            item={c}
            actions={
            <>
                    <Button variant="outline" size="sm" onClick={() => setConfirm({ type: "archive", item: c })}>
                      <Archive className="w-4 h-4" /><span className="hidden sm:inline ml-1">Archive</span>
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm({ type: "delete", item: c })}>
                      <Trash2 className="w-4 h-4" /><span className="hidden sm:inline ml-1">Delete</span>
                    </Button>
                  </>
            } />

          )}
          </div>
        }
      </main>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.type === "archive" ? "Archive this waiver?" : "Delete this waiver?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "archive" ?
              `This moves the waiver case for ${confirm?.item?.member_name} to the archive. You can restore it later.` :
              `This permanently deletes the waiver case for ${confirm?.item?.member_name}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className={confirm?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {confirm?.type === "archive" ? "Archive" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}