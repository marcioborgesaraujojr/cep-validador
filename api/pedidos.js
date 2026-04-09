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
  if (d.refresh_token && d.refresh_token !== refreshToken) {
    await salvarRefreshToken(d.refresh_token);
  }
  return d.access_token;
}

function extrairEndereco(det) {
  const etiqueta = (det.transporte && det.transporte.etiqueta) || {};
  const transpContato = (det.transporte && det.transporte.contato) || {};
  const dest = [etiqueta, transpContato].find(d => d && d.cep) || etiqueta || {};
  return {
    cep: (dest.cep || "").replace(/\D/g, ""),
    endereco: dest.endereco || "",
    numero: dest.numero || "",
    complemento: dest.complemento || "",
    bairro: dest.bairro || "",
    cidade: dest.municipio || "",
    estado: dest.uf || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id, token: passedToken, data_inicio, data_fim, pagina = 1 } = req.query;

  // --- ENDPOINT DE DETALHE ---
  if (id) {
    const token = passedToken || await getAccessToken();
    try {
      const blingRes = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas/" + id, {
        headers: { Authorization: "Bearer " + token },
      });
      const blingStatus = blingRes.status;
      const d = await blingRes.json();

      // Debug: mostra resposta BRUTA completa do Bling
      if (req.query._debug) {
        return res.json({
          bling_status: blingStatus,
          bling_error: d.error || null,
          has_data: !!d.data,
          data_keys: d.data ? Object.keys(d.data) : [],
          transporte_keys: (d.data && d.data.transporte) ? Object.keys(d.data.transporte) : [],
          etiqueta: (d.data && d.data.transporte && d.data.transporte.etiqueta) || null,
          token_prefix: (passedToken || token).substring(0, 8) + "...",
        });
      }

      if (!blingRes.ok) return res.status(blingStatus).json({ erro: "Bling " + blingStatus, detail: d });
      const det = d.data || {};
      return res.json(extrairEndereco(det));
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // --- ENDPOINT DE LISTA ---
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

    return res.json({ total: d.total || pedidos.length, pagina: Number(pagina), pedidos, _t: token });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}
