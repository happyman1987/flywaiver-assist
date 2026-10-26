import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCopy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AppHeader from "@/components/AppHeader";
import SourceFileList from "@/components/source/SourceFileList";
import SourceViewer from "@/components/source/SourceViewer";
import { copyText } from "@/lib/clipboard";

const FRONTEND_FILES = import.meta.glob(
  [
    "/src/**/*.{js,jsx,ts,tsx,css}",
    "/index.html",
    "/tailwind.config.js",
    "/postcss.config.js",
    "/vite.config.js",
    "/package.json",
    "/jsconfig.json",
    "/components.json"
  ],
  { query: "?raw", import: "default" }
);

// Backend function sources are kept here as text copies of the deployed functions.
const BACKEND_COPIES = import.meta.glob("/src/lib/backendSource/*.txt", {
  query: "?raw",
  import: "default"
});

// Data-model schemas are kept here as text copies of the deployed entity schemas.
const ENTITY_COPIES = import.meta.glob("/src/lib/entitySource/*.txt", {
  query: "?raw",
  import: "default"
});

// path -> () => Promise<text>
const LOADERS = { ...FRONTEND_FILES };
for (const [copyPath, load] of Object.entries(BACKEND_COPIES)) {
  const fnName = copyPath.split("/").pop().replace(/\.txt$/, "");
  LOADERS[`/base44/functions/${fnName}/entry.ts`] = load;
}
for (const [copyPath, load] of Object.entries(ENTITY_COPIES)) {
  const entityName = copyPath.split("/").pop().replace(/\.txt$/, "");
  LOADERS[`/base44/entities/${entityName}.jsonc`] = load;
}

const FILES = Object.keys(LOADERS)
  .sort()
  .map((path) => ({ path, name: path.replace(/^\//, "") }));

export default function SourceCode() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    FILES.find((f) => f.path === "/src/App.jsx")?.path || FILES[0]?.path
  );
  const [copyingAll, setCopyingAll] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FILES.filter((f) => f.name.toLowerCase().includes(q)) : FILES;
  }, [query]);

  // Every file in one document, each under a header naming it — the whole app in one piece.
  const buildBundle = async () =>
    (
      await Promise.all(
        FILES.map(async (file) => `// ===== ${file.name} =====\n${await LOADERS[file.path]()}`)
      )
    ).join("\n\n");

  const copyAll = async () => {
    setCopyingAll(true);
    try {
      const ok = await copyText(await buildBundle());
      toast(
        ok
          ? { title: "Copied all files", description: `${FILES.length} files on your clipboard.` }
          : { title: "Could not copy", description: "Select the text and copy it manually.", variant: "destructive" }
      );
    } finally {
      setCopyingAll(false);
    }
  };

  // Hands the same document over as a file, for a review that wants the code uploaded rather than pasted.
  const saveAll = async () => {
    setSavingAll(true);
    try {
      const url = URL.createObjectURL(new Blob([await buildBundle()], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "flywaiver-assist-source.txt";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Source saved", description: `${FILES.length} files in one text file.` });
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <Button variant="ghost" asChild>
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Cases</Link>
        </Button>
        <Button onClick={copyAll} disabled={copyingAll}>
          {copyingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
          {copyingAll ? "Copying…" : "Copy all files"}
        </Button>
      </AppHeader>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            App source code ({FILES.length} files)
          </h2>
          <Button variant="outline" size="sm" onClick={saveAll} disabled={savingAll}>
            {savingAll ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            {savingAll ? "Saving…" : "Save all as one file"}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <SourceFileList
            files={filtered}
            query={query}
            onQueryChange={setQuery}
            selectedPath={selected}
            onSelect={setSelected}
          />
          {selected && <SourceViewer filePath={selected} load={LOADERS[selected]} />}
        </div>
      </main>
    </div>
  );
}