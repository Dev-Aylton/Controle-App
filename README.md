# Controle-App

Base PWA com Vite, React, TypeScript, Supabase e Dexie.

## Desenvolvimento

Requer Node.js 24 ou superior. Instale as dependências com `npm ci`, copie
`.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` com a URL e a chave **anon pública** do projeto real.
Execute `npm run dev` e acesse o endereço exibido pelo Vite.

Para usar um projeto Supabase separado de testes, copie `.env.test.example`
para `.env.test.local`, preencha `VITE_SUPABASE_TEST_URL` e
`VITE_SUPABASE_TEST_ANON_KEY` com os valores desse projeto e execute
`npm run dev -- --mode test`. Nunca use a chave `service_role` no aplicativo:
variáveis `VITE_` são públicas e ficam incorporadas ao build.
O modo de testes exige suas próprias variáveis e não usa as do projeto real.

A página inicial consulta as configurações do serviço de autenticação do
Supabase para verificar acesso e configuração. Isso não verifica tabelas,
permissões de dados ou disponibilidade offline.

## Verificação e deploy

- `npm run lint`, `npm test` e `npm run build`.
- Playwright está configurado em `playwright.config.ts`; ainda não há fluxos.
  Quando houver testes, instale o navegador com `npx playwright install chromium`
  e execute `npm run test:e2e`.
- No repositório GitHub, configure Pages com fonte **GitHub Actions** e defina
  as variáveis de repositório `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` com os valores públicos do projeto real. O workflow
  publica a cada push na `main`. O build usa `/Controle-App/` como base.
