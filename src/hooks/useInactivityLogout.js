import { useEffect } from "react";
import { base44 } from "@/api/base44Client";

// HIPAA §164.312(a)(2)(iii) automatic logoff — terminate the session after a period of inactivity.
const IDLE_MS = 15 * 60 * 1000; // 15 minutes

export default function useInactivityLogout() {
  useEffect(() => {
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await base44.auth.logout("/login");
        } catch (e) {
          window.location.href = "/login";
        }
      }, IDLE_MS);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
}