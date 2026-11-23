# Relatório de tratamento de dados — Controle-App

## Escopo

Relatório técnico baseado no código, migrations, storage, IndexedDB, localStorage e configuração do PWA deste repositório. Itens não verificáveis no código estão marcados como **NÃO CONFIRMADO**.

## Verificação do prompt de publicação

1. **Domínios e rastreamento:** o app usa hospedagem em GitHub Pages e integra Supabase e Google OAuth. Não há fontes externas ou scripts/CDNs carregados por código próprio; o build mantém ativos locais e não contém analytics, anúncios ou rastreadores. O portfólio externo é apenas um link no rodapé.
2. **Cookies próprios:** não foi encontrado uso de `document.cookie` nem biblioteca que crie cookies no código do app.
3. **Telefone:** o cadastro/login não solicita telefone do usuário. Existe o campo de telefone da empresa em `public.companies`; a rotina de exclusão também limpa a coluna `auth.users.phone`, mas o front-end não coleta esse dado pessoal da conta.
4. **Maioridade:** não existe declaração de maioridade ou confirmação de idade no cadastro/login.
5. **Decisões automatizadas:** não há decisões automatizadas sobre pessoas. Alertas e sugestões se referem exclusivamente a produtos, estoque e níveis mínimos/máximos. Sugestões de reposição, furos e divergências exigem revisão humana e não alteram dados silenciosamente.
6. **Publicação da política:** a migration cria `privacy_policy_releases` com `draft/published/retired`, `is_current`, `published_at` e `content_sha256`; a migration inicial insere a versão `1.0.0` como rascunho não atual. O conteúdo atual desta revisão está preparado como versão de trabalho `1.1.0`, ainda não inserida no banco nem publicada. Aceites ficam em `privacy_policy_acceptances` com usuário, versão e data. A função retorna apenas release publicada e atual; o aceite grava uma linha sem duplicar a combinação usuário-versão. O modal só abre para usuário autenticado com release pendente, não é bloqueante e pode ser dispensado por sessão. O fluxo não foi publicado nem ativado nesta revisão.

## 1. Dados e localização

| Categoria | Local | Finalidade | Acesso |
|---|---|---|---|
| Nome do usuário | `public.profiles.name` | Identificação em equipe, autoria e histórico | Próprio usuário; usuários autorizados por RPC e administradores |
| Foto/avatar | `profiles.avatar_url`, `profiles.avatar_key`; bucket `profile-photos` | Apresentação do perfil | Próprio usuário; URLs assinadas usadas pelo app |
| E-mail e dados de login | `auth.users.email`, `auth.identities`, `auth.sessions`, metadados do provedor | Autenticação, convites e RPC de equipe | Sistema Supabase; RPC de equipe expõe e-mail somente a admin/proprietário/gerente |
| Telefone do usuário | Não coletado pelo cadastro/login nesta implementação | Não aplicável | Não armazenado pelo formulário da conta |
| Nome, telefone e foto da empresa | `public.companies` e bucket `company-photos` | Identidade visual e contato da empresa | Admin e membros autorizados conforme RLS/storage |
| Vínculos e cargos | `public.memberships`, `company_invites` | Multiempresa, autorização e acesso | Usuário nos próprios vínculos; líderes autorizados; admin |
| Produtos, custos e estoque | `products`, `product_costs`, `product_categories` | Cadastro e gestão de estoque | Funcionário vê produtos públicos; custos, mínimo/máximo e saldo são restritos |
| Movimentações e inventário | `stock_movements`, `inventory_sessions`, `inventory_counts` | Operação, saldo, contagem e auditoria | Funcionário vê histórico próprio restrito; gestores/admin conforme políticas e RPCs |
| Auditoria | `public.audit_log` | Rastreabilidade e suporte | Admin, proprietário e gerente por RPC/política |
| Contagens e análise de furos | `inventory_sessions`, `inventory_counts`, comparação de movimentos | Contagem física, ajuste e análise entre períodos | Administrador, proprietário e gerente; funcionários contam apenas sessões abertas autorizadas |
| Divergências e notificações | `audit_log` de divergências; estado local de leitura/dispensa no navegador | Identificar operações acima do saldo e alertar gestores | Gestores/admin; leitura local por conta e empresa |
| Peso, porções e conversões | `products.weight_g`, unidade e medidas físicas | Cadastro e cálculo de porções/peso | Gestão pela empresa; funcionários veem apenas dados públicos necessários |
| Fichas técnicas e preços comerciais | `sale_items`, `sale_item_ingredients`, `sale_item_environment_prices` após aplicação do patch SQL | Separar insumos do preço comercial de pratos e drinks | Administrador, proprietário e gerente |
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
- Cookies criados diretamente pelo código: nenhum encontrado no front-end. Não há analytics, anúncios ou rastreadores próprios. Google OAuth pode usar seus próprios cookies nos domínios do Google.
- A sessão Supabase é persistida pelo `supabase-js` em armazenamento local no navegador.

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
| Decisões automatizadas | Solicitação pelo canal de privacidade; o código não toma decisões automatizadas sobre pessoas; alertas e sugestões são sobre produtos e estoque |
| Petição à ANPD | Direito informado na minuta, nos termos da legislação |
| Prazo de resposta | A versão v1.0.0 indica resposta em até 15 dias; o canal de encaminhamento para dados operacionais deve seguir a revisão jurídica |
| Política e aceite | Minuta 1.0.0 em página pública e modal com conteúdo compartilhado; ainda não aprovada/publicada. O fluxo de aceite não foi alterado nem ativado, e sua validação permanece pendente |

## 8. Lacunas e riscos

1. A minuta v1.0.0 descreve papéis distintos de controlador/operador, público adulto, categorias de dados, suporte, dados locais, terceiros e direitos. As bases estão declaradas pela LGPD, artigo 7º, mas revisão jurídica, aprovação e publicação continuam pendentes.
2. A suíte RLS confirma o pedido e a reativação dentro do prazo. A finalização vencida foi testada manualmente em conta sintética, mas o bloqueio da reativação após 90 dias e uma execução do cron agendado ainda não foram observados. Não implantar o front-end contra um banco que não tenha recebido a migration 016 e o patch 014 atualizado.
3. A remoção da foto depende da Edge Function e da API de Storage. O caminho de finalização manual respondeu sem falhas, mas a conta sintética não tinha objeto de foto; ainda é necessário testar a remoção de um objeto sintético e observar a execução automática. Falhas mantêm o pedido elegível para nova tentativa.
4. `auth.users` não é apagado e UUIDs operacionais são mantidos; dados em campos livres do `audit_log` podem conter identificadores e precisam ser avaliados para definir a retenção final.
5. Logs e prazos específicos do Google/GitHub Pages, encaminhamento de solicitações de dados operacionais à empresa e procedimento interno de incidentes permanecem sujeitos à confirmação operacional. O cache HTTP normal do navegador não é removido pelo aplicativo.
6. E-mail da equipe é exposto a gestores por RPC dedicada.
7. O plano Free atual do Supabase não inclui backups automáticos. Não há cópias próprias mantidas pelo Controle-App; dados excluídos podem não permanecer em cópias próprias e a recuperação pode não ser possível em falha grave do serviço.
8. A validação da configuração real do Supabase e sua região permanece necessária antes de produção; nenhum SQL foi aplicado ao banco real nesta implementação.

## 9. Minuta de privacidade v1.0.0

- A página `/privacidade` é pública e usa a mesma fonte de conteúdo do modal. O rodapé e o painel Minha conta exibem “Aviso de Privacidade (minuta)” no rascunho e “Aviso de Privacidade” quando houver uma release publicada. A página e o modal exibem o estado determinado pela RPC de releases sem quebrar quando não há dado de versão.
- A minuta cobre papéis de controlador/operador, público 18+, categorias de dados, suporte, dados locais, terceiros e transferência internacional, direitos LGPD, retenção, bases legais, segurança, backups e alterações. O plano Free do Supabase não inclui backups automáticos e o aplicativo não mantém cópias próprias.
- A política segue como rascunho de trabalho na versão 1.1.0. Ela cobre importações assistidas, peso e porções, vendas oficiais, notificações locais, contagens, furos e divergências. Nenhuma publicação, mudança de RPC/SQL/banco ou ativação/alteração do fluxo de aceite foi feita nesta revisão.
