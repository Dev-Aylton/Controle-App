# Relatório de tratamento de dados — Controle-App

## Escopo

Relatório técnico baseado no código, migrations, storage, IndexedDB, localStorage e configuração do PWA deste repositório. Itens não verificáveis no código estão marcados como **NÃO CONFIRMADO**.

## 1. Dados e localização

| Categoria | Local | Finalidade | Acesso |
|---|---|---|---|
| Nome do usuário | `public.profiles.name` | Identificação em equipe, autoria e histórico | Próprio usuário; usuários autorizados por RPC e administradores |
| Foto/avatar | `profiles.avatar_url`, `profiles.avatar_key`; bucket `profile-photos` | Apresentação do perfil | Próprio usuário; URLs assinadas usadas pelo app |
| E-mail e dados de login | `auth.users.email`, `auth.identities`, `auth.sessions`, metadados do provedor | Autenticação, convites e RPC de equipe | Sistema Supabase; RPC de equipe expõe e-mail somente a admin/proprietário/gerente |
| Telefone do usuário | `auth.users.phone` | Login/identificação quando usado pelo provedor | Serviço de autenticação |
| Nome, telefone e foto da empresa | `public.companies` e bucket `company-photos` | Identidade visual e contato da empresa | Admin e membros autorizados conforme RLS/storage |
| Vínculos e cargos | `public.memberships`, `company_invites` | Multiempresa, autorização e acesso | Usuário nos próprios vínculos; líderes autorizados; admin |
| Produtos, custos e estoque | `products`, `product_costs`, `product_categories` | Cadastro e gestão de estoque | Funcionário vê produtos públicos; custos, mínimo/máximo e saldo são restritos |
| Movimentações e inventário | `stock_movements`, `inventory_sessions`, `inventory_counts` | Operação, saldo, contagem e auditoria | Funcionário vê histórico próprio restrito; gestores/admin conforme políticas e RPCs |
| Auditoria | `public.audit_log` | Rastreabilidade e suporte | Admin, proprietário e gerente por RPC/política |
| Vendas e mapeamento externo | `sales_product_map`, `sales_import_batches`, `sales_import_items` | Importação, desfazimento e histórico de vendas | Proprietário, gerente e admin conforme RPC |
| Fila offline | IndexedDB `controle-app-offline`, registros novos vinculados ao usuário | Reenvio ordenado e idempotente de lançamentos | Consultas, contagem e sincronização filtradas pelo usuário autenticado |
| Preferências locais | `localStorage`: tema, empresa ativa e conclusão do tutorial por cargo | Continuidade de interface | Aparelho |
| Sessão Supabase | armazenamento persistente gerenciado pelo `supabase-js` | Manter autenticação | Aparelho; token público de sessão, protegido por HTTPS |
| Cache PWA | Cache Storage/service worker | Disponibilizar shell e ativos offline | Aparelho |

## 2. Acesso por cargo

- **Funcionário:** produtos públicos e próprios lançamentos recentes; não recebe saldo, custo, mínimo, máximo nem histórico completo.
- **Gerente/proprietário:** gestão da empresa, saldo, custos, relatórios, auditoria, equipe e compras.
- **Admin/suporte:** acesso autorizado a todas as empresas; ações ficam marcadas como suporte na auditoria.
- **Usuário sem vínculo:** nenhuma leitura/escrita da empresa fora das RPCs/tabelas explicitamente públicas do fluxo.

## 3. Retenção e exclusão

- A auditoria e `stock_movements` são imutáveis.
- O pedido de exclusão encerra sessões e desativa os vínculos. Durante 90 dias, a pessoa pode autenticar-se apenas para cancelar o pedido e reativar a conta; foto e dados de autenticação permanecem disponíveis nesse período.
- Depois do prazo, a função server-side remove e-mail, telefone, senha, identidades, sessões e metadados pessoais de autenticação; remove também a foto e substitui `public.profiles.name` por “Conta excluída”.
- `auth.users` e referências UUID em registros operacionais não são apagados. Movimentações, auditoria, custos históricos e demais registros operacionais são preservados; identificadores internos podem continuar relacionados a esses registros. Portanto, o processo não deve ser descrito como anonimização completa.
- Ao sair, o app encerra a sessão e remove do aparelho os registros offline da conta, as chaves locais exceto o tema, o `sessionStorage` e os caches não estáticos. Os arquivos estáticos pré-cacheados do PWA e o service worker são mantidos. A fila pendente exige escolha explícita: aguardar, tentar enviar ou confirmar o descarte; os registros legados sem usuário vinculado não são exibidos nem enviados e também exigem confirmação antes de serem descartados.
- A exclusão de conta repete a limpeza local após a confirmação digitada. A preferência de tema e os arquivos estáticos do PWA permanecem. A remoção de foto apaga o objeto de Storage pertencente ao usuário, limpa `avatar_url`/`avatar_key` do perfil e remove `avatar_url` dos metadados locais de autenticação quando aplicável.
- A limpeza não controla o cache HTTP normal do navegador; imagens já carregadas podem exigir a limpeza dos dados do site no próprio navegador. O catálogo offline existe no IndexedDB, mas não foi encontrada rotina ativa que o preencha.
- `raw_app_meta_data` é mantido. A revisão de possíveis dados pessoais em `audit_log.data` e em outros campos livres ainda é necessária antes da publicação da política.
- A janela reversível de 90 dias foi definida pelo controlador. Prazos legais/comerciais adicionais de retenção permanecem **PENDENTES DE VALIDAÇÃO JURÍDICA**.

## 4. Terceiros e região

- **Supabase:** banco PostgreSQL, Auth e Storage. O controlador confirmou que o projeto está na região São Paulo, América do Sul (`sa-east-1`); a configuração do projeto deve ser conferida novamente antes da publicação.
- **Google:** login OAuth pode fornecer nome, e-mail e foto via `raw_user_meta_data` e `auth.identities`, somente quando a pessoa escolhe essa forma de login. Pode ocorrer tratamento fora do Brasil; região, registros e retenção específicos não estão confirmados.
- **GitHub Pages:** hospeda o PWA e os arquivos estáticos; recebe requisições para servir o aplicativo, incluindo endereço IP e dados técnicos. Não recebe dados operacionais diretamente pelo backend. Pode ocorrer tratamento fora do Brasil; logs, região e retenção específicos não estão confirmados.
- O uso de Google ou GitHub pode envolver transferência internacional. Países e mecanismos aplicáveis ainda precisam ser identificados antes da publicação.
- **E-mail/cliente do usuário:** o recurso de contato usa `mailto:` e abre o cliente configurado no aparelho.

## 5. Dispositivo e cookies

- `localStorage`: tema selecionado (`controle-app-theme`), empresa ativa (`controle-app-company`), conclusão do tutorial (`controle-app-tutorial-dismissed-*`) e sessão persistente do Supabase. Na saída e exclusão, somente o tema permanece; as chaves de autenticação são removidas ao encerrar a sessão.
- IndexedDB: a fila nova registra o `userId` e é consultada/sincronizada somente para a conta atual; o catálogo também prevê vínculo ao usuário. Registros anteriores sem `userId` permanecem isolados: não são exibidos nem enviados, e só são descartados após confirmação.
- Cache Storage: o app remove caches não estáticos e mantém o cache de pré-carregamento do Workbox e o service worker para preservar a abertura offline. A configuração atual não define cache de respostas de API em runtime.
- `sessionStorage`: dispensa temporária do modal de privacidade por usuário/versão; o armazenamento de sessão é limpo ao sair da conta.
- Foto: a ação em Meu perfil remove, pela API de Storage, o objeto cujo caminho está na pasta do próprio usuário; limpa `avatar_url` e `avatar_key` pelo update autenticado do perfil e remove o `avatar_url` dos metadados do usuário quando houver foto de provedor.
- Cookies criados diretamente pelo código: **nenhum confirmado**. Isso não confirma ausência de cookies ou rastreadores de serviços externos; esse comportamento permanece **NÃO CONFIRMADO**.
- A sessão Supabase pode depender de armazenamento persistente local; detalhes do SDK/implantação são **NÃO CONFIRMADOS**.

## 6. Segurança

- RLS e grants mínimos nas tabelas protegidas.
- RPCs críticas usam `SECURITY DEFINER`, `search_path` fixo e validação NULL-safe.
- `stock_movements` e auditoria possuem proteção contra UPDATE/DELETE.
- Ações do admin são marcadas na auditoria como suporte.
- Chaves `service_role` não são usadas no front-end.
- HTTPS é fornecido pelo GitHub Pages e pelo Supabase; configuração externa de certificados é **NÃO CONFIRMADA**.
- Nenhum sistema é totalmente imune a riscos. Incidentes devem ser tratados e comunicados conforme a legislação aplicável; procedimento interno e prazos específicos são **NÃO CONFIRMADOS**.
- CSV tem proteção contra injeção de fórmula.
- Fila offline usa `client_request_id` para evitar duplicação.

## 7. Direitos do titular

| Direito | Como exercer / estado técnico |
|---|---|
| Confirmação e acesso | Recurso de baixar dados pessoais em Minha conta ou solicitação pelo canal de privacidade |
| Correção | Nome e foto em Meu perfil; outros dados pelo canal de privacidade |
| Anonimização, bloqueio ou eliminação | Pedido de exclusão da conta em Minha conta; outros dados pelo canal de privacidade e, para dados operacionais, pela empresa controladora |
| Portabilidade | Exportação pessoal JSON no app; solicitações adicionais pelo canal de privacidade |
| Informação sobre compartilhamento | Solicitação pelo canal de privacidade |
| Consequências de não consentir | A minuta informa a foto de perfil como opcional e trata sua base como proposta; outras situações precisam de validação |
| Revogação do consentimento | Meu perfil permite remover a foto enviada ao app; outras revogações podem ser solicitadas pelo canal de privacidade. Procedimento geral precisa de revisão jurídica |
| Oposição | Solicitação e justificativa pelo canal de privacidade |
| Revisão de decisões automatizadas | Solicitação pelo canal de privacidade; existência e efeitos de decisões automatizadas **NÃO CONFIRMADOS** |
| Petição à ANPD | Direito informado na minuta, nos termos da legislação |
| Prazo de resposta | A minuta indica atendimento nos termos da lei; procedimento interno e canal de encaminhamento para a empresa **NÃO CONFIRMADOS** |
| Política e aceite | Minuta 1.0.0 em página pública e modal com conteúdo compartilhado; ainda não aprovada/publicada. O fluxo de aceite não foi alterado nem ativado, e sua validação permanece pendente |

## 8. Lacunas e riscos

1. A minuta v1.0.0 agora descreve papéis distintos de controlador/operador, público adulto, categorias de dados, suporte, dados locais, terceiros e direitos. Bases legais são propostas; revisão jurídica, aprovação e publicação continuam pendentes.
2. A suíte RLS confirma o pedido e a reativação dentro do prazo. A finalização vencida foi testada manualmente em conta sintética, mas o bloqueio da reativação após 90 dias e uma execução do cron agendado ainda não foram observados. Não implantar o front-end contra um banco que não tenha recebido a migration 016 e o patch 014 atualizado.
3. A remoção da foto depende da Edge Function e da API de Storage. O caminho de finalização manual respondeu sem falhas, mas a conta sintética não tinha objeto de foto; ainda é necessário testar a remoção de um objeto sintético e observar a execução automática. Falhas mantêm o pedido elegível para nova tentativa.
4. `auth.users` não é apagado e UUIDs operacionais são mantidos; dados em campos livres do `audit_log` podem conter identificadores e precisam ser avaliados para definir a retenção final.
5. Países, mecanismos de transferência, logs e prazos de retenção do Google/GitHub Pages, encaminhamento de solicitações de dados operacionais à empresa, verificação de idade, cookies/rastreadores de terceiros e procedimento de incidentes permanecem **NÃO CONFIRMADOS**. O cache HTTP normal do navegador não é removido pelo aplicativo.
6. E-mail da equipe é exposto a gestores por RPC dedicada.
7. Backups, retenção de backups e restauração de dados pessoais/histórico estão **NÃO CONFIRMADOS** e dependem de confirmação no Supabase.
8. A validação da configuração real do Supabase e sua região permanece necessária antes de produção; nenhum SQL foi aplicado ao banco real nesta implementação.

## 9. Minuta de privacidade v1.0.0

- A página `/privacidade` é pública e usa a mesma fonte de conteúdo do modal. Há links identificados como minuta no rodapé do aplicativo e no painel Minha conta; a página e o modal exibem versão, estado não vigente, temas claro/escuro e estrutura adequada para impressão.
- A minuta cobre papéis de controlador/operador, público 18+, categorias de dados, suporte, dados locais, terceiros e possível transferência internacional, direitos LGPD, retenção, bases legais propostas, segurança, backups e alterações. Também descreve a limpeza real por usuário ao sair/excluir e a remoção direta de foto. As lacunas confirmadas permanecem visíveis como “NÃO CONFIRMADO” e TODO para o responsável.
- A política segue como rascunho. Nenhuma publicação, mudança de RPC/SQL/banco ou ativação/alteração do fluxo de aceite foi feita nesta revisão.
