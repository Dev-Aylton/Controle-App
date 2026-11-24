# Revisão de CRUD

| Entidade | Criar | Ler | Editar | Desativar | Observação |
|---|---|---|---|---|---|
| Empresa | Sim, admin ou usuário autorizado | Sim, conforme cargo | Nome/telefone/foto | Suspender/reativar pelo admin do app | Preserva vínculos, cadastro e histórico |
| Ambiente | Sim, gestor/admin | Sim, membro | Nome/descrição | Sim | Sem exclusão |
| Categoria de produto | Sim, inline/importação | Sim, membro | Sim, na tela de produtos | Sim, na tela de produtos | Disponível sempre na página de Produtos para gestão |
| Produto | Funcionário cria novo; gestor/admin cria e importa | Sim, com limites/custos ocultos do funcionário | Somente gestor/admin | Somente gestor/admin | Cadastro manual, catálogo inteligente e importação usam o mesmo cadastro mestre e variantes por unidade/medida |
| Equipe/vínculo | Convite/entrada por código | Sim, gestor/admin | Promover e desativar | Sim | Alteração de e-mail do membro não existe |
| Movimentação | Sim por RPC | Próprios/gestão | Não | Não | Imutável; correção por estorno |
| Inventário | Funcionário abre e conta; gestor/admin importa e finaliza | Conforme sessão | Quantidade da sessão | Não | Sessões finalizadas permanecem |
| Mapa de vendas | Sim | Sim, gestão | Salvar com upsert | Remover vínculo | Completo |
| Motivo de perda | Listar/usar | Gestão e próprio pendente | Completar pendência | Não | Cadastro inicial usa motivos padrão |
| Perfil | Criado pelo login | Próprio | Nome/avatar | Exclusão em 90 dias com histórico preservado | Permissões e Storage validados no banco de testes |
| Chat de suporte | Conversa única por usuário | Usuário próprio/admin | Arquivamento/ocultação individual | Sem exclusão automática | Mensagens e anexos seguem a política 1.3.0 |
| Lista de compras | Rascunho e solicitações | Conforme cargo | Quantidade, custo e fornecedor | Remover item do rascunho | Solicitações não bloqueiam o fluxo do funcionário |

## Permissão do administrador de suporte

O administrador do aplicativo pode selecionar qualquer empresa e operar estoque, produtos, movimentações, inventários, vendas e equipe quando necessário para suporte. Essas ações não exigem vínculo como proprietário/gerente e devem ser registradas como suporte na auditoria.

## Pontos mantidos sem interface própria

- CRUD administrativo de motivos de perda.
- Edição administrativa de categorias em tela própria (o backend atual pode ser usado, mas não há fluxo dedicado).
- Conversas de suporte não possuem exclusão por usuário; arquivamento e ocultação são individuais.
