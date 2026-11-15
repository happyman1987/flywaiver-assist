import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.json";

// A private upload is stored as a file_uri; the readable file name is the tail of that path.
export const documentName = (uri) => {
  const base = String(uri || "").split("/").pop() || "";
  const name = base.replace(/^[0-9a-f]{6,}_/i, "");
  try {
    return decodeURIComponent(name) || "Document";
  } catch (e) {
    return name || "Document";
  }
};

export default function DocumentUpload({ docs = [], onChange, accept = ACCEPT, noun = "document", dropLabel = "Drag documents here, or click to browse" }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(null);
  const inputRef = useRef(null);

  const uploadFiles = async (files) => {
    const all = Array.from(files || []);
    if (!all.length) return;
    // A file type the reader cannot open would upload and then extract nothing at all.
    const allowed = accept.split(",").map((ext) => ext.trim().toLowerCase()).filter(Boolean);
    const list = all.filter((file) => allowed.some((ext) => String(file.name || "").toLowerCase().endsWith(ext)));
    if (list.length < all.length) {
      toast({
        title: "Unsupported file type skipped",
        description: `Only ${allowed.join(", ")} can be read. Save the document as a PDF and upload it again.`,
        variant: "destructive"
      });
    }
    if (!list.length) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const uris = [];
      for (const file of list) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uris.push(file_uri);
      }
      onChange([...docs, ...uris]);
      toast({ title: `${uris.length} ${noun}(s) uploaded (stored privately)`, description: list.map((f) => f.name).join(", ") });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  const download = async (uri) => {
    setOpening(uri);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
      window.open(signed_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Could not open document", description: err.message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  const remove = (uri) => onChange(docs.filter((d) => d !== uri));

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-primary bg-secondary" : "border-border bg-muted/40 hover:border-accent"} ${uploading ? "opacity-70 cursor-default" : "cursor-pointer"}`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" accept={accept} onChange={(e) => uploadFiles(e.target.files)} disabled={uploading} />
        {uploading ? (
          <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{uploading ? "Uploading…" : dropLabel}</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, CSV, XLSX or JSON · stores the file privately · several files at once</p>
      </div>

      {docs.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {docs.map((uri) => (
            <li key={uri} className="flex items-center gap-2 px-3 py-2">
              <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm" title={documentName(uri)}>{documentName(uri)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => download(uri)} disabled={opening === uri} title="Download">
                {opening === uri ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(uri)} title="Remove from package">
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && <p className="text-xs text-muted-foreground">{docs.length} {noun}(s) attached</p>}
    </div>
  );
}