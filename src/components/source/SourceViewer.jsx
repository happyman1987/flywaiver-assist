import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";

export default function SourceViewer({ filePath, load }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCopied(false);
    load().then((text) => {
      if (!alive) return;
      setContent(typeof text === "string" ? text : JSON.stringify(text, null, 2));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [filePath, load]);

  const copy = async () => {
    if (!(await copyText(content))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filePath.split("/").pop();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-xs font-mono truncate">{filePath}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={copy} disabled={loading}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={loading}>
            <Download className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <pre className="max-h-[65vh] overflow-auto p-4 text-xs font-mono whitespace-pre-wrap break-words">
          {content}
        </pre>
      )}
    </div>
  );
}