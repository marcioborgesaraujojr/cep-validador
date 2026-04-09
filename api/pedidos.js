async function getTokens() {
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
        if (!d.access_token) throw new Error("Token invalido. Reconecte em /api/setup. Detalhe: " + JSON.stringify(d));
        return { access_token: d.access_token, new_refresh: d.refresh_token };
}

async function updateRefreshToken(newToken) {
        try {
                  const projectId = process.env.VERCEL_PROJECT_ID || "prj_8RjMkBqLz5K9wQXvNmF3dTpYcEhA";
                  const envId = process.env.BLING_REFRESH_TOKEN_ENV_ID;
                  const vercelToken = process.env.VERCEL_ACCESS_TOKEN;
                  if (!vercelToken || !envId) return;
                  await fetch("https://api.vercel.com/v9/projects/" + projectId + "/env/" + envId, {
                              method: "PATCH",
                              headers: { "Authorization": "Bearer " + vercelToken, "Content-Type": "application/json" },
                              body: JSON.stringify({ value: newToken })
                  });
        } catch(e) { /* silently fail */ }
}

export default async function handler(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (req.method === "OPTIONS") return res.status(200).end();
        const { data_inicio, data_fim, pagina = 1 } = req.query;
        if (!data_inicio || !data_fim) return res.status(400).json({ erro: "data_inicio e data_fim obrigatorios" });
        try {
                  const { access_token, new_refresh } = await getTokens();
                  if (new_refresh) updateRefreshToken(new_refresh);

          const params = new URLSearchParams({ dataInicial: data_inicio, dataFinal: data_fim, pagina: pagina, limite: 100 });
                  const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas?" + params, {
                              headers: { "Authorization": "Bearer " + access_token }
                  });
                  const d = await r.json();
                  if (!r.ok) return res.status(r.status).json({ erro: "Bling API " + r.status, detalhe: d });

          const pedidos = (d.data || []).map(function(p) {
                      var transp = p.transporte || {};
                      var dest = transp.destinatario || {};
                      var end = dest.endereco || {};
                      var contato = p.contato || {};
                      return {
                                    numero: p.numero,
                                    cliente: contato.nome || "",
                                    telefone: contato.telefone || contato.celular || "",
                                    cep: (dest.cep || end.cep || "").replace(/\D/g,""),
                                    endereco: dest.endereco || end.logradouro || "",
                                    bairro: dest.bairro || end.bairro || "",
                                    cidade: dest.municipio || end.municipio || "",
                                    estado: dest.uf || end.uf || "",
                                    situacao: (p.situacao && p.situacao.valor) || "",
                                    data: p.data || "",
                      };
          });

          return res.json({
                      total: d.total || pedidos.length,
                      pagina: Number(pagina),
                      pedidos: pedidos,
                      novo_refresh: new_refresh || null
          });
        } catch (err) {
                  return res.status(500).json({ erro: err.message });
        }
}
