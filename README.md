# Controle-App

<p align="center">
  <img src="docs/logos/opcao-a/icon-light.svg" alt="Controle-App" width="120">
</p>

<p align="center">
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase"></a>
  <a href="https://web.dev/progressive-web-apps/"><img src="https://img.shields.io/badge/PWA-offline-5A67D8?logo=pwa&logoColor=white" alt="PWA"></a>
  <a href="https://pages.github.com/"><img src="https://img.shields.io/badge/GitHub_Pages-publicado-222?logo=github&logoColor=white" alt="GitHub Pages"></a>
</p>

Aplicação PWA para controle de estoque e gestão de bares, com suporte a várias empresas, cargos, ambientes, compras, vendas, inventário e auditoria.

- **Aplicação:** https://dev-aylton.github.io/Controle-App/
- **Modo demonstração:** https://dev-aylton.github.io/Controle-App/#/demo
- **Acompanhamento do projeto:** https://dev-aylton.github.io/Controle-App/docs/acompanhamento/plano/

## Funcionalidades

- **Ambientes e produtos:** categorias, múltiplos ambientes, custo, mínimo/máximo, volume e dose.
- **Movimentações:** entradas, saídas, perdas, transferências, dose/garrafa aberta, estorno e zeragem.
- **Inventário:** contagem cega, diferenças em unidades e doses e finalização por gerente/proprietário.
- **Gestão:** central de alertas, saldo negativo, perdas sem motivo, compras sugeridas e painel.
- **Relatórios:** movimentações, auditoria e exportação CSV segura contra injeção de fórmula.
- **Vendas:** preços e custos por ambiente, importação CSV/XLSX, mapeamento, prévia financeira, histórico e desfazimento.
- **Offline:** fila IndexedDB/Dexie isolada por usuário, sincronização ao reconectar e `client_request_id` idempotente; saída preserva o tema e os arquivos estáticos do PWA.
- **Suporte:** administrador com acesso total, ações auditadas como suporte.
- **Demonstração:** empresa fictícia, troca de cargo e operações locais sem login ou Supabase.

## Fluxo operacional recomendado

1. **Configure a empresa e os ambientes** para separar o estoque central e cada ponto de venda.
2. **Cadastre produtos** com unidade, custo, níveis mínimo/máximo e, quando aplicável, volume e dose.
3. **Configure preços por ambiente** em Preços de venda; depois registre entradas, perdas e transferências e importe vendas para calcular faturamento e CMV enquanto baixa o estoque.
4. **Confira saldos e faça inventários** para comparar a contagem física com o saldo registrado.
5. **Use alertas e a lista de compras** para priorizar reposições; consulte relatórios e auditoria para revisar o histórico.

Preços por unidade/dose são obrigatórios para importar vendas. O custo por ambiente é opcional e, quando vazio, usa o custo base do produto; importações antigas não possuem snapshots financeiros e aparecem sem esses totais.

## Cargos e permissões

| Área | Admin/suporte | Proprietário | Gerente | Funcionário |
|---|---:|---:|---:|---:|
| Cadastrar produtos, ambientes e categorias | Sim | Sim | Sim | Não |
| Importar produtos e vendas | Sim | Sim | Sim | Não |
| Lançar e estornar movimentações | Sim | Sim | Sim | Sim, conforme regra |
| Finalizar inventário e zerar estoque | Sim | Sim | Sim | Não |
| Gestão, saldo, custo e histórico | Sim | Sim | Sim | Não |
| Equipe e código da empresa | Sim | Sim | Parcial | Não |
| Auditoria | Sim | Sim | Sim | Não |

Funcionários novos entram pela RPC `join_company_with_code`: o vínculo como funcionário é criado imediatamente e já pode trabalhar, **sem aprovação prévia**.

## Decisões técnicas

- **RLS:** tabelas e operações protegidas por Row Level Security e grants mínimos.
- **Isolamento multiempresa:** produto, ambiente e outros objetos são validados na empresa correta.
- **Imutabilidade:** `stock_movements` não permite UPDATE/DELETE; correções são feitas por estorno.
- **Funções protegidas:** RPCs críticas são `SECURITY DEFINER`, usam `search_path` fixo e checagens NULL-safe.
- **Idempotência:** lançamentos offline enviam `client_request_id` para evitar duplicação.
- **Privacidade local:** fila offline filtrada por usuário; registros antigos sem vínculo não são exibidos nem enviados.
- **Auditoria:** ações do admin recebem a marca `acted_as_support`; auditoria bloqueia alteração e exclusão.
- **Saldo:** transferência exige saldo na origem; venda/importação pode produzir saldo negativo conforme regra.
- **Ambientes separados:** o projeto mantém banco real e banco de testes separados.

## Stack

React 19, TypeScript, Vite 8, React Router, Supabase/PostgreSQL, Dexie/IndexedDB, Papaparse, XLSX, Vitest e Playwright.

## Executar localmente

```bash
npm ci
cp .env.example .env.local
npm run dev
```

No Windows:

```powershell
npm.cmd ci
npm.cmd run dev
```

Configure somente as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Testes

```bash
npm test
npm run lint
npx playwright test
```

- **Vitest:** suíte unitária do domínio e regras da interface.
- **RLS:** testes em `tests/rls/`, executados contra o projeto Supabase de testes.
- **Playwright:** suíte da demonstração em `tests/e2e/`.

<!-- TODO: Atualizar os números de testes após a execução final das suítes no CI. -->

## Estrutura principal

```text
src/
  components/        componentes compartilhados e navegação
  features/          regras e serviços por domínio
  pages/             telas da aplicação
  services/          integração com Supabase
supabase/
  migrations/        migrations por etapa
  patches/           correções para bancos já instalados
tests/
  rls/               testes de segurança do Supabase
  e2e/               testes Playwright da demonstração
docs/
  acompanhamento/    plano e acompanhamento de testes
```

## Roadmap e status

O status detalhado está na [página de acompanhamento](https://dev-aylton.github.io/Controle-App/docs/acompanhamento/plano/). A execução final dos fluxos Playwright ainda é acompanhada separadamente.

## Telas

As capturas devem usar somente dados fictícios do modo demonstração. Os arquivos previstos e o estado atual estão listados em [docs/screenshots/README.md](docs/screenshots/README.md).

## Autor

- [GitHub — Dev-Aylton](https://github.com/Dev-Aylton)
- [LinkedIn — Aylton Alberto](https://www.linkedin.com/in/aylton-alberto-806726220/)
- [E-mail](mailto:desenvolvedor.aylton@gmail.com)

## Licença

Todos os direitos reservados © 2026 Aylton.
