// api/pedidos.js — proxy para a API da Loja Integrada
// Roda no servidor Vercel, evitando o bloqueio CORS do navegador

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const API_KEY = process.env.LI_API_KEY;   // chave de API (painel LI → Dados da Loja → API)
  const APP_KEY = process.env.LI_APP_KEY;   // chave do aplicativo

  if (!API_KEY || !APP_KEY) {
    return res.status(500).json({ erro: "Variáveis de ambiente LI_API_KEY e LI_APP_KEY não configuradas." });
  }

  const { data_inicio, data_fim, offset = 0 } = req.query;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({ erro: "Parâmetros data_inicio e data_fim são obrigatórios (formato: YYYY-MM-DD)" });
  }

  const BASE = "https://api.awsli.com.br/v1";
  const params = new URLSearchParams({
    chave: APP_KEY,
    formato: "json",
    limit: 200,
    offset,
    data_criacao_gte: `${data_inicio} 00:00:00`,
    data_criacao_lte: `${data_fim} 23:59:59`,
  });

  try {
    const liRes = await fetch(`${BASE}/pedido/?${params}`, {
      headers: { Authorization: `chave ${API_KEY}` },
    });

    if (!liRes.ok) {
      const text = await liRes.text();
      return res.status(liRes.status).json({ erro: `Erro LI API: ${liRes.status}`, detalhe: text });
    }

    const data = await liRes.json();

    // Retorna apenas os campos que precisamos (menos payload)
    const pedidos = (data.objects || []).map((p) => ({
      numero: p.numero,
      cliente: p.cliente?.nome || "—",
      telefone: p.cliente?.telefone || "",
      email: p.cliente?.email || "",
      cep: p.envio?.endereco?.cep || "",
      endereco: p.envio?.endereco?.endereco || "",
      numero_end: p.envio?.endereco?.numero || "",
      bairro: p.envio?.endereco?.bairro || "",
      cidade: p.envio?.endereco?.cidade || "",
      estado: p.envio?.endereco?.estado || "",
      situacao: p.situacao?.label || "",
      data_criacao: p.data_criacao || "",
    }));

    return res.json({
      total: data.meta?.total_count || pedidos.length,
      offset: Number(offset),
      pedidos,
    });
  } catch (err) {
    return res.status(500).json({ erro: "Falha ao conectar com a LI API", detalhe: err.message });
  }
}
