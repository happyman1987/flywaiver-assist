import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string', description: 'Primary diagnosis or condition relevant to the waiver' },
    category: { type: 'string', description: 'Waiver guide specialty category, e.g. Cardiology, Neurology' },
    history: { type: 'string', description: 'History of present illness and relevant past medical history' },
    diagnostics: { type: 'string', description: 'Studies and testing performed with key results' },
    medications: { type: 'string', description: 'Current and recent medications' },
    treatment_course: { type: 'string', description: 'Treatment course undertaken' },
    current_status: { type: 'string', description: 'Current clinical status and functional capacity' }
  }
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

    const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed_url,
      json_schema: EXTRACTION_SCHEMA
    });

    return Response.json({ extraction });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}