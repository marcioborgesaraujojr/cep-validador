// Callback do OAuth Bling — salva o refresh token no Edge Config (solucao definitiva)
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

async function salvarToken(refreshToken) {
  const results = [];

  // 1. Salva no Edge Config (principal — sem caching, dinamico)
  const ec = parseEC();
  if (ec && process.env.VERCEL_TOKEN) {
    try {
      const r = await fetch(
        "https://api.vercel.com/v1/edge-config/" + ec.ecId + "/items",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + process.env.VERCEL_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [{ operation: "upsert", key: "bling_refresh_token", value: refreshToken }]
          }),
        }
      );
      results.push("Edge Config: " + (r.ok ? "OK" : "ERRO " + r.status));
    } catch (e) {
      results.push("Edge Config: EXCECAO " + e.message);
    }
  } else {
    results.push("Edge Config: NAO CONFIGURADO");
  }

  // 2. Salva na env var do Vercel (fallback — pode ter delay de caching)
  if (process.env.VERCEL_TOKEN) {
    try {
      const listR = await fetch(
        "https://api.vercel.com/v9/projects/" + PROJ + "/env?teamId=" + TEAM,
        { headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN } }
      );
      const listD = await listR.json();
      const env = (listD.envs || []).find(e => e.key === "BLING_REFRESH_TOKEN");
      if (env) {
        const pR = await fetch(
          "https://api.vercel.com/v9/projects/" + PROJ + "/env/" + env.id + "?teamId=" + TEAM,
          {
            method: "PATCH",
            headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN, "Content-Type": "application/json" },
            body: JSON.stringify({ value: refreshToken }),
          }
        );
        results.push("Env var: " + (pR.ok ? "OK" : "ERRO " + pR.status));
      }
    } catch (e) {
      results.push("Env var: EXCECAO " + e.message);
    }
  }

  return results;
}

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send("Parametro code ausente.");

  const creds = Buffer.from(
    process.env.BLING_CLIENT_ID + ":" + process.env.BLING_CLIENT_SECRET
  ).toString("base64");

  const tokenRes = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + creds },
    body: "grant_type=authorization_code&code=" + encodeURIComponent(code),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.refresh_token) {
    return res.status(500).send("Erro ao obter token: " + JSON.stringify(tokenData));
  }

  const results = await salvarToken(tokenData.refresh_token);
  const allOk = results.some(r => r.includes("OK"));

  const statusColor = allOk ? "green" : "orange";
  const statusMsg = allOk
    ? "Token salvo com sucesso!"
    : "Salvamento parcial — verifique os detalhes abaixo.";

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
      <h2>Autorizacao concluida!</h2>
      <p style="color:${statusColor};font-weight:bold">${statusMsg}</p>
      <ul>${results.map(r => '<li>' + r + '</li>').join('')}</ul>
      <p style="margin-top:16px;font-size:13px;color:#888">
        Refresh token: <code style="font-size:11px">${tokenData.refresh_token}</code>
      </p>
      <p><a href="/">Voltar ao app</a></p>
    </body></html>
  `);
}
