import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

const cacheKey = (diagnosis) => `dximg:${diagnosis.trim().toLowerCase()}`;
const memoryCache = new Map();

export default function DiagnosisImage({ diagnosis, className = "" }) {
  const [url, setUrl] = useState(() => {
    const key = cacheKey(diagnosis);
    if (memoryCache.has(key)) return memoryCache.get(key);
    try { return localStorage.getItem(key) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(!url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!diagnosis) return;
    const key = cacheKey(diagnosis);
    if (memoryCache.has(key)) { setUrl(memoryCache.get(key)); setLoading(false); return; }
    let cached = null;
    try { cached = localStorage.getItem(key); } catch {}
    if (cached) { memoryCache.set(key, cached); setUrl(cached); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const res = await base44.functions.invoke("GenerateDiagnosisImage", { diagnosis });
        if (cancelled) return;
        const u = res?.data?.url;
        if (!u) throw new Error("No image url");
        memoryCache.set(key, u);
        try { localStorage.setItem(key, u); } catch {}
        setUrl(u);
      } catch (e) {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagnosis]);

  return (
    <div className={`shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden ${className}`}>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : url && !failed ? (
        <img src={url} alt={diagnosis} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-medium text-muted-foreground text-center px-1 line-clamp-2">{diagnosis}</span>
      )}
    </div>
  );
}