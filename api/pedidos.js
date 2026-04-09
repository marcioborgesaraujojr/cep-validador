const PROJ = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
const TEAM = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";

async function getEnvId() {
  try {
    const r = await fetch(
      "https://api.vercel.com/v9/projects/" + PROJ + "/env?teamId=" + TEAM,
      { headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN } }
    );
    if (!r.ok) return process.env.VERCEL_ENV_ID || null;
    const d = await r.json();
    const env = (d.envs || []).find(e => e.key === "BLING_REFRESH_TOKEN");
    return env ? env.id : (process.env.VERCEL_ENV_ID || null);
  } catch (_) { return process.env.VERCEL_ENV_ID || null; }
}

async function salvarRefreshToken(novoToken) {
  if (!process.env.VERCEL_TOKEN) return;
  try {
    const envId = await getEnvId();
    if (!envId) return;
    await fetch(
      "https://api.vercel.com/v9/projects/" + PROJ + "/env/" + envId + "?teamId=" + TEAM,
      {
        method: "PATCH",
        headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ value: novoToken }),
      }
    );
  } catch (_) {}
}

async function getAccessToken() {
  const refreshToken = process.env.BLING_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("BLING_REFRESH_TOKEN nao configurado. Acesse /api/setup.");

  const creds = Buffer.from(
    process.env.BLING_CLIENT_ID + ":" + process.env.BLING_CLIENT_SECRET
  ).toString("base64");

  const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + creds },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
  });

  const d = await r.json();
  if (!d.access_token) throw new Error("Token expirado. Acesse /api/setup para reconectar o Bling.");

  // CRITICO: aguarda o save antes de retornar — Vercel mata a funcao apos a resposta
  if (d.refresh_token && d.refresh_token !== refreshToken) {
    await salvarRefreshToken(d.refresh_token);
  }

  return d.access_token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Endpoint de detalhe individual: /api/pedidos?id=123
  if (req.query.id) {
    try {
      const token = await getAccessToken();
      const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas/" + req.query.id, {
        headers: { Authorization: "Bearer " + token },
      });
      const d = await r.json();
      const det = d.data || {};
      const dest = (det.transporte && det.transporte.destinatario) || {};
      const cep = (dest.cep || "").replace(/\D/g, "");
      return res.json({
        cep,
        endereco: dest.endereco || "",
        complemento: dest.complemento || "",
        bairro: dest.bairro || "",
        cidade: dest.municipio || "",
        estado: dest.uf || "",
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // Endpoint de lista: /api/pedidos?data_inicio=...&data_fim=...
  const { data_inicio, data_fim, pagina = 1 } = req.query;
  if (!data_inicio || !data_fim) return res.status(400).json({ erro: "data_inicio e data_fim obrigatorios" });

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ dataInicial: data_inicio, dataFinal: data_fim, pagina, limite: 100 });
    const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas?" + params, {
      headers: { Authorization: "Bearer " + token },
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ erro: "Bling API " + r.status });

    const pedidos = (d.data || []).map(p => ({
      id: p.id,
      numero: p.numero,
      cliente: (p.contato && p.contato.nome) || "",
      telefone: (p.contato && (p.contato.telefone || p.contato.celular)) || "",
      situacao: (p.situacao && p.situacao.valor) || "",
      data: p.data || "",
    }));

    return res.json({ total: d.total || pedidos.length, pagina: Number(pagina), pedidos });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}
