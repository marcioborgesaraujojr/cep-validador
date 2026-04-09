// ============================================================
// SOLUCAO DEFINITIVA: Edge Config para refresh token rotativo
// O Edge Config e lido/escrito dinamicamente em runtime,
// sem caching — resolve o problema de "token expira sempre".
// ============================================================

// Parse da connection string do Edge Config
function parseEC() {
  try {
    const u = new URL(process.env.EDGE_CONFIG || "");
    const ecId = u.pathname.replace(/^\//, "");
    const token = u.searchParams.get("token");
    return ecId && token ? { ecId, token } : null;
  } catch (_) { return null; }
}

// Le o refresh token: tenta Edge Config primeiro, fallback para env var
async function lerRefreshToken() {
  const ec = parseEC();
  if (ec) {
    try {
      const r = await fetch(
        "https://edge-config.vercel.com/" + ec.ecId + "/item/bling_refresh_token?token=" + ec.token
      );
      if (r.ok) {
        const val = await r.json();
        if (val) return val;
      }
    } catch (_) {}
  }
  return process.env.BLING_REFRESH_TOKEN || null;
}

// Salva o novo refresh token no Edge Config (dinamico, sem caching)
async function salvarRefreshToken(novoToken) {
  const ec = parseEC();
  if (ec && process.env.VERCEL_TOKEN) {
    try {
      const r = await fetch(
        "https://api.vercel.com/v1/edge-config/" + ec.ecId + "/items",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + process.env.VERCEL_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [{ operation: "upsert", key: "bling_refresh_token", value: novoToken }]
          }),
        }
      );
      if (r.ok) return; // Salvo no Edge Config
    } catch (_) {}
  }
  // Fallback: tenta env var (menos confiavel por caching)
  const envId = process.env.VERCEL_ENV_ID;
  const proj = "prj_ErH4xc9FokreQHv0utp1xJ2eGvdO";
  const team = "team_Hv0Wqku1l7HhDDiJZmR2u5Ze";
  if (envId && process.env.VERCEL_TOKEN) {
    try {
      await fetch(
        "https://api.vercel.com/v9/projects/" + proj + "/env/" + envId + "?teamId=" + team,
        {
          method: "PATCH",
          headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ value: novoToken }),
        }
      );
    } catch (_) {}
  }
}

async function getAccessToken() {
  const refreshToken = await lerRefreshToken();
  if (!refreshToken) throw new Error("Refresh token nao configurado. Acesse /api/setup.");

  const creds = Buffer.from(
    process.env.BLING_CLIENT_ID + ":" + process.env.BLING_CLIENT_SECRET
  ).toString("base64");

  const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + creds },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
  });

  const d = await r.json();
  if (!d.access_token) throw new Error("Token Bling invalido. Acesse /api/setup para reconectar.");

  // Salva o novo refresh token imediatamente (antes de qualquer outra operacao)
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

  // --- ENDPOINT DE DETALHE: /api/pedidos?id=X&token=ACCESS_TOKEN ---
  if (id) {
    const token = passedToken || await getAccessToken();
    try {
      const blingRes = await fetch("https://www.bling.com.br/Api/v3/pedidos/vendas/" + id, {
        headers: { Authorization: "Bearer " + token },
      });
      const d = await blingRes.json();

      if (req.query._debug) {
        return res.json({
          status: blingRes.status,
          has_data: !!d.data,
          data_keys: d.data ? Object.keys(d.data) : [],
          transporte_keys: (d.data && d.data.transporte) ? Object.keys(d.data.transporte) : [],
          etiqueta: (d.data && d.data.transporte && d.data.transporte.etiqueta) || null,
          ec_ok: !!parseEC(),
        });
      }

      if (!blingRes.ok) return res.status(blingRes.status).json({ erro: "Bling " + blingRes.status });
      return res.json(extrairEndereco(d.data || {}));
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // --- ENDPOINT DE LISTA: /api/pedidos?data_inicio=...&data_fim=... ---
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

    // Retorna o access_token para o frontend reutilizar nos detalhes
    return res.json({ total: d.total || pedidos.length, pagina: Number(pagina), pedidos, _t: token });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}
