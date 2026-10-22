import React from "react";
import { Input } from "@/components/ui/input";
import { FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SourceFileList({ files, query, onQueryChange, selectedPath, onSelect }) {
  return (
    <div className="md:sticky md:top-24">
      <Input
        placeholder="Filter files…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="mb-3"
      />
      <div className="max-h-[65vh] overflow-auto rounded-lg border bg-card p-1">
        {files.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No files match that filter.</p>
        )}
        {files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => onSelect(f.path)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-mono hover:bg-accent/40",
              selectedPath === f.path && "bg-secondary font-medium text-secondary-foreground"
            )}
          >
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}