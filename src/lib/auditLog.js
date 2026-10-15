import { base44 } from "@/api/base44Client";

// Best-effort audit logging of PHI access events (HIPAA §164.312(b) audit controls).
// Fire-and-forget: a logging failure must never block the user's action.
export function logAuditEvent(eventType, caseId = null, memberName = null, details = null) {
  base44.entities.AuditLog.create({
    event_type: eventType,
    case_id: caseId,
    case_member_name: memberName,
    details
  }).catch(() => {});
}