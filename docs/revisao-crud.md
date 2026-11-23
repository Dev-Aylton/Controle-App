# Revisão de CRUD

| Entidade | Criar | Ler | Editar | Desativar | Observação |
|---|---|---|---|---|---|
| Empresa | Sim, admin | Sim, conforme cargo | Nome/telefone/foto | Não | Exclusão/desativação de empresa não implementada |
| Ambiente | Sim, gestor/admin | Sim, membro | Nome/descrição | Sim | Sem exclusão |
| Categoria de produto | Sim, inline/importação | Sim, membro | Sim, na tela de produtos | Sim, na tela de produtos | Disponível sempre na página de Produtos para gestão |
| Produto | Funcionário cria novo; gestor/admin cria e importa | Sim, com limites/custos ocultos do funcionário | Somente gestor/admin | Somente gestor/admin | Cadastro manual, catálogo inteligente e importação usam o mesmo cadastro mestre e variantes por unidade/medida |
| Equipe/vínculo | Convite/entrada por código | Sim, gestor/admin | Promover e desativar | Sim | Alteração de e-mail do membro não existe |
| Movimentação | Sim por RPC | Próprios/gestão | Não | Não | Imutável; correção por estorno |
| Inventário | Funcionário abre e conta; gestor/admin importa e finaliza | Conforme sessão | Quantidade da sessão | Não | Sessões finalizadas permanecem |
| Mapa de vendas | Sim | Sim, gestão | Salvar com upsert | Remover vínculo | Completo |
| Motivo de perda | Listar/usar | Gestão e próprio pendente | Completar pendência | Não | Cadastro/edição de motivos requer SQL |
| Perfil | Criado pelo login | Próprio | Nome/avatar | Exclusão/anonimização | Patch confirmado no banco de testes; suíte RLS validada (101/101); publicação real pendente |

## Permissão do administrador de suporte

O administrador do aplicativo pode selecionar qualquer empresa e operar estoque, produtos, movimentações, inventários, vendas e equipe quando necessário para suporte. Essas ações não exigem vínculo como proprietário/gerente e devem ser registradas como suporte na auditoria.

## Pendências que exigem SQL

- CRUD administrativo de motivos de perda.
- Política/tela de desativação de empresa.
- Edição administrativa de categorias em tela própria (o backend atual pode ser usado, mas não há fluxo dedicado).
- Desativação de convites/mapas já usa remoção lógica ou inexistência conforme entidade.
