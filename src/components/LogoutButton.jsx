import React, { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function LogoutButton({ variant = "ghost", size = "sm" }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleLogout} disabled={loggingOut} title="Log out">
      {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      <span className="hidden sm:inline ml-2">Log Out</span>
    </Button>
  );
}