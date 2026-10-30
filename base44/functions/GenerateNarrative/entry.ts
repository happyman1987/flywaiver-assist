import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// A renewal case states the prior grant in the AMS and recommends continuation.
const waiverContext = (data) => {
  if (data.waiver_type !== 'renewal') return '- Waiver type: Initial waiver request';
  const lines = ['- Waiver type: RENEWAL of a previously granted waiver'];
  if (data.prior_waiver_authority) lines.push(`- Prior waiver authority: ${data.prior_waiver_authority}`);
  if (data.prior_waiver_expiration) lines.push(`- Prior waiver expiration: ${data.prior_waiver_expiration}`);
  return lines.join('\n');
};

const renewalInstruction = (data) => data.waiver_type === 'renewal'
  ? `\nThis case is a RENEWAL of a previously granted aeromedical waiver. In the opening paragraph, state that the member's existing waiver is submitted for renewal${data.prior_waiver_authority ? ` (granted by ${data.prior_waiver_authority})` : ''}${data.prior_waiver_expiration ? `, expiring ${data.prior_waiver_expiration}` : ''}. Note the stability of each condition since that waiver was granted. In the DISCUSSION/RECOMMENDATIONS section, explicitly reference the previously granted waiver (its granting authority and expiration date) and recommend that the waiver be renewed, or modified where the facts support it. Where the case data documents it, carry the history from the previous waiver into the PAST MEDICAL HISTORY / RELEVANT HISTORY section. Do not state that a waiver has previously been granted unless the case data documents it.\n`
  : '';

// The approved-medication-list dispositions travel with the case data; the AMS cites them and flags
// every medication that is not on an approved list.
const medicationReview = (data) => {
  const review = typeof data.medication_review === 'string' ? data.medication_review.trim() : '';
  if (!review) return '';
  return `\nAPPROVED MEDICATION LIST REVIEW (supplied with the case — treat as authoritative for which approved medication list each medication appears on and for its disposition):\n${review}\n`;
};

// Medications reconciled out of the member's current regimen are left out of the package: they are
// dropped from the case data the summary is written from, and never cited in the AMS.
const splitMedicationLines = (text) => String(text || '').split(/[\n\r;,]+/).map((s) => s.trim()).filter(Boolean);

const medicationsLine = (data) => {
  const removed = new Set((Array.isArray(data.removed_medications) ? data.removed_medications : []).map((r) => String((r && r.medication) || '').trim().toLowerCase()));
  const current = splitMedicationLines(data.medications).filter((m) => !removed.has(m.toLowerCase()));
  if (current.length) return current.join('; ');
  return splitMedicationLines(data.medications).length ? 'None — no medications remain on the current regimen' : 'Not provided';
};

const medicationInstruction = (data) => (typeof data.medication_review === 'string' && data.medication_review.trim())
  ? `\nIn TREATMENT COURSE & CURRENT MEDICATIONS, state each current medication together with the approved medication list it appears on and its disposition (no DOWN status required, ground trial, waiver required, or not waiverable) exactly as the APPROVED MEDICATION LIST REVIEW gives it. In AEROMEDICAL CONSIDERATIONS, analyze the aeromedical impact of each medication that carries a waiver requirement or that is not on an approved list. Medications reconciled out of the member's current regimen are not part of this package: if a medication appears neither in the case data nor in the review, omit it entirely — do not list it in TREATMENT COURSE & CURRENT MEDICATIONS, do not cite an approved-list disposition or a waiver requirement for it, and do not refer to the reconciliation itself anywhere in the AMS. For a medication the review reports as not found on the approved lists, state only that it is not on the approved medication lists and cite the flight surgeon's review of it when the review includes one. Where the review records the flight surgeon's documentation of whether a waiver should be granted for a medication's use, carry that documentation into AEROMEDICAL CONSIDERATIONS and into the DISCUSSION/RECOMMENDATIONS section as the recommendation for that medication — do NOT invent such a determination when the review does not document one. Never describe a medication as approved when the review does not list it, never state that a medication requires AF/SG3P or MAJCOM/SG review unless the case data itself says so, and do not reclassify a medication the review places on a list.\n`
  : '';

const AMS_PROMPT = (data) => `You are an experienced United States Air Force flight surgeon preparing an Aeromedical Summary (AMS) for a military medical waiver submission. The AMS is a concise (one to two page) summary and recommendation encompassing all factors significant to the service member from the aeromedical risk perspective. It must address not only the clinical issues but also the impact on aviation safety if the member continues flying/special duty.

Reference the current USAF Aerospace Medicine Waiver Guide Compendium (published by AFRL/USAFSAM) for the waiver criteria, dispositions, and follow-up requirements specific to this diagnosis. Apply the relevant waiver guide section (e.g., waiver consideration, information required for waiver, waiver recommendations, follow-up) to the facts of this case.

Write the AMS in a formal clinical-aeromedical voice using the following section structure:

1. AEROMEDICAL SUMMARY
   - One opening paragraph: identifying statement with member name, rank, unit, flying class/duty, age/sex, and the diagnosis/diagnoses for which the waiver is requested. If multiple conditions are listed, address each in the sections below.

2. HISTORY OF PRESENT ILLNESS
   - Succinct narrative of the condition onset, course, and current status.

3. PAST MEDICAL HISTORY / RELEVANT HISTORY
   - Relevant past medical history and contributing factors.

4. DIAGNOSTIC STUDIES / TESTING
   - Studies and testing performed and key results.

5. TREATMENT COURSE & CURRENT MEDICATIONS
   - Treatments undertaken and current medications with relevance to aviation safety noted.

6. CURRENT CLINICAL STATUS
   - Member's current clinical status and functional capacity.

7. AEROMEDICAL CONSIDERATIONS
   - The aeromedical risk analysis: how each condition and its treatment could affect aviation safety and mission performance. Explicitly reference the applicable USAF waiver guide criteria for each listed diagnosis (waiver consideration, information required, recommendations). Note any disqualifying aspects and mitigating factors. If the waiver guide specifies required follow-up intervals or restrictions, state them.

8. DISCUSSION/RECOMMENDATIONS
   - A summary of the discussion and the recommendation for each waiver request in the case. State only a recommended disposition; never state, declare, or list an actual disposition (do not write that the waiver is granted, denied, approved, disapproved, or returned).
   - Open with one sentence — the disqualifying statement, following this pattern: "[member rank then full name — rank first, then name, e.g. Maj John A. Smith] is disqualifying for [the flying class / duty named in the case, e.g. FC-I, FC-II, FC-III] duties due to a history of [each medical condition named as diagnosed] in accordance with [the governing references]". Name every condition for which the waiver is requested, and cite the references that govern the finding — always AFI 48-123 (Medical Examinations and Standards), the Medical Standards Directory, and the USAF Aerospace Medicine Waiver Guide Compendium with the waiver guide section(s) or condition headings given in the case. Do not cite a condition or flying class the case does not document.
   - Then one short paragraph for each condition requiring a waiver, in the order the conditions are listed in the case, each summarizing the discussion and then recommending the disposition: the waiver guide criteria considered and the specific criteria not met, the aeromedical concern the condition raises for flying safety and mission performance, the mitigating factors documented in the case, and a closing recommendation — favorable for waiver / waiver with restrictions (naming them) / further evaluation required (naming what is needed) — with the suggested follow-up. Label each paragraph with the condition name so each waiver request is addressed separately. Where the case documents a waiver determination for a medication, carry it into the recommendation for the condition it relates to.
   - Do not add a disposition summary, disposition table, or closing disposition statement.

Do not invent clinical facts not provided. If a field is empty, state "Not provided" rather than fabricating. Keep the tone objective and concise. Use plain section headings in uppercase as shown above.
${renewalInstruction(data)}${medicationInstruction(data)}
CASE DATA:
- Member: ${data.member_name}, ${data.rank || "rank not specified"}, ${data.unit || "unit not specified"}
${waiverContext(data)}
- Flying class / duty: ${data.flying_class || "not specified"}
- Age / Sex: ${data.age ?? "not specified"} / ${data.sex || "not specified"}
- DoD ID: ${data.dod_id || "not specified"}
- Condition(s):
${(data.conditions && data.conditions.length ? data.conditions : [{ diagnosis: data.diagnosis, category: data.category }]).map((c, i) => `  ${i + 1}. ${c.diagnosis}${c.category ? ` (waiver guide section: ${c.category})` : ""}`).join("\n")}

CLINICAL INFORMATION:
- History of present illness / PMH: ${data.history || "Not provided"}
- Studies / testing performed: ${data.diagnostics || "Not provided"}
- Current medications: ${medicationsLine(data)}
- Treatment course: ${data.treatment_course || "Not provided"}
- Current clinical status: ${data.current_status || "Not provided"}
- Aeromedical concerns / notes from provider: ${data.aeromedical_concerns || "Not provided"}
${medicationReview(data)}${(data.missing_justifications && data.missing_justifications.length) ? `\nDOCUMENTED JUSTIFICATIONS FOR MISSING INFORMATION (acknowledge these in the AMS where relevant, noting the item is not yet available and the stated reason):\n${data.missing_justifications.map((j) => `- ${j.item}: ${j.justification || "No justification provided"}`).join("\n")}` : ""}

Now write the complete Aeromedical Summary.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body.member_name) return Response.json({ error: 'Missing required field: member_name' }, { status: 400 });
    const hasCondition = body.diagnosis || (Array.isArray(body.conditions) && body.conditions.some((c) => c.diagnosis));
    if (!hasCondition) return Response.json({ error: 'At least one diagnosis/condition is required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: AMS_PROMPT(body),
      add_context_from_internet: true,
      model: 'gemini_3_8_flash'
    });

    const narrative = typeof result === 'string' ? result : (result?.content || JSON.stringify(result));
    return Response.json({ narrative });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}