// /api/// Busca situacoes de pedidos de venda do Bling dinamicamente
// Inclui situacoes padrao + customizadas (ex: "Atendido: DRACHARM")

function parseEC() {
  try {
    const u = new URL(process.env.EDGE_CONFIG || "");
    const ecId = u.pathname.replace(/^\//, "");
    const token = u.searchParams.get("token");
    return ecId && token ? { ecId, token } : null;
  } catch (_) { return null; }
}

async function lerRefreshToken() {
  const ec = parseEC();
  if (ec) {
    try {
      const r = await fetch("https://edge-config.vercel.com/" + ec.ecId + "/item/bling_refresh_token?token=" + ec.token);
      if (r.ok) { const val = await r.json(); if (val) return val; }
    } catch (_) {}
  }
  return process.env.BLING_REFRESH_TOKEN || null;
}

async function getAccessToken() {
  const refreshToken = await lerRefreshToken();
  if (!refreshToken) throw new Error("Refresh token nao configurado.");
  const creds = Buffer.from(process.env.BLING_CLIENT_ID + ":" + process.env.BLING_CLIENT_SECRET).toString("base64");
  const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + creds },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("Token invalido.");
  return d.access_token;
}

// Situacoes padrao do Bling como fallback
const FALLBACK = [
  { id: 6,  nome: "Em aberto" },
  { id: 9,  nome: "Atendido" },
  { id: 11, nome: "Verificado" },
  { id: 12, nome: "Cancelado" },
  { id: 15, nome: "Em andamento" },
  { id: 3,  nome: "Checkout parcial" },
  { id: 4,  nome: "Aguardando pagamento" },
  { id: 8,  nome: "Devolucao total" },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const token = await getAccessToken();
    // tipo=2 = pedidos de venda (inclui customizadas)
    const r = await fetch("https://www.bling.com.br/Api/v3/situacoes?tipo=2", {
      headers: { Authorization: "Bearer " + token },
    });

    if (!r.ok) return res.json({ situacoes: FALLBACK });

    const d = await r.json();
    const situacoes = (d.data || []).map(s => ({ id: s.id, nome: s.nome }));

    return res.json({ situacoes: situacoes.length ? situacoes : FALLBACK });
  } catch (err) {
    return res.json({ situacoes: FALLBACK });
  }
}
