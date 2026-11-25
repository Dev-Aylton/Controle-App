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

No release 5.1, a fila passou a recuperar itens presos no estado `enviando`: ao iniciar uma nova sincronização, esses registros voltam para `pendente` antes da tentativa. Itens sincronizados com sucesso são removidos da fila IndexedDB, evitando acúmulo indefinido. Ao sair da conta, a limpeza local também remove os ambientes armazenados em `movementEnvironments` pelo usuário atual e pelos registros antigos sem usuário vinculado.

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

As correções de fila offline, limpeza local, inventário e movimentações do release 5.1 vieram de uma auditoria própria do projeto. Na tela de inventário, trocar o ambiente ou a empresa limpa a sessão aberta, contagens, prévia e dados importados da contagem, evitando que uma operação seja aplicada no contexto anterior. Vitest cobre recuperação da fila, remoção de itens concluídos e limpeza dos ambientes offline; Playwright cobre os fluxos da demonstração e das telas por cargo.

## 7. Exclusão de conta e privacidade

**Problema:** a conta precisa ser desativada imediatamente com possibilidade de reativação por 90 dias, e a exclusão definitiva deve remover identificadores sensíveis sem destruir o histórico operacional da empresa.

**Implementação:** a migration `016_privacidade_retentions.sql` cria solicitações de exclusão, registros de aceites da política e RPCs protegidas para consultar, aceitar, solicitar, reativar e finalizar a exclusão. `privacy_policy_releases` mantém versões publicadas e uma única versão atual; `PrivacyPolicyPrompt` consulta o RPC da política atual e registra o aceite em `privacy_policy_acceptances`. A Edge Function `supabase/functions/finalize-account-deletions/index.ts` exige segredo próprio do cron, reivindica solicitações vencidas e remove fotos antes da finalização. A rotina diária é agendada pelo cron do Supabase.

Arquivos:

- `supabase/migrations/016_privacidade_retentions.sql`
- `supabase/functions/finalize-account-deletions/index.ts`
- `supabase/patches/041-publicar-politica-1-3-0.sql`
- `src/features/privacy/PrivacyPolicyPrompt.tsx`
- `src/features/privacy/PrivacyPolicyContent.tsx`
- `src/features/privacy/privacyPolicyStatus.ts`

**Fluxo:** a política publicada é consultada por usuários autenticados; o aceite é registrado no banco para o usuário e versão. Ao solicitar exclusão, a conta recebe data final de 90 dias, vínculos ativos são desativados e a sessão é encerrada. Até o prazo, o usuário pode cancelar a solicitação e reativar seus vínculos. Depois do vencimento, o cron chama a Edge Function; ela reivindica a solicitação como `finalizando`, remove objetos de `profile-photos`, finaliza os identificadores da conta e libera solicitações que falhem no processamento.

**Falhas:** sem autenticação, consulta e aceite são recusados. Contas administradoras não podem ser excluídas pelas RPCs de usuário. Proprietário precisa transferir a propriedade antes da exclusão. A reativação falha após o prazo ou quando a solicitação não está pendente. A Edge Function bloqueia chamadas sem segredo correto e devolve solicitações pendentes de nova tentativa se fotos não puderem ser listadas/removidas ou a finalização falhar.
