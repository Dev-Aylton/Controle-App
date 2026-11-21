window.PLANO_DATA = {
  "titulo": "Plano de desenvolvimento — Controle-App",
  "dataEstado": "2026-11-21",
  "etapas": [
    {
      "numero": 0,
      "nome": "Decisões e preparação",
      "tarefas": [
        {"nome": "Escopo definido", "feita": true},
        {"nome": "Perfis e regras de acesso definidos", "feita": true},
        {"nome": "Análise da planilha concluída", "feita": true},
        {"nome": "Stack e hospedagem definidos", "feita": true},
        {"nome": "5 etapas aprovadas", "feita": true},
        {"nome": "Roadmap em PDF criado", "feita": true},
        {"nome": "Repositório criado", "feita": true},
        {"nome": "Supabase real criado (São Paulo)", "feita": true},
        {"nome": "Supabase de testes criado", "feita": true},
        {"nome": "Logo opção A escolhida", "feita": true},
        {"nome": "Licença e links do autor no README", "feita": false},
        {"nome": "Decidir quem cadastra produtos e importa planilhas e vendas", "feita": false},
        {"nome": "Decidir se o admin lança movimentações", "feita": false},
        {"nome": "Decidir aprovação de funcionário novo", "feita": false}
      ]
    },
    {
      "numero": 1,
      "nome": "Base",
      "tarefas": [
        {"nome": "Projeto Vite/React/TypeScript criado", "feita": true},
        {"nome": "PWA no subcaminho /Controle-App/", "feita": true},
        {"nome": "Deploy por GitHub Actions configurado", "feita": true},
        {"nome": "Cliente Supabase criado", "feita": true},
        {"nome": "Vitest e Playwright configurados", "feita": true},
        {"nome": "Logo opção A aplicada", "feita": true},
        {"nome": "Migrations da etapa 1 escritas (não aplicadas)", "feita": true},
        {"nome": "Layout responsivo (notebook, tablet, mobile)", "feita": true},
        {"nome": "Conectar a pasta ao Git e fazer o primeiro commit", "feita": false},
        {"nome": "Preencher .env.local e testar conexão", "feita": false},
        {"nome": "Aplicar migrations no projeto de testes e depois no real", "feita": false},
        {"nome": "Login Google e e-mail/senha", "feita": false},
        {"nome": "Telas de empresas: nome, foto e telefone", "feita": false},
        {"nome": "Código da empresa", "feita": false},
        {"nome": "Vínculos e cargos", "feita": false},
        {"nome": "Desativação", "feita": false},
        {"nome": "Perfil do usuário", "feita": false},
        {"nome": "Seletor de empresa", "feita": false},
        {"nome": "Testes de RLS de empresas e vínculos", "feita": false},
        {"nome": "Fluxo de código", "feita": false},
        {"nome": "Troca de código", "feita": false},
        {"nome": "Multiempresa", "feita": false}
      ]
    },
    {
      "numero": 2,
      "nome": "Ambientes e produtos",
      "tarefas": [
        {"nome": "Ambientes de guarda", "feita": true},
        {"nome": "Ambientes de saída direta", "feita": true},
        {"nome": "Cadastro de produtos por ambiente", "feita": true},
        {"nome": "Variações de tamanho", "feita": true},
        {"nome": "Listas de categorias, unidades e motivos", "feita": true},
        {"nome": "Importação CSV/xlsx com prévia", "feita": true},
        {"nome": "Entrada manual rápida", "feita": true},
        {"nome": "Testes de importação", "feita": true},
        {"nome": "Testes de duplicados", "feita": true},
        {"nome": "Testes de permissões de cadastro", "feita": false}
      ]
    },
    {
      "numero": 3,
      "nome": "Movimentações",
      "tarefas": [
        {"nome": "Entradas", "feita": true},
        {"nome": "Saídas com destino e motivo", "feita": true},
        {"nome": "Transferência automática", "feita": true},
        {"nome": "Saldo calculado", "feita": true},
        {"nome": "Dose e garrafa aberta", "feita": false},
        {"nome": "Saldo negativo", "feita": false},
        {"nome": "Zeragem", "feita": false},
        {"nome": "Estorno", "feita": true},
        {"nome": "Correção em 15 minutos", "feita": true},
        {"nome": "Visão restrita do funcionário", "feita": true},
        {"nome": "Auditoria", "feita": true},
        {"nome": "Testes de saldo e dose", "feita": false},
        {"nome": "RLS do funcionário", "feita": false},
        {"nome": "Testes de estorno", "feita": false},
        {"nome": "Testes da janela de 15 minutos", "feita": false}
      ]
    },
    {
      "numero": 4,
      "nome": "Gestão",
      "tarefas": [
        {"nome": "Central de alertas", "feita": false},
        {"nome": "Estoque mínimo e sugestão", "feita": false},
        {"nome": "Motivo de perda pendente", "feita": false},
        {"nome": "Inventário cego", "feita": false},
        {"nome": "Lista de compras com sugestão", "feita": false},
        {"nome": "Painel resumo", "feita": false},
        {"nome": "Exportação Excel/CSV", "feita": false},
        {"nome": "Testes de alertas", "feita": false},
        {"nome": "Testes de inventário", "feita": false},
        {"nome": "Testes de sugestões", "feita": false}
      ]
    },
    {
      "numero": 5,
      "nome": "Robustez e vitrine",
      "tarefas": [
        {"nome": "Offline com fila e sincronização", "feita": false},
        {"nome": "Importação de vendas com mapa de produtos", "feita": false},
        {"nome": "Prévia e desfazer da importação de vendas", "feita": false},
        {"nome": "Modo demonstração com empresa fictícia e cargos", "feita": false},
        {"nome": "README do portfólio", "feita": false},
        {"nome": "Testes de offline", "feita": false},
        {"nome": "Testes de importação de vendas", "feita": false},
        {"nome": "Testes de fluxos completos", "feita": false}
      ]
    }
  ]
};
