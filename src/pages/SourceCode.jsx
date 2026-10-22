import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCopy, Loader2 } from "lucide-react";
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

// path -> () => Promise<text>
const LOADERS = { ...FRONTEND_FILES };
for (const [copyPath, load] of Object.entries(BACKEND_COPIES)) {
  const fnName = copyPath.split("/").pop().replace(/\.txt$/, "");
  LOADERS[`/base44/functions/${fnName}/entry.ts`] = load;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FILES.filter((f) => f.name.toLowerCase().includes(q)) : FILES;
  }, [query]);

  const copyAll = async () => {
    setCopyingAll(true);
    try {
      const parts = [];
      for (const file of FILES) {
        const text = await LOADERS[file.path]();
        parts.push(`// ===== ${file.name} =====\n${text}`);
      }
      const ok = await copyText(parts.join("\n\n"));
      toast(
        ok
          ? { title: "Copied all files", description: `${FILES.length} files on your clipboard.` }
          : { title: "Could not copy", description: "Select the text and copy it manually.", variant: "destructive" }
      );
    } finally {
      setCopyingAll(false);
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
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          App source code ({FILES.length} files)
        </h2>
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