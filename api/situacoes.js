// /api/situacoes.js
// Retorna situacoes do Bling - aceita token passado para nao consumir refresh token
// Se token passado via ?token=, usa direto. Senao retorna fallback estatico.

const FALLBACK = [
  { id: 6,  nome: "Em aberto" },
  { id: 9,  nome: "Atendido" },
  { id: 11, nome: "Verificado" },
  { id: 12, nome: "Cancelado" },
  { id: 15, nome: "Em andamento" },
  { id: 3,  nome: "Checkout parcial" },
  { id: 4,  nome: "Aguardando pagamento" },
  { id: 8,  nome: "Devolucao total" },
  { id: 2,  nome: "Nao utilizada" },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const passedToken = req.query.token;

  // Se nao veio token, retorna fallback imediatamente (nao consome refresh token)
  if (!passedToken) {
    return res.json({ situacoes: FALLBACK, source: "fallback" });
  }

  // Token passado pelo frontend (ja obtido pelo /api/pedidos) - usa direto
  try {
    const r = await fetch("https://www.bling.com.br/Api/v3/situacoes?tipo=2", {
      headers: { Authorization: "Bearer " + passedToken },
    });

    if (!r.ok) return res.json({ situacoes: FALLBACK, source: "fallback_api_err" });

    const d = await r.json();
    const custom = (d.data || []).map(s => ({ id: s.id, nome: s.nome })).filter(s => s.id && s.nome);

    // Merge: FALLBACK como base + customizadas por cima
    const mapa = {};
    FALLBACK.forEach(s => { mapa[s.id] = s.nome; });
    custom.forEach(s => { mapa[s.id] = s.nome; });

    const situacoes = Object.entries(mapa).map(([id, nome]) => ({ id: Number(id), nome }));
    return res.json({ situacoes, source: "bling" });

  } catch (err) {
    return res.json({ situacoes: FALLBACK, source: "fallback_catch" });
  }
}
