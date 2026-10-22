import React from "react";
import { Plane } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function AppHeader({ children }) {
  return (
    <header className="border-b bg-card">
      <div className="h-1 bg-[hsl(var(--usaf-gold))]" />
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">FlyWaiver Assist</h1>
            <p className="text-xs text-muted-foreground">USAF Flight Medicine — Aeromedical Summary Generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}