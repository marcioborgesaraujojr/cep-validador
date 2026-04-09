const BASE = "https://cep-validador-indol.vercel.app";

async function getAccessToken() {
      const id = process.env.BLING_CLIENT_ID;
      const secret = process.env.BLING_CLIENT_SECRET;
      const refresh = process.env.BLING_REFRESH_TOKEN;
      if (!refresh) throw new Error("BLING_REFRESH_TOKEN nao configurado. Visite /api/setup");
      const creds = Buffer.from(id + ":" + secret).toString("base64");
      const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + creds },
              body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh)
      });
      const d = await r.json();
      if (!d.access_token) throw new Error("Token invalido: " + JSON.stringify(d));
      return d.access_token;
}

export default async function handler(req, res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.method === "OPTIONS") return res.status(200).end();
      const { data_inicio, data_fim, pagina = 1 } = req.query;
      if (!data_inicio || !data_fim) return res.status(400).json({ erro: "data_inicio e data_fim obrigatorios" });
      try {
              const token = await getAccessToken();
              const params = new URLSearchParams({ dataInicial: data_inicio, dataFinal: data_fim, pagina: pagina, limite: 100 });
              const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas?" + params, {
                        headers: { "Authorization": "Bearer " + token }
              });
              const d = await r.json();
              if (!r.ok) return res.status(r.status).json({ erro: "Bling API " + r.status, detalhe: d });
              const pedidos = (d.data || []).map(function(p) {
                        var end = (p.transporte && p.transporte.destinatario) || {};
                        return {
                                    numero: p.numero,
                                    cliente: (p.contato && p.contato.nome) || "",
                                    telefone: (p.contato && p.contato.telefone) || "",
                                    cep: end.cep || "",
                                    endereco: end.endereco || "",
                                    bairro: end.bairro || "",
                                    cidade: end.municipio || "",
                                    estado: end.uf || "",
                                    situacao: (p.situacao && p.situacao.valor) || "",
                                    data: p.data || "",
                        };
              });
              return res.json({ total: d.total || pedidos.length, pagina: Number(pagina), pedidos: pedidos });
      } catch (err) {
              return res.status(500).json({ erro: err.message });
      }
}
