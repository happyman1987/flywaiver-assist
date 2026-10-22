import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { extractedConditions, mergeExtraction } from "@/lib/extraction";

export default function PriorWaiverSection({ form, setForm }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const docs = form.prior_waiver_docs || [];

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm((f) => ({ ...f, prior_waiver_docs: [...(f.prior_waiver_docs || []), file_uri] }));
      toast({ title: "Previous waiver uploaded (stored privately)", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExtract = async () => {
    if (!docs.length) return;
    setExtracting(true);
    try {
      const res = await base44.functions.invoke("ExtractMedicalInfo", {
        file_uri: docs[docs.length - 1],
        conditions: form.conditions.filter((c) => c.diagnosis),
        member_name: form.member_name,
        flying_class: form.flying_class,
        document_kind: "prior_waiver"
      });
      const extraction = res.data?.extraction || {};
      const ext = extraction.output || {};
      const found = extractedConditions(ext);
      setForm((f) => ({
        ...f,
        ...mergeExtraction(f, ext),
        prior_waiver_authority: ext.prior_waiver_authority || f.prior_waiver_authority,
        prior_waiver_expiration: ext.prior_waiver_expiration || f.prior_waiver_expiration
      }));
      if (extraction.status === "error") {
        toast({ title: "Could not read the previous waiver", description: extraction.details || "Try a PDF or photo of the waiver document.", variant: "destructive" });
      } else {
        toast({
          title: "Previous waiver details extracted",
          description: found.length
            ? `${found.length} condition(s) plus the prior waiver details were added.`
            : "The prior waiver details were added to the case."
        });
      }
    } catch (err) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Previous Waiver</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Details of the waiver being renewed. Upload the previous waiver or its aeromedical summary to pull them in
          automatically (stored privately).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Waiver Authority</Label>
            <Input
              value={form.prior_waiver_authority || ""}
              onChange={(e) => setForm((f) => ({ ...f, prior_waiver_authority: e.target.value }))}
              placeholder="e.g. AFMC/A3OM"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expiration Date</Label>
            <Input
              type="date"
              value={form.prior_waiver_expiration || ""}
              onChange={(e) => setForm((f) => ({ ...f, prior_waiver_expiration: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2 inline" />
              {uploading ? "Uploading…" : "Upload Previous Waiver"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.json"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </Button>
          <Button variant="outline" onClick={handleExtract} disabled={extracting || !docs.length}>
            {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
            Extract Prior Waiver Details
          </Button>
        </div>
        {docs.length > 0 && (
          <p className="text-xs text-muted-foreground">{docs.length} previous waiver document(s) attached</p>
        )}
      </CardContent>
    </Card>
  );
}