// Callback do OAuth Bling — salva refresh token, cacheia access_token, redireciona automaticamente
const PROJ = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
const TEAM = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";

function parseEC() {
  try {
    const u = new URL(process.env.EDGE_CONFIG || "");
    const ecId = u.pathname.replace(/^\//, "");
    const token = u.searchParams.get("token");
    return ecId && token ? { ecId, token } : null;
  } catch (_) { return null; }
}

async function salvarNoEdgeConfig(items) {
  const ec = parseEC();
  if (!ec || !process.env.VERCEL_TOKEN) return false;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://api.vercel.com/v1/edge-config/" + ec.ecId + "/items", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (r.ok) return true;
    } catch (_) {}
    if (i < 2) await new Promise(res => setTimeout(res, 200));
  }
  return false;
}

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send("Parametro code ausente.");

  const creds = Buffer.from(process.env.BLING_CLIENT_ID + ":" + process.env.BLING_CLIENT_SECRET).toString("base64");
  const tokenRes = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + creds },
    body: "grant_type=authorization_code&code=" + encodeURIComponent(code),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.refresh_token) return res.status(500).send("Erro ao obter token: " + JSON.stringify(tokenData));

  // Salva refresh_token E cacheia access_token (55min) num unico PATCH para atomicidade
  const cache = JSON.stringify({ token: tokenData.access_token, expires: Date.now() + 55 * 60 * 1000 });
  await salvarNoEdgeConfig([
    { operation: "upsert", key: "bling_refresh_token", value: tokenData.refresh_token },
    { operation: "upsert", key: "bling_access_cache", value: cache },
  ]);

  // Redireciona automaticamente, salvando access_token no sessionStorage do browser
  const at = tokenData.access_token || '';
  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:sans-serif;text-align:center;padding:60px;color:#888">
      <p>✓ Conectado ao Bling! Redirecionando...</p>
      <script>
        try { sessionStorage.setItem('bling_at', '${at}'); } catch(_) {}
        sessionStorage.removeItem('cep_redo');
        sessionStorage.removeItem('cep_redirect_after_auth');
        window.location.href = '/';
      </script>
    </body></html>
  `);
}
