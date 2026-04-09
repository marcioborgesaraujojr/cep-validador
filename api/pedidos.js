// Cache em memoria - evita re-usar o refresh token na mesma sessao
let _accessToken = null;
let _tokenExpiry = 0;

const PROJ = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
const TEAM = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";
const ENV_ID = "z4YNrp6AOlO8heUG";

async function persistNewRefreshToken(newToken) {
              const vToken = process.env.VERCEL_TOKEN;
              if (!vToken || !newToken) return;
              try {
                              // Atualiza env var
                await fetch("https://api.vercel.com/v9/projects/" + PROJ + "/env/" + ENV_ID + "?teamId=" + TEAM, {
                                  method: "PATCH",
                                  headers: { "Authorization": "Bearer " + vToken, "Content-Type": "application/json" },
                                  body: JSON.stringify({ value: newToken })
                });
                              // Dispara redeploy automatico para a proxima sessao ja pegar o token novo
                fetch("https://api.vercel.com/v13/deployments?teamId=" + TEAM, {
                                  method: "POST",
                                  headers: { "Authorization": "Bearer " + vToken, "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: "cep-validador", deploymentId: process.env.VERCEL_DEPLOYMENT_ID, target: "production" })
                }).catch(() => {});
              } catch(e) { /* silently ignore */ }
}

async function getAccessToken() {
              const now = Date.now();
              // Usa token em cache se ainda valido
  if (_accessToken && now < _tokenExpiry) return _accessToken;

  const id = process.env.BLING_CLIENT_ID;
              const secret = process.env.BLING_CLIENT_SECRET;
              const refresh = process.env.BLING_REFRESH_TOKEN;
              if (!refresh) throw new Error("Token nao configurado. Acesse /api/setup");
              const creds = Buffer.from(id + ":" + secret).toString("base64");
              const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
                              method: "POST",
                              headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + creds },
                              body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh)
              });
              const d = await r.json();
              if (!d.access_token) throw new Error("Token expirado. Acesse /api/setup para reconectar.");
              _accessToken = d.access_token;
              _tokenExpiry = now + 50 * 60 * 1000; // cache por 50 min (token dura 60 min)
  if (d.refresh_token) persistNewRefreshToken(d.refresh_token);
              return _accessToken;
}

async function getPedidoDetalhe(token, id) {
              try {
                              const r = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas/" + id, {
                                                headers: { "Authorization": "Bearer " + token }
                              });
                              const d = await r.json();
                              return d.data || null;
              } catch(e) { return null; }
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
                              if (!r.ok) return res.status(r.status).json({ erro: "Bling API " + r.status });
                              const lista = d.data || [];
                              const detalhes = await Promise.all(lista.map(p => getPedidoDetalhe(token, p.id)));
                              const pedidos = lista.map(function(p, i) {
                                                var det = detalhes[i] || {};
                                                var dest = (det.transporte && det.transporte.destinatario) || {};
                                                var contato = det.contato || p.contato || {};
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
