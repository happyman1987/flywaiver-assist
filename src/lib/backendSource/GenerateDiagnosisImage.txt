import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const diagnosis = (body?.diagnosis || '').toString().trim();
    if (!diagnosis) return Response.json({ error: 'diagnosis is required' }, { status: 400 });

    const prompt = `A clean, minimal flat-vector medical illustration representing the condition "${diagnosis}". Soft blue and teal palette on a plain white background, simple clinical icon style, centered, no text, no words, no letters, professional aeromedical aesthetic.`;

    const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    return Response.json({ url: result.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}