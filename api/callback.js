const PROJ = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
const TEAM = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";

async function salvarTokenNoVercel(refreshToken) {
  if (!process.env.VERCEL_TOKEN) return false;
  try {
    // Busca o ID dinamico do env BLING_REFRESH_TOKEN
    const listR = await fetch(
      "https://api.vercel.com/v9/projects/" + PROJ + "/env?teamId=" + TEAM,
      { headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN } }
    );
    const listD = await listR.json();
    const env = (listD.envs || []).find(e => e.key === "BLING_REFRESH_TOKEN");
    if (!env) return false;

    const patchR = await fetch(
      "https://api.vercel.com/v9/projects/" + PROJ + "/env/" + env.id + "?teamId=" + TEAM,
      {
        method: "PATCH",
        headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ value: refreshToken }),
      }
    );
    return patchR.ok;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  const { code, state } = req.query;
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

  const saved = await salvarTokenNoVercel(tokenData.refresh_token);

  const statusMsg = saved
    ? "<p style='color:green'>Token salvo automaticamente no Vercel!</p>"
    : "<p style='color:orange'>Nao foi possivel salvar automaticamente. Copie o token abaixo e adicione manualmente no Vercel como <b>BLING_REFRESH_TOKEN</b>:</p>";

  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
      <h2>Autorizacao concluida!</h2>
      ${statusMsg}
      <textarea rows="3" style="width:100%;font-family:monospace;font-size:13px">${tokenData.refresh_token}</textarea>
      <p style="margin-top:16px">
        <b>Passos para uso manual:</b> Vercel &rarr; Settings &rarr; Environment Variables &rarr; Atualizar <code>BLING_REFRESH_TOKEN</code> &rarr; Redeploy
      </p>
      <p><a href="/">Voltar ao app</a></p>
    </body></html>
  `);
}
