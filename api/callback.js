export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.send("<h2>Erro: code nao encontrado na URL</h2>");
  const id = process.env.BLING_CLIENT_ID;
  const secret = process.env.BLING_CLIENT_SECRET;
  const redirect = "https://cep-validador-indol.vercel.app/api/callback";
  const creds = Buffer.from(id + ":" + secret).toString("base64");
  try {
    const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + creds },
            body: "grant_type=authorization_code&code=" + encodeURIComponent(code) + "&redirect_uri=" + encodeURIComponent(redirect)
      });
    const d = await r.json();
    if (!d.refresh_token) return res.send("<h2>Erro</h2><pre>" + JSON.stringify(d, null, 2) + "</pre>");
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
<h2>Autorizacao concluida!</h2>
<p>Copie o <strong>Refresh Token</strong> abaixo e adicione no Vercel como <code>BLING_REFRESH_TOKEN</code>:</p>
<textarea onclick="this.select()" style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px">${d.refresh_token}</textarea>
<p>Passos: Vercel -> Settings -> Environment Variables -> Add: <code>BLING_REFRESH_TOKEN</code> -> Redeploy</p>
</body></html>`);
} catch(e) { res.send("Erro: " + e.message); }
}
