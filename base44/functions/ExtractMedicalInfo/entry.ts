import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const WAIVER_SECTIONS = [
  "Cardiology", "Dermatology", "Gastroenterology", "Hematology", "Internal Medicine",
  "Malignancies / Cancers", "Neurology", "Obstetrics and Gynecology", "Ophthalmology",
  "Orthopaedics", "Otolaryngology (ENT)", "Psychiatry / Neuropsychiatry", "Pulmonology",
  "Urology", "Other"
];

// The waiver package only needs what the waiver guide requires for the listed condition(s):
// incidental findings in the same document (e.g. an HIV test run alongside a required CBC) are left out.
const conditionScope = (data) => {
  const list = (Array.isArray(data.conditions) ? data.conditions : [])
    .filter((c) => c && c.diagnosis)
    .map((c) => `${c.diagnosis}${c.category ? ` (waiver guide section: ${c.category})` : ''}`);
  if (!list.length && data.diagnosis) {
    list.push(`${data.diagnosis}${data.category ? ` (waiver guide section: ${data.category})` : ''}`);
  }
  return list;
};

const scopeRule = (conditions) => {
  const target = conditions.length
    ? `the listed waiver condition(s): ${conditions.join('; ')}`
    : "the member's aeromedical waiver condition(s)";
  return `Include ONLY information that is required or directly relevant to ${target}. Omit incidental or unrelated results, even when they appear in the same document or the same lab panel — for example, if a CBC is required and an HIV test was also performed, omit the HIV result.`;
};

const extractionSchema = (conditions) => ({
  type: 'object',
  properties: {
    conditions: {
      type: 'array',
      description: `Diagnoses or conditions in the document that are relevant to ${conditions.length ? `the listed waiver condition(s): ${conditions.join('; ')}` : 'an aeromedical waiver'}`,
      items: {
        type: 'object',
        properties: {
          diagnosis: { type: 'string', description: 'Diagnosis or condition' },
          category: { type: 'string', enum: WAIVER_SECTIONS, description: 'USAF waiver guide section this diagnosis maps to' }
        },
        required: ['diagnosis', 'category']
      }
    },
    history: { type: 'string', description: `History of present illness and relevant past medical history. ${scopeRule(conditions)}` },
    diagnostics: { type: 'string', description: `Studies and testing performed with key results. ${scopeRule(conditions)}` },
    medications: { type: 'string', description: `Current and recent medications. ${scopeRule(conditions)}` },
    treatment_course: { type: 'string', description: `Treatment course undertaken. ${scopeRule(conditions)}` },
    current_status: { type: 'string', description: `Current clinical status and functional capacity. ${scopeRule(conditions)}` }
  }
});

const CURATION_SCHEMA = {
  type: 'object',
  properties: {
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          diagnosis: { type: 'string' },
          category: { type: 'string', enum: WAIVER_SECTIONS }
        },
        required: ['diagnosis', 'category']
      }
    },
    history: { type: 'string' },
    diagnostics: { type: 'string' },
    medications: { type: 'string' },
    treatment_course: { type: 'string' },
    current_status: { type: 'string' }
  },
  required: ['conditions', 'history', 'diagnostics', 'medications', 'treatment_course', 'current_status']
};

const CURATION_PROMPT = (data, conditions, raw) => `You are a USAF aerospace medicine waiver reviewer assembling an aeromedical waiver package. A medical document was extracted, but that document may contain information the waiver package does not need.

MEMBER'S WAIVER CONDITION(S):
${conditions.length ? conditions.map((c, i) => `  ${i + 1}. ${c}`).join('\n') : '  (none listed yet)'}
${data.flying_class ? `- Flying class / duty: ${data.flying_class}` : ''}

RAW EXTRACTION FROM THE UPLOADED DOCUMENT:
${JSON.stringify(raw || {}, null, 2)}

TASK
Return the same structure, keeping ONLY what this waiver package requires for the condition(s) above:
- conditions: only diagnoses from the document that are themselves relevant to this waiver AND are not already listed above as the member's waiver conditions. Omit every incidental or unrelated diagnosis, including specialty findings discovered incidentally.
- diagnostics: only the labs, imaging, and specialty evaluations the USAF waiver guide requires or recommends for the listed condition(s), with their results. Omit any test, panel, or consult the waiver does not require, even when it appears in the same document or the same lab panel — for example, if a CBC is required and the same panel also included an HIV test, keep the CBC and omit the HIV result.
- history, medications, treatment_course, current_status: keep only content that documents the listed condition(s); drop detail about unrelated conditions.
Rules: never invent, infer, or extrapolate a finding — copy what is documented. Do not drop information the waiver requires for the listed condition(s). If nothing in the raw extraction is required or relevant, return empty strings and an empty conditions array.

Return the result as JSON matching the provided schema.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { file_uri } = body || {};
    if (!file_uri) return Response.json({ error: 'file_uri is required' }, { status: 400 });

    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 600
    });

    const conditions = conditionScope(body);

    const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed_url,
      json_schema: extractionSchema(conditions)
    });

    let output = extraction?.output;
    if (extraction?.status === 'success' && output) {
      try {
        const curated = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: CURATION_PROMPT(body, conditions, output),
          add_context_from_internet: true,
          model: 'gemini_3_8_flash',
          response_json_schema: CURATION_SCHEMA
        });
        if (curated && typeof curated === 'object') output = curated;
      } catch (e) {
        // keep the unscreened extraction rather than losing the document data
      }
    }

    return Response.json({ extraction: { ...extraction, output } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}