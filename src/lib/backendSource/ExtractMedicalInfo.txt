import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const WAIVER_SECTIONS = [
  "Cardiology", "Dermatology", "Gastroenterology", "Hematology", "Internal Medicine",
  "Malignancies / Cancers", "Neurology", "Obstetrics and Gynecology", "Ophthalmology",
  "Orthopaedics", "Otolaryngology (ENT)", "Psychiatry / Neuropsychiatry", "Pulmonology",
  "Urology", "Other"
];

// A previously granted waiver (or the AMS written for it) also carries the granting authority and its expiration.
const PRIOR_WAIVER = 'prior_waiver';

const priorWaiverFields = {
  prior_waiver_authority: { type: 'string', description: 'The medical authority that granted the previous waiver (for example AFMC/A3OM, or the waiver-issuing authority named in the document)' },
  prior_waiver_expiration: { type: 'string', description: 'Expiration date of the previous waiver, in YYYY-MM-DD format' }
};

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

const extractionSchema = (conditions, kind) => ({
  type: 'object',
  properties: {
    ...(kind === PRIOR_WAIVER ? priorWaiverFields : {}),
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
    ...priorWaiverFields,
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

// Text-based records (csv/json/txt/html) are read straight from the document, so nothing is guessed.
const TEXT_FILE = /\.(csv|tsv|json|txt|html?|md)$/i;

const PRIOR_WAIVER_NOTE = `This document is the member's PREVIOUSLY GRANTED aeromedical waiver, or the aeromedical summary written for it. Extract the previously waived condition(s), the granting authority, the waiver expiration date, and the clinical information the document records.`;

const EXTRACT_PROMPT = (conditions, documentText, kind) => `The full text of an uploaded medical document (a chart note, consult, lab or imaging report, or a table of results) appears below. Extract the information needed for a USAF aeromedical waiver package${conditions.length ? ` for ${conditions.join('; ')}` : ''}.
${kind === PRIOR_WAIVER ? `\n${PRIOR_WAIVER_NOTE}\n` : ''}
DOCUMENT TEXT:
${documentText}

Return JSON matching the schema: every documented diagnosis (each with the USAF waiver guide section it maps to), plus the documented history, studies and testing with key results, medications, treatment course, and current clinical status.

Copy only what the document states — never invent, infer, or extrapolate a finding. If this text is not a medical record, use an empty conditions array and empty strings.`;

const CURATION_PROMPT = (data, conditions, raw, kind) => {
  const scoped = conditions.length > 0;
  const priorRule = kind === PRIOR_WAIVER
    ? `- prior_waiver_authority and prior_waiver_expiration: keep the granting authority and the expiration date exactly as the document states them.`
    : '';
  const conditionsRule = scoped
    ? `- conditions: only diagnoses from the document that are themselves relevant to this waiver AND are not already listed above as the member's waiver conditions. Omit every incidental or unrelated diagnosis, including specialty findings discovered incidentally.`
    : `- conditions: every diagnosis or condition documented in the record that bears on an aeromedical waiver, each mapped to the exact USAF waiver guide section name. No condition has been listed for this member yet, so the diagnoses come from the document.`;
  const detailRule = scoped
    ? `- diagnostics: only the labs, imaging, and specialty evaluations the USAF waiver guide requires or recommends for the listed condition(s), with their results. Omit any test, panel, or consult the waiver does not require, even when it appears in the same document or the same lab panel — for example, if a CBC is required and the same panel also included an HIV test, keep the CBC and omit the HIV result.
- history, medications, treatment_course, current_status: keep only content that documents the listed condition(s); drop detail about unrelated conditions.`
    : `- diagnostics: the labs, imaging, and specialty evaluations documented for the conditions you listed, with their results.
- history, medications, treatment_course, current_status: the documented detail for the conditions you listed.`;
  const closingRule = scoped
    ? `Rules: never invent, infer, or extrapolate a finding — copy what is documented. Do not drop information the waiver requires for the listed condition(s). If nothing in the raw extraction is required or relevant, return empty strings and an empty conditions array.`
    : `Rules: never invent, infer, or extrapolate a finding — copy what is documented. If the document contains no diagnosis at all, return empty strings and an empty conditions array.`;

  return `You are a USAF aerospace medicine waiver reviewer assembling an aeromedical waiver package. A medical document was extracted, but that document may contain information the waiver package does not need.

MEMBER'S WAIVER CONDITION(S):
${scoped ? conditions.map((c, i) => `  ${i + 1}. ${c}`).join('\n') : '  (none listed yet — the document is the starting point, so take the diagnoses from it)'}
${data.flying_class ? `- Flying class / duty: ${data.flying_class}` : ''}

RAW EXTRACTION FROM THE UPLOADED DOCUMENT:
${JSON.stringify(raw || {}, null, 2)}

TASK
Return the same structure, keeping what this waiver package requires:
${conditionsRule}
${detailRule}
${priorRule}
${closingRule}

Return the result as JSON matching the provided schema.`;
};

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
    const kind = body.document_kind === PRIOR_WAIVER ? PRIOR_WAIVER : 'medical_record';

    let extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed_url,
      json_schema: extractionSchema(conditions, kind)
    });

    let output = extraction?.output;

    // Text records (csv/json/txt/html) cannot be validated row-by-row against this schema,
    // so read the text itself rather than losing the document — and never guess at it.
    if ((extraction?.status !== 'success' || !output) && TEXT_FILE.test(file_uri)) {
      try {
        const docResponse = await fetch(signed_url);
        const documentText = docResponse.ok ? (await docResponse.text()).slice(0, 20000) : '';
        if (documentText.trim()) {
          output = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: EXTRACT_PROMPT(conditions, documentText, kind),
            response_json_schema: extractionSchema(conditions, kind)
          });
          extraction = { status: 'success', details: null, output };
        }
      } catch (e) {
        output = null;
      }
    }

    if (extraction?.status === 'success' && output) {
      try {
        const curated = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: CURATION_PROMPT(body, conditions, output, kind),
          add_context_from_internet: true,
          model: 'gemini_3_8_flash',
          response_json_schema: CURATION_SCHEMA
        });
        if (curated && typeof curated === 'object') {
          output = kind === PRIOR_WAIVER
            ? {
                ...curated,
                prior_waiver_authority: curated.prior_waiver_authority || output.prior_waiver_authority || '',
                prior_waiver_expiration: curated.prior_waiver_expiration || output.prior_waiver_expiration || ''
              }
            : curated;
        }
      } catch (e) {
        // keep the unscreened extraction rather than losing the document data
      }
    }

    return Response.json({ extraction: { ...extraction, output } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}