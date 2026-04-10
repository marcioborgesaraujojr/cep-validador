// /api/situacoes.js
// Retorna situacoes padrao do Bling V3 sem autenticacao
// Nao consome o refresh token - evita conflito com /api/pedidos

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Situacoes padrao do Bling V3 (id confirmado via debug)
  // id:6 = Em aberto, id:9 = Atendido, id:12 = Cancelado, etc.
  const situacoes = [
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

  return res.json({ situacoes });
}
