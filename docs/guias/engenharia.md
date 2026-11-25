# Guia Técnico de Engenharia — Controle-App

Este documento explica as decisões técnicas principais do projeto para estudo e preparação para entrevistas.

## Visão geral

O Controle-App é um PWA desenvolvido com React, TypeScript e Vite. O Supabase fornece autenticação, PostgreSQL, Storage, Edge Functions e Row Level Security. O Dexie usa IndexedDB para catálogo e fila offline.

Arquivos principais:

- `src/app/App.tsx`: rotas.
- `src/features/`: regras por domínio.
- `src/pages/`: páginas.
- `src/services/`: integração com Supabase.
- `src/features/offline/`: catálogo e fila IndexedDB.
- `supabase/migrations/`: estrutura inicial.
- `supabase/patches/`: evolução de bancos já instalados.
- `tests/`: testes RLS e ponta a ponta.

## 1. Multi-tenancy e RLS

**Problema:** usuários de empresas diferentes não podem ler ou alterar dados uns dos outros.

**Implementação:** tabelas relacionam dados por `company_id`, a sessão identifica o usuário por `auth.uid()` e políticas RLS combinam vínculo e cargo.

Arquivos:

- `supabase/migrations/006_etapa1_rls_grants_policies.sql`
- `supabase/patches/018-reforcar-visibilidade-empresas.sql`
- `tests/rls/isolamento.rls.test.ts`

**Fluxo:** autenticação gera sessão; frontend envia empresa e ids; RLS verifica vínculo e cargo; operação de outra empresa é recusada.

**Falhas:** usuário anônimo não possui privilégios; empresa B não lê nem altera empresa A; testes RLS cobrem isolamento e tentativas indevidas.

## 2. Funções SECURITY DEFINER

**Problema:** operações críticas precisam aplicar regras de saldo, vínculo e cargo diretamente no banco.

**Implementação:** RPCs críticas usam `SECURITY DEFINER`, fixam `search_path` e verificam cargo, vínculo ativo e empresa.

Arquivos:

- `supabase/migrations/009_etapa3_movimentacoes.sql`
- `supabase/migrations/013_etapa5a_vendas_sugestoes.sql`
- `supabase/patches/005-revoke-anon-execute.sql`
- `supabase/patches/010-fix-null-safe-role-checks.sql`

**Fluxo:** frontend chama RPC autenticada; função valida contexto; regras de domínio são executadas; resultado é devolvido ou erro é lançado.

**Falhas:** execução por anon é revogada; vínculo desativado é recusado; testes cobrem cargo e acesso cruzado.

## 3. Fila offline idempotente

**Problema:** sem conexão, o usuário precisa registrar operações simples. Ao reconectar, uma operação não pode ser criada duas vezes.

**Implementação:** Dexie mantém catálogo e fila; registros ficam vinculados ao usuário; cada item usa `clientRequestId`; estados são pendente, enviando, enviado e falhou.

Arquivos:

- `src/features/offline/db.ts`
- `src/features/offline/sync.ts`
- `src/features/offline/sync.test.ts`
- `supabase/patches/007-fix-idempotent-wrappers.sql`
- `supabase/patches/008-fix-transfer-idempotency.sql`

**Fluxo:** operação é salva localmente; reconexão envia um item por vez; banco recebe identificador; repetição consulta o mesmo resultado.

**Falhas:** registros antigos sem usuário não são sincronizados; dados locais são isolados por usuário; falha de autorização interrompe envio.

## 4. Imutabilidade e estorno

**Problema:** edição ou exclusão direta poderia destruir rastreabilidade.

**Implementação:** `stock_movements` bloqueia UPDATE e DELETE. Correções são estornos vinculados por `reverses_movement_id`. Transferências possuem duas pernas com `transfer_group_id`.

Arquivos:

- `supabase/migrations/009_etapa3_movimentacoes.sql`
- `supabase/migrations/014_etapa3b_dose_zeragem.sql`
- `supabase/patches/017-auditoria-detalhada.sql`
- `src/features/movements/rules.ts`

**Fluxo:** operação original é inserida com sinal correspondente; estorno cria movimento reverso; transferência corrige origem e destino.

**Falhas:** UPDATE e DELETE falham; estorno duplicado é bloqueado; estorno de estorno é recusado; funcionário tem janela própria para estorno.

## 5. Conversão garrafa/dose

**Problema:** uma garrafa aberta precisa ser controlada em doses sem perder precisão no estoque.

**Implementação:** produto possui volume da garrafa e volume da dose. O frontend calcula fração da embalagem. Quantidades usam até três casas decimais.

Arquivos:

- `src/features/movements/rules.ts`
- `src/features/movements/rules.test.ts`
- `src/features/movements/MovementLaunchForm.tsx`
- `supabase/migrations/014_etapa3b_dose_zeragem.sql`
- `tests/rls/etapa3b.rls.test.ts`

**Fluxo:** produto é selecionado; usuário informa doses; frontend calcula fração; RPC valida estoque; PostgreSQL registra quantidade.

**Falhas:** volume ou dose inválido é recusado; quantidade menor ou igual a zero é recusada; saldo insuficiente impede a operação.

## 6. Testes automatizados

**Problema:** mudanças em estoque, cargo e segurança podem quebrar operações ou permitir acesso indevido.

**Implementação:** Vitest cobre regras de domínio; Playwright valida interface; testes RLS exercitam usuários e empresas sintéticas; script valida SQL.

Comandos:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run sql:validar
npm.cmd run test:rls
```

**Fluxo:** altere o código; execute testes unitários; valide interface; execute RLS no banco de testes; valide SQL antes da implantação.

**Falhas:** suíte vermelha impede considerar o bloco concluído. Produção não é ambiente de desenvolvimento ou testes.
