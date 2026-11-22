# Capturas do aplicativo

As capturas ainda estão pendentes. A execução Playwright disponível falhou antes de renderizar a demonstração porque a proteção de rede também interceptou o módulo local `src/lib/supabase.ts`, e a navegação absoluta descartava o subcaminho configurado; nenhuma imagem foi gerada. A proteção e a navegação foram corrigidas, mas a suíte não foi executada novamente para respeitar o limite de uma execução.

Arquivos previstos para a próxima execução headless, sempre com dados fictícios e bloqueio de chamadas ao Supabase:

- `inicio.png` — início da demonstração.
- `produtos.png` — catálogo fictício.
- `movimentacoes.png` — histórico fictício recente.
- `alertas.png` — resumo de alertas fictícios.
- `minha-conta.png` — painel de conta demonstrativo.
- `tema-escuro.png` — início em tema escuro.
- `celular-iphone-14.png` — viewport 390 × 844 com barra inferior.
