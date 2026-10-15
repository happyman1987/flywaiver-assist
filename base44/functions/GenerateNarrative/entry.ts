import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

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

8. RECOMMENDATION / WAIVER DISPOSITION
   - Professional aeromedical opinion and recommendation: favorable for waiver / waiver with restrictions / further evaluation required, with rationale and suggested follow-up.

Do not invent clinical facts not provided. If a field is empty, state "Not provided" rather than fabricating. Keep the tone objective and concise. Use plain section headings in uppercase as shown above.

CASE DATA:
- Member: ${data.member_name}, ${data.rank || "rank not specified"}, ${data.unit || "unit not specified"}
- Flying class / duty: ${data.flying_class || "not specified"}
- Age / Sex: ${data.age ?? "not specified"} / ${data.sex || "not specified"}
- DoD ID: ${data.dod_id || "not specified"}
- Condition(s):
${(data.conditions && data.conditions.length ? data.conditions : [{ diagnosis: data.diagnosis, category: data.category }]).map((c, i) => `  ${i + 1}. ${c.diagnosis}${c.category ? ` (waiver guide section: ${c.category})` : ""}`).join("\n")}

CLINICAL INFORMATION:
- History of present illness / PMH: ${data.history || "Not provided"}
- Studies / testing performed: ${data.diagnostics || "Not provided"}
- Current medications: ${data.medications || "Not provided"}
- Treatment course: ${data.treatment_course || "Not provided"}
- Current clinical status: ${data.current_status || "Not provided"}
- Aeromedical concerns / notes from provider: ${data.aeromedical_concerns || "Not provided"}

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