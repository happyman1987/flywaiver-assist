import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const CHECK_PROMPT = (data) => `You are a USAF aerospace medicine waiver reviewer. Given the case data below, identify any information that is MISSING or INSUFFICIENT for a complete aeromedical waiver package, based on the current USAF Aerospace Medicine Waiver Guide requirements for the listed condition(s).

For each listed condition, consult the relevant waiver guide section and determine what clinical information, studies, documentation, or follow-up data the waiver guide requires or recommends. Then check which of those are absent or too sparse in the case data provided.

Return ONLY genuinely missing or insufficient items. For each, state:
- item: the specific missing information (e.g. "Recent CBC results", "Cardiology clearance letter", "Duration of current medication regimen")
- requirement: why the waiver guide requires it for this condition
- severity: "required" if the waiver guide mandates it, "recommended" if it strengthens the package but is not mandatory

If all required information appears present, return an empty items array. Do not invent requirements not grounded in the waiver guide for the listed conditions.

CASE DATA:
- Member: ${data.member_name}, ${data.rank || "rank not specified"}, ${data.unit || "unit not specified"}
- Flying class / duty: ${data.flying_class || "not specified"}
- Age / Sex: ${data.age ?? "not specified"} / ${data.sex || "not specified"}
- Condition(s):
${(data.conditions && data.conditions.length ? data.conditions : [{ diagnosis: data.diagnosis, category: data.category }]).map((c, i) => `  ${i + 1}. ${c.diagnosis}${c.category ? ` (waiver guide section: ${c.category})` : ""}`).join("\n")}

PROVIDED CLINICAL INFORMATION:
- History of present illness / PMH: ${data.history || "(empty)"}
- Studies / testing performed: ${data.diagnostics || "(empty)"}
- Current medications: ${data.medications || "(empty)"}
- Treatment course: ${data.treatment_course || "(empty)"}
- Current clinical status: ${data.current_status || "(empty)"}
- Aeromedical concerns / notes: ${data.aeromedical_concerns || "(empty)"}

Return the result as JSON matching the provided schema.`;

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
      prompt: CHECK_PROMPT(body),
      add_context_from_internet: true,
      model: 'gemini_3_8_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                requirement: { type: 'string' },
                severity: { type: 'string', enum: ['required', 'recommended'] }
              },
              required: ['item', 'requirement', 'severity']
            }
          }
        },
        required: ['items']
      }
    });

    const items = Array.isArray(result) ? result : (result?.items || []);
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}