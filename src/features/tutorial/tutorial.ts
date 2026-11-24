import type { CompanyRole } from '../../lib/database.types'

export type TutorialStep = {
  title: string
  body: string
  bullets: string[]
  route?: string
  routeLabel?: string
}

const employeeSteps: TutorialStep[] = [
  {
    title: 'Seu papel como funcionário',
    body: 'Você registra o que aconteceu no estoque ou ambiente. Não precisa aprovar compras, finalizar inventários ou alterar preços.',
    bullets: [
      'Confirme o ambiente antes de registrar.',
      'Use entrada, saída, perda ou transferência conforme o fato ocorrido.',
      'Revise nome, quantidade e unidade antes de confirmar.',
      'Em caso de dúvida, avise o gerente ou proprietário.',
    ],
  },
  {
    title: 'Começo e seleção da empresa',
    body: 'Antes de registrar qualquer informação, confirme que a empresa correta está selecionada no cabeçalho.',
    bullets: [
      'Use o seletor de empresa no topo ou no menu lateral.',
      'Abra Minha conta para conferir perfil, tema e dados da sessão.',
      'Não lance movimentações sem conferir o ambiente exibido.',
    ],
    route: '/',
    routeLabel: 'Abrir início',
  },
  {
    title: 'Lançar entradas',
    body: 'Use entradas para registrar produtos que chegam ao ambiente. Você pode informar a unidade cadastrada, porções ou peso bruto.',
    bullets: [
      'Selecione o ambiente de origem.',
      'Busque o produto pelo nome ou código.',
      'Informe quantidade, porções ou peso em kg conforme o produto.',
      'Para bebidas com volume e dose cadastrados, use “Informar em doses”.',
      'Use observações apenas para contexto operacional.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Abrir movimentações',
  },
  {
    title: 'Lançar saídas e perdas',
    body: 'Saídas representam consumo ou venda. Perdas representam quebra, derramamento, validade, cortesia ou outros motivos.',
    bullets: [
      'Para perda, selecione o motivo imediatamente ou informe depois.',
      'Verifique o ambiente antes de confirmar.',
      'Perdas sem motivo aparecem na central de alertas.',
      'Em dose, o sistema converte o número de doses em fração da embalagem.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Registrar movimentação',
  },
  {
    title: 'Transferências',
    body: 'Use transferências para mover produtos entre estoque, embarque, VIP ou bar principal.',
    bullets: [
      'Informe origem e destino diferentes.',
      'Revise a quantidade antes de confirmar.',
      'Não lance duas vezes: a transferência gera uma saída e uma entrada vinculadas.',
      'Para retirar material, use “Retirada do ambiente de origem para o ambiente de destino”.',
      'Na devolução, use “Devolução do ambiente de destino ao ambiente de origem” e informe apenas o que sobrou.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Fazer transferência',
  },
  {
    title: 'Inventário cego',
    body: 'No inventário cego, você conta os produtos sem consultar o saldo anterior.',
    bullets: [
      'Selecione o ambiente da contagem.',
      'Abra uma sessão ou use uma sessão já aberta pelo gestor.',
      'Conte todos os produtos ou importe a planilha modelo após revisar as linhas.',
      'A contagem não altera o saldo até ser aplicada e revisada.',
      'Somente proprietário ou gerente finaliza e aplica as diferenças.',
    ],
    route: '/inventario',
    routeLabel: 'Abrir inventário',
  },
  {
    title: 'Trabalho sem conexão',
    body: 'Se a conexão cair, entradas, saídas e transferências simples podem ser salvas no aparelho e enviadas depois.',
    bullets: [
      'Confirme o status da fila no painel da conta.',
      'Não saia antes de resolver lançamentos pendentes.',
      'Perdas e lotes por planilha exigem conexão nesta versão.',
      'O banco recebe cada lançamento uma única vez quando a conexão retorna.',
    ],
  },
  {
    title: 'Lista de compras e reposição',
    body: 'Você pode solicitar reposição sem interromper o turno nem depender de uma pessoa específica para aprovar.',
    bullets: [
      'Abra Lista de compras e informe o ambiente de destino.',
      'Monte a solicitação com os produtos e quantidades necessários.',
      'Acompanhe o status pendente, aprovado ou atendido.',
      'Uma aprovação de qualquer gerente ou proprietário habilitado libera o fluxo.',
    ],
    route: '/compras',
    routeLabel: 'Solicitar reposição',
  },
  {
    title: 'Suporte privado',
    body: 'Cada usuário conversa diretamente com o administrador do aplicativo em uma conversa exclusiva.',
    bullets: [
      'Usuários diferentes não veem suas conversas.',
      'É possível enviar texto e anexos de até 10 MB.',
      'Mensagens têm estados de envio e visualização.',
      'Arquivar ou ocultar afeta apenas a visão de quem realizou a ação.',
    ],
    route: '/suporte',
    routeLabel: 'Abrir suporte',
  },
  {
    title: 'Meu perfil',
    body: 'Mantenha seu nome e foto atualizados e saiba como solicitar ajuda.',
    bullets: [
      'Edite nome, foto e avatar padrão.',
      'Use Minha conta para tema, diagnóstico e dados pessoais.',
      'Use Reportar problema ou Entrar em contato quando precisar de suporte.',
    ],
    route: '/perfil',
    routeLabel: 'Editar perfil',
  },
  {
    title: 'Avisos que precisam de sua atenção',
    body: 'O sino mostra itens abaixo do mínimo, perdas sem motivo e outros alertas definidos pela gestão.',
    bullets: [
      'Toque no aviso para abrir a área relacionada.',
      'Marque como lido após conferir.',
      'Dispense apenas quando o problema for resolvido ou não exigir ação.',
    ],
  },
]

const managementSteps: TutorialStep[] = [
  {
    title: 'Seu papel como gestor',
    body: 'Você organiza o cadastro, orienta funcionários, revisa divergências e decide ajustes finais.',
    bullets: [
      'Prepare produtos, ambientes, mínimo, máximo e preços.',
      'Oriente como o estoque deve ser retirado, vendido, devolvido ou registrado.',
      'Revise pendências, notificações, contagens e importações.',
      'Estorne ou finalize apenas após conferir o fato registrado.',
    ],
  },
  {
    title: 'Empresa e ambientes',
    body: 'Configure a estrutura que representa a operação real.',
    bullets: [
      'Cadastre nome, telefone e logo da empresa.',
      'Crie ambientes como estoque central, cozinha, salão, área externa ou outro local usado pela operação.',
      'Desative ambientes que não estiverem em uso.',
    ],
    route: '/ambientes',
    routeLabel: 'Gerenciar ambientes',
  },
  {
    title: 'Produtos e categorias',
    body: 'Cada produto precisa de unidade, estoque mínimo, custo e, quando aplicável, volume, dose ou peso por porção.',
    bullets: [
      'Use SKU/código para localizar e importar produtos.',
      'Cadastre categorias como bebidas, carnes, peixes, frutas, verduras e descartáveis.',
      'Use unidade, kg, g, litro, garrafa, lata, porção, peça, ramo, caixa ou pacote.',
      'Informe peso em gramas para converter porções em estoque.',
      'Importe CSV/XLSX pela página de produtos e revise correspondências antes de aplicar.',
    ],
    route: '/produtos',
    routeLabel: 'Cadastrar produtos',
  },
  {
    title: 'Importação da planilha',
    body: 'A planilha pode iniciar ou atualizar o cadastro em lote, mas itens ambíguos exigem revisão humana.',
    bullets: [
      'Use o modelo oficial disponível na importação.',
      'Confira nome, SKU, unidade, volume ou peso e custo.',
      'Se um item sem SKU parecer existente, escolha atualizar ou criar uma nova variante.',
      'Nenhum item será gravado antes de todas as linhas serem revisadas.',
    ],
    route: '/produtos/importar',
    routeLabel: 'Importar planilha',
  },
  {
    title: 'Movimentação em lote',
    body: 'Registre vários produtos e ambientes na mesma operação sem repetir o formulário produto por produto.',
    bullets: [
      'Adicione linhas, edite tipo, quantidade, origem e destino.',
      'Gere a prévia antes de confirmar.',
      'Revise itens repetidos e divergências de saldo.',
      'O lote só é aplicado quando todas as linhas estão válidas.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Montar lote manual',
  },
  {
    title: 'Estoque inicial',
    body: 'Depois de cadastrar produtos e ambientes, registre o estoque existente.',
    bullets: [
      'Use Entrada para cada ambiente.',
      'Para garrafas abertas, use “Informar em doses”.',
      'Alternativamente, baixe a planilha de contagem e importe o inventário inicial.',
    ],
    route: '/inventario',
    routeLabel: 'Abrir contagem inicial',
  },
  {
    title: 'Movimentações e perdas',
    body: 'O lançamento é o núcleo do controle.',
    bullets: [
      'Entradas: compras e reposições.',
      'Saídas: consumo, venda direta ou retirada.',
      'Perdas: quebra, derramamento, validade, cortesia e similares.',
      'Transferências: movimento entre ambientes.',
      'Motivos pendentes podem ser concluídos pelo próprio usuário ou pela gestão conforme a origem.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Abrir movimentações',
  },
  {
    title: 'Inventário',
    body: 'Use contagens físicas para ajustar diferenças com rastreabilidade e descobrir possíveis furos entre períodos.',
    bullets: [
      'Selecione o ambiente.',
      'Baixe o modelo oficial, conte na tela ou importe uma planilha.',
      'Confira todas as quantidades antes da prévia.',
      'Revise o saldo anterior, contado e diferença antes de finalizar.',
      'Use “Encontrar furo entre contagens” para comparar as duas últimas contagens.',
    ],
    route: '/inventario',
    routeLabel: 'Contar estoque',
  },
  {
    title: 'Alertas e compras',
    body: 'Acompanhe abaixo do mínimo, sem estoque, saldo negativo, perdas pendentes e divergências que precisam ser investigadas.',
    bullets: [
      'Defina mínimo e máximo por produto.',
      'Use Lista de compras para ver sugestões e custo estimado.',
      'Revise itens sugeridos, custos e quantidades antes de gerar PDF ou CSV.',
      'Toque no sino para abrir notificações, marcar leitura ou dispensar avisos.',
      'Use filtros por Estoque, Movimentações, Suporte e Sistema.',
      'Urgentes aparecem primeiro e são diferenciados por cor e texto.',
    ],
    route: '/compras',
    routeLabel: 'Abrir lista de compras',
  },
  {
    title: 'Fornecedores e preços de compra',
    body: 'Um produto pode ser comprado de fornecedores diferentes conforme preço e disponibilidade.',
    bullets: [
      'Cadastre fornecedores e dados de contato.',
      'Registre unidade de compra, unidades por embalagem e preço.',
      'Digite ou escolha um fornecedor diretamente na lista editável.',
      'Compare preços, mas confirme disponibilidade antes de comprar.',
    ],
    route: '/compras',
    routeLabel: 'Gerenciar fornecedores',
  },
  {
    title: 'Vendas e faturamento',
    body: 'Importe vendas pelo modelo oficial para descontar o estoque e calcular faturamento, custo da mercadoria vendida e lucro.',
    bullets: [
      'Cadastre preço por unidade e por dose em cada ambiente.',
      'Informe volume e dose no produto.',
      'Baixe o modelo oficial de vendas; ele inclui SKU, produto, quantidade e tipo.',
      'Para pratos e drinks, use uma ficha técnica separando preço comercial dos insumos consumidos.',
      'Revise SKU ou nome em cada item antes de confirmar.',
      'O app avisa quando a venda supera o saldo disponível, mas não apaga nem corrige automaticamente.',
      'Revise faturamento, custo da mercadoria vendida e lucro bruto na prévia.',
      'Desfaça um lote caso tenha sido aplicado errado.',
    ],
    route: '/vendas/importar',
    routeLabel: 'Importar vendas',
  },
  {
    title: 'Ciclo diário entre ambientes',
    body: 'Use transferências para retirar material de um ambiente central e devolver o restante de outro ambiente no final do dia.',
    bullets: [
      'Antes: explique aos funcionários o que será retirado, em qual ambiente será usado e qual será a devolução.',
      'Durante: registre vendas, consumo ou perda no ambiente de destino à medida que acontecer.',
      'Durante compras diretas: registre entrada no ambiente de destino e informe custo unitário, sem passar pelo ambiente de origem.',
      'No final: registre a devolução com a quantidade realmente restante.',
      'Não use saída comum para representar devolução; use transferência para aumentar o ambiente de origem.',
      'Compare saldo inicial, retiradas, vendas, compras diretas, perdas e saldo final antes de fechar.',
    ],
    route: '/movimentacoes',
    routeLabel: 'Registrar ciclo diário',
  },
  {
    title: 'Sugestões inteligentes de estoque',
    body: 'O app analisa consumo e frequência de compras para sugerir níveis mínimo e máximo.',
    bullets: [
      'Itens conserváveis podem receber uma sugestão de estoque maior.',
      'Itens perecíveis, como carnes, peixes e frutas, mantêm uma cobertura menor por segurança.',
      'Compras frequentes não alteram níveis automaticamente.',
      'A sugestão mostra confiança e motivo; você decide aceitar ou ignorar.',
    ],
    route: '/produtos',
    routeLabel: 'Revisar sugestões',
  },
  {
    title: 'Equipe e códigos',
    body: 'Controle quem acessa a empresa e quais ações podem executar.',
    bullets: [
      'Proprietários podem promover gerentes e gerir a equipe.',
      'Gerentes podem operar estoque, compras, vendas e inventário.',
      'Funcionários podem lançar e contar, conforme a operação.',
      'O código da empresa permite novos vínculos.',
      'Desative membros desligados e informe o motivo.',
      'Reative um vínculo preservando o histórico da pessoa.',
      'Filtre a equipe por cargo e status ativo ou inativo.',
    ],
    route: '/equipe',
    routeLabel: 'Gerenciar equipe',
  },
  {
    title: 'Relatórios e auditoria',
    body: 'Relatórios mostram movimentações por período e ambiente; auditoria registra ações sensíveis.',
    bullets: [
      'Exporte relatórios em CSV.',
      'Use auditoria para conferir suporte, zeragem, vendas e alterações.',
      'Acompanhe o painel e os alertas antes do fechamento.',
      'Analise divergências entre contagens e ações acima do saldo disponível.',
      'Confira o responsável e a data antes de estornar ou corrigir.',
    ],
    route: '/relatorios',
    routeLabel: 'Abrir relatórios',
  },
  {
    title: 'Conta, privacidade e suporte',
    body: 'Minha conta reúne atualização do app, exportação, tema, diagnóstico, privacidade e exclusão.',
    bullets: [
      'Baixe dados pessoais em JSON e dados operacionais em CSV.',
      'Use Suporte para conversar com o administrador e enviar anexos.',
      'A política informa exatamente como os dados são usados e mantidos.',
      'A exclusão da conta concede 90 dias para reativação e preserva histórico.',
    ],
    route: '/perfil',
    routeLabel: 'Abrir meu perfil',
  },
]

export function getTutorialSteps(role: CompanyRole | null, isAdmin: boolean): TutorialStep[] {
  if (isAdmin) return [
    ...managementSteps,
    {
      title: 'Modo suporte',
      body: 'Ao acessar outra empresa, suas ações ficam marcadas como suporte na auditoria.',
      bullets: [
        'Use apenas os dados necessários para resolver o problema.',
        'Evite alterar registro operacional sem justificativa.',
        'Consulte relatório e auditoria antes e depois do suporte.',
        'Revise notificações de divergências, contagens e vendas antes de agir.',
        'Proprietário aprova decisões da empresa; gerente orienta a operação; funcionário registra os fatos.',
        'Use a tela Empresa para suspender ou reativar uma empresa com confirmação.',
      ],
      route: '/auditoria',
      routeLabel: 'Abrir auditoria',
    },
    {
      title: 'Caixa de suporte',
      body: 'O administrador atende uma conversa privada por usuário, com anexos, leitura e arquivamento.',
      bullets: [
        'Filtre conversas abertas e arquivadas.',
        'Responda somente o usuário da conversa selecionada.',
        'O sino mostra a quantidade de mensagens não lidas.',
        'Ocultar ou arquivar afeta somente a visão do administrador.',
      ],
      route: '/suporte',
      routeLabel: 'Abrir caixa de suporte',
    },
  ]
  if (role === 'employee') return employeeSteps
  if (role === 'owner') return managementSteps
  if (role === 'manager') return managementSteps
  return [
    {
      title: 'Selecione uma empresa',
      body: 'Entre em uma empresa pelo seletor ou solicite o código ao responsável.',
      bullets: ['Confira o ambiente ativo.', 'Abra Minha conta se precisar alterar perfil ou tema.'],
    },
  ]
}

export function dismissTutorial(storage: Pick<Storage, 'setItem'> | null, role: string) {
  try {
    storage?.setItem(`controle-app-tutorial-dismissed-${role}`, 'true')
  } catch {
    // Tutorial opcional: a ausência de armazenamento não bloqueia o app.
  }
}

export function getTutorialStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function wasTutorialDismissed(storage: Pick<Storage, 'getItem'> | null, role: string) {
  try {
    return storage?.getItem(`controle-app-tutorial-dismissed-${role}`) === 'true'
  } catch {
    return false
  }
}
