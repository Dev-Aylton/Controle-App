# Aplicação no banco de produção

Use este repositório como fonte única de verdade. Não execute arquivos antigos de diagnóstico nem concatenações manuais.

## Ordem obrigatória

1. Aplicar todas as migrations de `supabase/migrations/`, em ordem numérica de `001` a `016`.
2. Aplicar todos os arquivos de `supabase/patches/`, em ordem numérica disponível de `001` a `042`.
3. Implantar a Edge Function `supabase/functions/finalize-account-deletions/`.
4. Configurar o segredo da rotina de finalização e o agendamento do banco.
5. Configurar os buckets de fotos, empresa, perfil e suporte.
6. Aplicar `041-publicar-politica-1-3-0.sql` e `042-permissao-avatar-key.sql` somente quando a versão correspondente do frontend estiver pronta.

## Verificação antes da aplicação

```powershell
npm.cmd run sql:validar
npm.cmd run test:rls
```

O primeiro comando valida a sintaxe e dependências de migrations e patches. O segundo executa os testes contra o banco apontado em `.env.test`; confirme o alvo antes de usar.

## Regras

- Nunca aplique o pacote diretamente no banco real sem backup e aprovação explícita.
- Não altere a ordem dos arquivos.
- Um patch reaplicado deve preservar dados por usar `if not exists`, `drop ... if exists` ou operações idempotentes.
- A política 1.3.0 deve ser publicada depois do frontend correspondente.
- Não exponha chave administrativa no navegador ou no repositório.

## Verificação pós-aplicação

1. Login por e-mail e Google.
2. Entrada por código e cargos.
3. Movimentações e sincronização offline.
4. Compras, produtos, vendas e inventários.
5. Suporte, anexos e isolamento entre usuários.
6. Política 1.3.0 e aceite.
7. Exclusão reversível de conta e finalização vencida.

## Rollback

1. Interrompa a publicação imediatamente se qualquer etapa falhar.
2. Restaure o frontend para a última versão publicada.
3. Não apague dados, usuários ou empresas para tentar desfazer o problema.
4. Para a política, retire `1.3.0` de `is_current` somente com aprovação explícita e mantenha o registro publicado como histórico.
5. Funções e políticas devem ser revertidas somente com script SQL separado e revisado.
6. Antes do próximo deploy, faça backup do projeto e registre as versões aplicadas.

## Checklist operacional

- backup confirmado;
- janela de manutenção avisada;
- banco real identificado e conferido como São Paulo;
- migrations validadas;
- 42 arquivos de patch disponíveis conferidos em ordem;
- Edge Function implantada;
- segredo e rotina diária configurados;
- Storage e políticas conferidos;
- política 1.3.0 publicada;
- frontend apontando para as variáveis do banco real;
- usuário administrador realizou login e smoke test;
- nenhuma chave privada exposta no frontend.

## Alvos confirmados

- Teste: `wvqgrabeemcdmkzluqml`.
- Produção: `lbfaixbxreiclfazeeex`.
- Região de produção: São Paulo (`sa-east-1`).
