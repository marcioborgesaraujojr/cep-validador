async function saveNewRefreshToken(newToken) {
          try {
                      const vToken = process.env.VERCEL_TOKEN;
                      const envId = process.env.VERCEL_ENV_ID;
                      const projId = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
                      const teamId = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";
                      if (!vToken || !envId) return;
                      await fetch("https://api.vercel.com/v9/projects/" + projId + "/env/" + envId + "?teamId=" + teamId, {
                                    method: "PATCH",
                                    headers: { "Authorization": "Bearer " + vToken, "Content-Type": "application/json" },
                                    body: JSON.stringify({ value: newToken })
                      });
          } catch(e) { /* silently ignore */ }
}

async function getAccessToken() {
          const id = process.env.BLING_CLIENT_ID;
          const secret = process.env.BLING_CLIENT_SECRET;
          const refresh = process.env.BLING_REFRESH_TOKEN;
          if (!refresh) throw new Error("Token nao configurado. Acesse /api/setup para autorizar.");
          const creds = Buffer.from(id + ":" + secret).toString("base64");
          const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + creds },
                      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh)
          });
          const d = await r.json();
          if (!d.access_token) throw new Error("Token invalido. Acesse /api/setup para reconectar.");
          if (d.refresh_token) saveNewRefreshToken(d.refresh_token);
          return d.access_token;
}

export default async function handler(req, res) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          if (req.method === "OPTIONS") return res.status(200).end();
          const { data_inicio, data_fim, pagina = 1 } = req.query;
          if (!data_inicio || !data_fim) return res.status(400).json({ erro: "data_inicio e data_fim obrigatorios" });
          try {
                      const token = await getAccessToken();
                      const params = new URLSearchParams({ dataInicial: data_inicio, dataFinal: data_fim, pagina, limite: 100 });
                      const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas?" + params, {
                                    headers: { "Authorization": "Bearer " + token }
                      });
                      const d = await r.json();
                      if (!r.ok) return res.status(r.status).json({ erro: "Bling API " + r.status, detalhe: d });
                      const pedidos = (d.data || []).map(function(p) {
                                    var dest = (p.transporte && p.transporte.destinatario) || {};
                                    var contato = p.contato || {};
                                    return {
                                                    numero: p.numero,
                                                    cliente: contato.nome || "",
                                                    telefone: contato.telefone || contato.celular || "",
                                                    cep: (dest.cep || "").replace(/\D/g, ""),
                                                    endereco: dest.endereco || "",
                                                    bairro: dest.bairro || "",
                                                    cidade: dest.municipio || "",
                                                    estado: dest.uf || "",
                                                    situacao: (p.situacao && p.situacao.valor) || "",
                                                    data: p.data || "",
                                    };
                      });
                      return res.json({ total: d.total || pedidos.length, pagina: Number(pagina), pedidos });
          } catch (err) {
                      return res.status(500).json({ erro: err.message });
          }
}
