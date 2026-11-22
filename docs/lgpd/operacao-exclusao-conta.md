# Operação do fluxo de exclusão de conta

## Estado

Migration `016_privacidade_retentions.sql` e wrapper `014-excluir-conta.sql` foram aplicados no banco de testes. A suíte RLS passou em 101/101, incluindo solicitação e reativação durante a janela. A Edge Function foi implantada; o segredo existe na configuração da função e no Vault, e o cron está ativo com agenda diária.

Uma conta sintética foi criada e finalizada manualmente no projeto `Controle-App-teste` (ref `wvqgrabeemcdmkzluqml`), após antecipar somente o vencimento do pedido. A Edge Function respondeu HTTP 200 com `completed=1`, `failed=0` e `release_failed=0`. A verificação confirmou pedido concluído, conta bloqueada, campos de autenticação limpos, perfil anonimizado e zero identidades/sessões. A conta não tinha foto armazenada, portanto a remoção de objetos existentes no Storage não foi exercitada.

O registro sintético permanece como tombstone sem identificadores diretos, preservando a referência histórica de exclusão; não foram alterados dados de outras contas.

Ainda falta observar uma execução automática do cron e testar o bloqueio da reativação após o prazo. O CLI apresenta o ambiente com rótulo `production`, embora o projeto seja `Controle-App-teste`; o alvo foi confirmado explicitamente antes do teste. Nenhuma operação foi feita no projeto `Controle-App`. Não aplique estes arquivos ao banco real sem aprovação explícita.

## Aplicação e validação no banco de testes

1. As alterações de banco de teste foram aplicadas; a migration foi validada por `npm.cmd run sql:validar`.
2. `npm.cmd run test:rls` passou: 101 testes, incluindo solicitação, preservação durante a janela e reativação.
3. A Edge Function está implantada e o cron ativo usa Vault para enviar o segredo dedicado. A chamada manual de validação via `pg_net` respondeu HTTP 200 com `completed=1`, `failed=0` e `release_failed=0`; os campos de autenticação e perfil da conta sintética foram verificados após a finalização.
4. `cron.job_run_details` ainda não mostra uma execução automática. Observe a próxima execução agendada e valide o bloqueio de reativação após o prazo. A remoção de foto existente no Storage também precisa de um caso com objeto sintético.

O front-end novo depende da RPC `get_account_deletion_status`; não o publique antes de aplicar e validar as alterações do banco no ambiente correspondente.

## Edge Function e agendamento

1. Instale/execute o Supabase CLI via `npx` e autentique-se no terminal local. O token precisa ter `edge_functions_write` para deploy e `edge_functions_secrets_write` para configurar secrets no projeto de testes; `projects_read` permite listar projetos. O token de acesso é secreto: informe-o somente no prompt do CLI, nunca no chat ou no repositório.

   ```powershell
   npx.cmd --yes supabase login
   ```

2. Implante `finalize-account-deletions` somente no projeto de testes:

   ```powershell
   npx.cmd --yes supabase functions deploy finalize-account-deletions --remote="<ref-do-projeto-de-testes>"
   ```

3. Gere um segredo aleatório dedicado ao endpoint e cadastre-o como secret da Edge Function, sem gravá-lo neste repositório:

   ```powershell
   npx.cmd --yes supabase secrets set "ACCOUNT_DELETION_CRON_SECRET=<segredo-aleatorio>" --remote="<ref-do-projeto-de-testes>"
   ```

   A função também usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no servidor. Nunca exponha a chave `service_role` ao navegador nem a use como segredo do cron.

4. Habilite `pg_cron`, `pg_net` e Vault no projeto de testes. Guarde uma cópia do segredo dedicado no Vault com o nome `account_deletion_cron_secret`; restrinja o acesso às credenciais e às tabelas de fila do `pg_net`.
5. Agende a chamada diária no SQL Editor do banco de testes, substituindo `<ref-do-projeto-de-testes>`:

   ```sql
   select cron.schedule(
     'finalize-account-deletions',
     '0 3 * * *',
     $job$
       select net.http_post(
         url := 'https://<ref-do-projeto-de-testes>.supabase.co/functions/v1/finalize-account-deletions',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-account-deletion-cron-secret',
           (select decrypted_secret
            from vault.decrypted_secrets
            where name = 'account_deletion_cron_secret'
            limit 1)
         ),
         body := '{}'::jsonb
       );
     $job$
   );
   ```

   `pg_net` pode manter metadados das requisições e headers na fila. Use somente o segredo dedicado, revise quem pode consultar os objetos do schema `net` e defina retenção/limpeza apropriada. Se esse risco não for aceitável no projeto, use um scheduler externo que armazene o segredo fora do banco.

6. Confira o job em `cron.job`, monitore as respostas da fila `net` e os logs da Edge Function. Erros de Storage ou finalização devem resultar em nova tentativa; não ignore falhas de release ou de execução.

## Publicação

O texto do Aviso de Privacidade está em minuta e a versão 1.0.0 permanece `draft`. Não marque uma versão como publicada nem ative o aceite antes de aprovação do texto e revisão jurídica. A migração para o banco real, a publicação da função e a criação do cron real exigem aprovação explícita e plano de rollback.
