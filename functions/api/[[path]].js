export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: cors });
  if (!env.GAS_WEBAPP_URL || !env.ACCOQUEST_API_KEY) {
    return Response.json({ ok: false, error: "Cloudflare environment variables belum ditetapkan." }, { status: 500, headers: cors });
  }
  try {
    const body = await request.json();
    if (!body || typeof body.action !== "string" || !body.data || typeof body.data !== "object") {
      return Response.json({ ok: false, error: "Invalid request payload." }, { status: 400, headers: cors });
    }
    const upstream = await fetch(env.GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: body.action, data: body.data, apiKey: env.ACCOQUEST_API_KEY }),
      redirect: "follow"
    });
    const raw = await upstream.text();

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = {
            ok: false,
            error: "Backend Apps Script tidak memulangkan JSON yang sah."
        };
    }
    
    return Response.json(parsed, {
        status: upstream.ok ? 200 : upstream.status,
        headers: cors
    });
