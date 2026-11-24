# Relatório de dados — versão 1.3.0

## Dados da conta

- e-mail;
- nome;
- foto ou avatar;
- identificador da conta;
- método de autenticação;
- sessão;
- data de criação e alteração do perfil.

O aplicativo também grava o identificador interno do usuário em registros operacionais e de auditoria.

## Dados da empresa

- nome e telefone da empresa;
- foto ou logotipo;
- vínculos e cargos;
- códigos de entrada;
- empresas suspensas ou reativas;
- motivos e responsáveis pela suspensão e desativação.

## Dados operacionais

- produtos, categorias, unidades, volume, peso e dose;
- custos, estoque mínimo e máximo;
- ambientes e saldos;
- entradas, saídas, perdas, transferências, estornos e zeragens;
- inventários e contagens;
- fornecedores e preços;
- lista de compras;
- vendas, mapas externos e lotes importados;
- fichas técnicas e preços por ambiente;
- auditoria das ações.

## Chat de suporte

São gravados:

- texto da mensagem;
- identificador do usuário;
- identificador da conversa;
- data e hora;
- autor;
- estado de envio e visualização;
- estado de arquivamento;
- estado de ocultação;
- nome, tipo e tamanho do arquivo;
- caminho privado do anexo.

Cada usuário possui uma conversa própria com o administrador. Usuários não veem conversas uns dos outros.

No banco de teste, o patch do chat passou em seis testes de isolamento, incluindo usuário fora da conversa, administrador atendendo e limites de anexos.

## Dados locais

No aparelho podem existir:

- tema;
- empresa ativa;
- tutorial concluído;
- avisos lidos ou dispensados;
- categoria e prioridade dos avisos;
- rascunhos de compras;
- lançamentos offline;
- catálogo offline de produtos e ambientes;
- dados temporários da sessão;
- arquivos estáticos necessários ao aplicativo.

Ao sair da conta, dados offline e preferências pessoais são removidos, exceto o tema e os arquivos necessários para o aplicativo.

## Dados técnicos e conexão

O aplicativo pode manter temporariamente no aparelho:

- versão;
- conexão;
- navegador;
- layout e tamanho da tela;
- cargo;
- empresa;
- estado da fila offline;
- até 20 erros técnicos.

Os provedores podem registrar endereço de internet, horário, dados da requisição e informações técnicas da conexão.

## Exportação

O usuário pode baixar seus dados pessoais em JSON.

Gestores autorizados podem exportar dados operacionais em CSV.

## Exclusão de conta

O pedido concede 90 dias para reativação.

Ao pedir exclusão, o aplicativo:

- desativa os vínculos;
- encerra sessões;
- exclui dados locais da conta após a confirmação.

Depois de 90 dias:

- remove o e-mail;
- remove o telefone de autenticação;
- remove a senha;
- remove identidades e sessões;
- remove metadados pessoais da conta;
- remove os objetos da foto;
- muda o nome público do perfil para “Conta excluída”;
- remove convites pendentes associados ao e-mail.

Não são removidos automaticamente:

- conversas e mensagens de suporte;
- anexos de suporte;
- movimentações;
- inventários;
- vendas;
- fornecedores;
- compras;
- fichas técnicas;
- auditoria;
- identificadores internos históricos.

Existem rotina e agendamento implementados no projeto para finalizar pedidos vencidos. O funcionamento real depende do ambiente configurado.

## Limpeza automática

- A fila offline é limpa ao sair ou excluir a conta, conforme a opção escolhida.
- A auditoria não possui limpeza automática.
- Mensagens e anexos de suporte não possuem limpeza automática.
- Os dados operacionais não possuem prazo automático fixo de eliminação.
- Os provedores podem manter backups conforme suas próprias políticas.

## Dados não coletados

Não são coletados:

- geolocalização;
- dados biométricos;
- ponto eletrônico;
- folha de pagamento;
- dados de saúde.
