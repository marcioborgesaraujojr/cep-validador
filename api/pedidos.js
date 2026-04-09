export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(200).end();

  const CHAVE = process.env.LI_APP_KEY;

  if (!CHAVE) {
        return res.status(500).json({ erro: "Variavel LI_APP_KEY nao configurada." });
  }

  const { data_inicio, data_fim, offset = 0 } = req.query;

  if (!data_inicio || !data_fim) {
        return res.status(400).json({ erro: "Parametros data_inicio e data_fim sao obrigatorios (YYYY-MM-DD)" });
  }

  const BASE = "https://api.awsli.com.br/v1";
    const params = new URLSearchParams({
          chave: CHAVE,
          formato: "json",
          limit: 200,
          offset: offset,
          data_criacao_gte: data_inicio + " 00:00:00",
          data_criacao_lte: data_fim + " 23:59:59",
    });

  try {
        const liRes = await fetch(BASE + "/pedido/?" + params.toString());

      if (!liRes.ok) {
              const text = await liRes.text();
              return res.status(liRes.status).json({ erro: "Erro LI API: " + liRes.status, detalhe: text });
      }

      const data = await liRes.json();

      const pedidos = (data.objects || []).map(function(p) {
              return {
                        numero: p.numero,
                        cliente: (p.cliente && p.cliente.nome) || "—",
                        telefone: (p.cliente && p.cliente.telefone) || "",
                        email: (p.cliente && p.cliente.email) || "",
                        cep: (p.envio && p.envio.endereco && p.envio.endereco.cep) || "",
                        endereco: (p.envio && p.envio.endereco && p.envio.endereco.endereco) || "",
                        bairro: (p.envio && p.envio.endereco && p.envio.endereco.bairro) || "",
                        cidade: (p.envio && p.envio.endereco && p.envio.endereco.cidade) || "",
                        estado: (p.envio && p.envio.endereco && p.envio.endereco.estado) || "",
                        situacao: (p.situacao && p.situacao.label) || "",
                        data_criacao: p.data_criacao || "",
              };
      });

      return res.json({
              total: (data.meta && data.meta.total_count) || pedidos.length,
              offset: Number(offset),
              pedidos: pedidos,
      });
  } catch (err) {
        return res.status(500).json({ erro: "Falha ao conectar com a LI API", detalhe: err.message });
  }
}
