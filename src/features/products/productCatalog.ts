export type ProductCatalogUnit =
  | 'un' | 'kg' | 'g' | 'l' | 'ml' | 'cx' | 'pct'
  | 'garrafa' | 'lata' | 'maço' | 'porcao' | 'duzia'
  | 'bandeja' | 'pacote' | 'saco' | 'ramo' | 'peca' | 'fardo' | 'frasco'

export type ProductCatalogSuggestion = {
  name: string
  category: string
  unit: ProductCatalogUnit
  volumeMl?: number
  doseMl?: number
  aliases?: string[]
}

export const PRODUCT_CATALOG: ProductCatalogSuggestion[] = [
  { name: 'Smirnoff', category: 'Destilados', unit: 'garrafa', volumeMl: 998, doseMl: 50, aliases: ['Vodka Smirnoff', 'Smirnoff 998'] },
  { name: 'Smirnoff 1,5 L', category: 'Destilados', unit: 'garrafa', volumeMl: 1500, doseMl: 50, aliases: ['Vodka Smirnoff 1,5L', 'Smirnoff 1500'] },
  { name: 'Cachaça 51', category: 'Destilados', unit: 'garrafa', volumeMl: 965, doseMl: 50 },
  { name: 'Cachaça 51 1 L', category: 'Destilados', unit: 'garrafa', volumeMl: 1000, doseMl: 50 },
  { name: 'Ypioca', category: 'Destilados', unit: 'garrafa', volumeMl: 965, doseMl: 50 },
  { name: 'Velho Barreiro', category: 'Destilados', unit: 'garrafa', volumeMl: 910, doseMl: 50 },
  { name: 'Absolut', category: 'Destilados', unit: 'garrafa', volumeMl: 750, doseMl: 50 },
  { name: 'Jack Daniel’s', category: 'Whisky', unit: 'garrafa', volumeMl: 1000, doseMl: 50 },
  { name: 'Red Label', category: 'Whisky', unit: 'garrafa', volumeMl: 1000, doseMl: 50 },
  { name: 'Black Label', category: 'Whisky', unit: 'garrafa', volumeMl: 1000, doseMl: 50 },
  { name: 'Heineken', category: 'Cervejas', unit: 'lata', volumeMl: 330, aliases: ['Heineken lata'] },
  { name: 'Heineken 600 ml', category: 'Cervejas', unit: 'garrafa', volumeMl: 600 },
  { name: 'Corona', category: 'Cervejas', unit: 'garrafa', volumeMl: 330 },
  { name: 'Skol', category: 'Cervejas', unit: 'lata', volumeMl: 269 },
  { name: 'Skol', category: 'Cervejas', unit: 'lata', volumeMl: 350 },
  { name: 'Skol 600 ml', category: 'Cervejas', unit: 'garrafa', volumeMl: 600 },
  { name: 'Brahma', category: 'Cervejas', unit: 'lata', volumeMl: 350 },
  { name: 'Brahma 600 ml', category: 'Cervejas', unit: 'garrafa', volumeMl: 600 },
  { name: 'Itaipava', category: 'Cervejas', unit: 'lata', volumeMl: 350 },
  { name: 'Original', category: 'Cervejas', unit: 'lata', volumeMl: 350 },
  { name: 'Budweiser', category: 'Cervejas', unit: 'lata', volumeMl: 350 },
  { name: 'Vinho tinto seco', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Vinho tinto', 'Vinho seco'] },
  { name: 'Vinho tinto suave', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Vinho suave tinto'] },
  { name: 'Vinho branco seco', category: 'Vinhos brancos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Vinho branco'] },
  { name: 'Vinho branco suave', category: 'Vinhos brancos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Vinho suave branco'] },
  { name: 'Vinho rosé', category: 'Vinhos rosés', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Rose', 'Rosado'] },
  { name: 'Vinho tinto 375 ml', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 375, doseMl: 150 },
  { name: 'Vinho tinto 1,5 L', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 1500, doseMl: 150 },
  { name: 'Pérgola', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Pergola vinho'] },
  { name: 'Vinho do Porto', category: 'Vinhos fortificados', unit: 'garrafa', volumeMl: 750, doseMl: 75, aliases: ['Porto'] },
  { name: 'Chardonnay', category: 'Vinhos brancos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Sauvignon Blanc', category: 'Vinhos brancos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Cabernet Sauvignon', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Merlot', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Malbec', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Pinot Noir', category: 'Vinhos tintos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Miolo', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Miolo wine', 'Miolo Merlot', 'Miolo Cabernet'] },
  { name: 'Aurora', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Vinícola Aurora'] },
  { name: 'Salton', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Casillero del Diablo', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Concha y Toro', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Santa Helena', category: 'Vinhos', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Espumante brut', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Espumante seco', 'Espumante extra brut'] },
  { name: 'Espumante demi-sec', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Espumante meio seco', 'Espumante demi sec'] },
  { name: 'Espumante moscatel', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Espumante doce'] },
  { name: 'Espumante rosé', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Espumante rose', 'Espumante rosado'] },
  { name: 'Espumante 375 ml', category: 'Espumantes', unit: 'garrafa', volumeMl: 375, doseMl: 150, aliases: ['Mini espumante'] },
  { name: 'Espumante 1,5 L', category: 'Espumantes', unit: 'garrafa', volumeMl: 1500, doseMl: 150, aliases: ['Espumante magnum'] },
  { name: 'Chandon', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Chandon brut', 'Chandon rosé'] },
  { name: 'Chandon Baby', category: 'Espumantes', unit: 'garrafa', volumeMl: 187, doseMl: 150, aliases: ['Mini Chandon'] },
  { name: 'Freixenet', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150 },
  { name: 'Prosecco', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Espumante italiano'] },
  { name: 'Champagne', category: 'Espumantes', unit: 'garrafa', volumeMl: 750, doseMl: 150, aliases: ['Champanhe'] },
  { name: 'Guaraná Antarctica', category: 'Refrigerantes', unit: 'lata', volumeMl: 350 },
  { name: 'Coca-Cola', category: 'Refrigerantes', unit: 'lata', volumeMl: 350 },
  { name: 'Coca-Cola 600 ml', category: 'Refrigerantes', unit: 'garrafa', volumeMl: 600 },
  { name: 'Coca-Cola 2 L', category: 'Refrigerantes', unit: 'garrafa', volumeMl: 2000 },
  { name: 'Sprite', category: 'Refrigerantes', unit: 'lata', volumeMl: 350 },
  { name: 'Fanta Laranja', category: 'Refrigerantes', unit: 'lata', volumeMl: 350 },
  { name: 'Água mineral sem gás', category: 'Águas e bebidas', unit: 'garrafa', volumeMl: 500 },
  { name: 'Água mineral com gás', category: 'Águas e bebidas', unit: 'garrafa', volumeMl: 500 },
  { name: 'Red Bull', category: 'Energéticos', unit: 'lata', volumeMl: 250 },
  { name: 'Monster', category: 'Energéticos', unit: 'lata', volumeMl: 473 },
  { name: 'Gelo 5 kg', category: 'Bar e consumo', unit: 'saco' },
  { name: 'Gelo em cubos', category: 'Bar e consumo', unit: 'kg' },
  { name: 'Limão', category: 'Hortifruti', unit: 'kg' },
  { name: 'Limão Taiti', category: 'Hortifruti', unit: 'kg' },
  { name: 'Limão Siciliano', category: 'Hortifruti', unit: 'kg' },
  { name: 'Laranja', category: 'Hortifruti', unit: 'kg' },
  { name: 'Abacaxi', category: 'Hortifruti', unit: 'un' },
  { name: 'Morango', category: 'Hortifruti', unit: 'bandeja' },
  { name: 'Hortelã', category: 'Hortifruti', unit: 'maço' },
  { name: 'Tomate', category: 'Hortifruti', unit: 'kg' },
  { name: 'Tomate cereja', category: 'Hortifruti', unit: 'bandeja' },
  { name: 'Cebola', category: 'Hortifruti', unit: 'kg' },
  { name: 'Alho', category: 'Hortifruti', unit: 'kg' },
  { name: 'Batata inglesa', category: 'Hortifruti', unit: 'kg' },
  { name: 'Batata doce', category: 'Hortifruti', unit: 'kg' },
  { name: 'Batata baroa', category: 'Hortifruti', unit: 'kg' },
  { name: 'Cenoura', category: 'Hortifruti', unit: 'kg' },
  { name: 'Brócolis', category: 'Hortifruti', unit: 'peca' },
  { name: 'Couve-flor', category: 'Hortifruti', unit: 'peca' },
  { name: 'Alface americana', category: 'Verduras', unit: 'peca' },
  { name: 'Alface lisa', category: 'Verduras', unit: 'peca' },
  { name: 'Rúcula', category: 'Verduras', unit: 'maço' },
  { name: 'Couve', category: 'Verduras', unit: 'maço' },
  { name: 'Espinafre', category: 'Verduras', unit: 'maço' },
  { name: 'Repolho', category: 'Hortifruti', unit: 'peca' },
  { name: 'Pimentão', category: 'Hortifruti', unit: 'kg' },
  { name: 'Abobrinha', category: 'Hortifruti', unit: 'kg' },
  { name: 'Berinjela', category: 'Hortifruti', unit: 'kg' },
  { name: 'Banana', category: 'Hortifruti', unit: 'kg' },
  { name: 'Maçã', category: 'Hortifruti', unit: 'kg' },
  { name: 'Melancia', category: 'Hortifruti', unit: 'peca' },
  { name: 'Melão', category: 'Hortifruti', unit: 'peca' },
  { name: 'Maracujá', category: 'Hortifruti', unit: 'kg' },
  { name: 'Espetinho de carne bovina', category: 'Carnes e espetinhos', unit: 'porcao', aliases: ['Espeto de carne', 'Espetinho bovino'] },
  { name: 'Espetinho de frango', category: 'Carnes e espetinhos', unit: 'porcao', aliases: ['Espeto de frango'] },
  { name: 'Espetinho misto', category: 'Carnes e espetinhos', unit: 'porcao', aliases: ['Espeto misto'] },
  { name: 'Espetinho de kafta', category: 'Carnes e espetinhos', unit: 'porcao', aliases: ['Espeto de kafta'] },
  { name: 'Espetinho de coração', category: 'Carnes e espetinhos', unit: 'porcao', aliases: ['Espeto de coracao', 'Espeto de coração'] },
  { name: 'Picanha', category: 'Carnes', unit: 'kg' },
  { name: 'Alcatra', category: 'Carnes', unit: 'kg' },
  { name: 'Maminha', category: 'Carnes', unit: 'kg' },
  { name: 'Contra-filé', category: 'Carnes', unit: 'kg' },
  { name: 'Coxão mole', category: 'Carnes', unit: 'kg' },
  { name: 'Fraldinha', category: 'Carnes', unit: 'kg' },
  { name: 'Costela bovina', category: 'Carnes', unit: 'kg' },
  { name: 'Cupim', category: 'Carnes', unit: 'kg' },
  { name: 'Acém', category: 'Carnes', unit: 'kg' },
  { name: 'Patinho', category: 'Carnes', unit: 'kg' },
  { name: 'Lagarto', category: 'Carnes', unit: 'kg' },
  { name: 'Filé mignon', category: 'Carnes', unit: 'kg' },
  { name: 'Bife ancho', category: 'Carnes', unit: 'kg' },
  { name: 'Bife ancho', category: 'Carnes', unit: 'porcao' },
  { name: 'Costela suína', category: 'Carnes suínas', unit: 'kg' },
  { name: 'Lombo suíno', category: 'Carnes suínas', unit: 'kg' },
  { name: 'Pernil suíno', category: 'Carnes suínas', unit: 'kg' },
  { name: 'Filé de frango', category: 'Aves', unit: 'kg' },
  { name: 'Peito de frango', category: 'Aves', unit: 'kg' },
  { name: 'Peito de frango', category: 'Aves', unit: 'porcao' },
  { name: 'Coxa e sobrecoxa', category: 'Aves', unit: 'kg' },
  { name: 'Asa de frango', category: 'Aves', unit: 'kg' },
  { name: 'Frango inteiro', category: 'Aves', unit: 'kg' },
  { name: 'Linguiça calabresa', category: 'Carnes', unit: 'kg' },
  { name: 'Linguiça toscana', category: 'Carnes', unit: 'kg' },
  { name: 'Salmão', category: 'Peixes', unit: 'kg' },
  { name: 'Tilápia', category: 'Peixes', unit: 'kg' },
  { name: 'Tilápia em posta', category: 'Peixes', unit: 'porcao' },
  { name: 'Pescada', category: 'Peixes', unit: 'kg' },
  { name: 'Merluza', category: 'Peixes', unit: 'kg' },
  { name: 'Dourado', category: 'Peixes', unit: 'kg' },
  { name: 'Robalo', category: 'Peixes', unit: 'kg' },
  { name: 'Atum', category: 'Peixes', unit: 'kg' },
  { name: 'Camarão', category: 'Frutos do mar', unit: 'kg' },
  { name: 'Arroz', category: 'Grãos e acompanhamentos', unit: 'kg' },
  { name: 'Feijão', category: 'Grãos e acompanhamentos', unit: 'kg' },
  { name: 'Farofa pronta', category: 'Acompanhamentos', unit: 'kg' },
  { name: 'Batata frita congelada', category: 'Frios e congelados', unit: 'kg' },
  { name: 'Queijo mussarela', category: 'Queijos e laticínios', unit: 'kg' },
  { name: 'Queijo prato', category: 'Queijos e laticínios', unit: 'kg' },
  { name: 'Queijo coalho', category: 'Queijos e laticínios', unit: 'kg' },
  { name: 'Bacon', category: 'Frios e embutidos', unit: 'kg' },
  { name: 'Pão francês', category: 'Padaria', unit: 'un' },
  { name: 'Pão de hambúrguer', category: 'Padaria', unit: 'pct' },
  { name: 'Açúcar', category: 'Bar e cozinha', unit: 'kg' },
  { name: 'Sal', category: 'Bar e cozinha', unit: 'kg' },
  { name: 'Carvão', category: 'Barbecue e churrasqueira', unit: 'pacote' },
  { name: 'Guardanapo', category: 'Descartáveis', unit: 'pct' },
  { name: 'Copo descartável 300 ml', category: 'Descartáveis', unit: 'pacote', volumeMl: 300 },
  { name: 'Copo descartável 200 ml', category: 'Descartáveis', unit: 'pacote', volumeMl: 200 },
  { name: 'Canudo', category: 'Descartáveis', unit: 'pacote' },
]

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function searchProductCatalog(query: string, limit = 6) {
  const normalized = normalizeSearch(query)
  if (!normalized) return []
  return PRODUCT_CATALOG
    .filter((item) => {
      const haystack = [item.name, item.category, ...(item.aliases ?? [])]
        .map(normalizeSearch)
        .join(' ')
      return haystack.includes(normalized)
    })
    .filter((item, index, items) =>
      items.findIndex((candidate) =>
        candidate.name === item.name
        && candidate.unit === item.unit
        && candidate.volumeMl === item.volumeMl
        && candidate.doseMl === item.doseMl
      ) === index,
    )
    .slice(0, limit)
}
