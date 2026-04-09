# Validador de CEP — Dra. Charm

App web que conecta na API da Loja Integrada, valida os CEPs de cada pedido via ViaCEP e exibe as divergências.

---

## Estrutura

```
cep-validator/
├── api/
│   └── pedidos.js      ← função serverless (proxy para a API do LI)
├── public/
│   └── index.html      ← frontend do app
└── vercel.json         ← configuração do Vercel
```

---

## Deploy no Vercel (passo a passo)

### 1. Criar conta gratuita
Acesse https://vercel.com e crie uma conta (pode logar com GitHub, Google ou e-mail).

### 2. Subir o projeto
- No painel Vercel, clique em **"Add New Project"**
- Faça upload da pasta `cep-validator` ou importe de um repositório GitHub
- Clique em **Deploy**

### 3. Configurar as variáveis de ambiente (OBRIGATÓRIO)
No painel do projeto no Vercel → **Settings → Environment Variables**, adicione:

| Nome           | Valor                                      |
|----------------|--------------------------------------------|
| `LI_API_KEY`   | Sua chave de API da Loja Integrada         |
| `LI_APP_KEY`   | Sua chave de aplicativo da Loja Integrada  |

**Onde pegar essas chaves:**  
Painel da Loja Integrada → Configurações → Dados da Loja → Integração API

Depois de salvar as variáveis, clique em **Redeploy** para aplicar.

### 4. Pronto
O Vercel vai gerar uma URL tipo `https://seu-projeto.vercel.app`.
Compartilhe essa URL com a funcionária — ela abre no navegador, escolhe o período e clica em Buscar.

---

## Como usar (funcionária)

1. Abrir a URL no navegador
2. Selecionar período (ou clicar "Só hoje")
3. Clicar **Buscar pedidos**
4. Verificar pedidos com badge laranja (Divergência) ou vermelho (Inválido)
5. Exportar CSV para entrar em contato com clientes, se necessário

---

## Observações técnicas

- A API da LI retorna máximo 200 pedidos por chamada — o app pagina automaticamente para volumes maiores
- Os CEPs são validados via ViaCEP (gratuito, sem necessidade de cadastro)
- Cache de CEP em memória: CEPs repetidos são validados apenas uma vez por sessão
- O Vercel gratuito suporta até 100GB de banda e 100k execuções por mês — mais que suficiente
