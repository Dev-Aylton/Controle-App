type Props = {
  headingId?: string
  release?: { version: string; publishedAt: string } | null
}

export function PrivacyPolicyContent({ headingId, release = null }: Props) {
  const published = Boolean(release?.version && release.publishedAt)
  const publishedDate = published
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(release!.publishedAt))
    : ''

  return (
    <div className="privacy-policy-content">
      {!published && (
        <p className="privacy-policy-draft" role="status">
          Versão 1.3.0 preparada para publicação.
        </p>
      )}
      <p className="eyebrow">Privacidade e proteção de dados</p>
      <h1 id={headingId}>Política de Privacidade do Controle-App</h1>
      <p className="privacy-policy-version">
        Versão 1.3.0 · Última atualização: 24 de novembro de 2026
        {published ? ` · Em vigor desde ${publishedDate}` : ''}
      </p>

      <section>
        <h2>Resumo simples</h2>
        <p>
          O Controle-App ajuda empresas a controlar produtos, estoques, ambientes,
          movimentações, inventários, vendas, compras, fornecedores e equipes.
        </p>
        <p>
          O aplicativo guarda dados da conta, dados operacionais da empresa e informações
          necessárias ao suporte. Ele usa login, banco de dados e armazenamento fornecidos
          pela Supabase.
        </p>
        <p>
          Somente os usuários autorizados pela empresa veem os dados daquela empresa. O
          administrador do aplicativo pode acessar dados e usar o modo suporte para manter
          ou corrigir o sistema, com essas ações registradas na auditoria.
        </p>
        <p>
          Cada usuário tem uma conversa privada com o administrador do aplicativo. O
          usuário não vê conversas de outras pessoas.
        </p>
        <p>O Controle-App não vende dados pessoais nem usa dados para publicidade.</p>
      </section>

      <section>
        <h2>1. Quem controla e quem opera os dados</h2>
        <p><strong>Aylton Alberto Araujo, pessoa física, é responsável pelo Controle-App.</strong></p>
        <p>Para os dados da conta e do perfil, o responsável pelo Controle-App é o controlador.</p>
        <p>
          Para dados operacionais da empresa, como produtos, estoques, fornecedores, compras,
          vendas, equipes e registros de trabalho, a empresa usuária é a controladora. O
          Controle-App, representado pelo responsável, atua como operador e trata esses dados
          seguindo as instruções da empresa.
        </p>
        <p>
          Contato: <a href="mailto:desenvolvedor.aylton@gmail.com">desenvolvedor.aylton@gmail.com</a>
          {' '}ou chat privado de suporte dentro do aplicativo.
        </p>
      </section>

      <section>
        <h2>2. Dados tratados</h2>
        <h3>Conta e perfil</h3>
        <p>
          O aplicativo trata e-mail, nome de exibição, identificador da conta, forma de
          autenticação, sessão de acesso, foto enviada pelo usuário ou avatar padrão e histórico
          de alterações do perfil. O aplicativo não solicita telefone pessoal no cadastro.
        </p>
        <h3>Empresa e equipe</h3>
        <p>
          O aplicativo trata nome e telefone da empresa, foto ou logotipo, membros e vínculos,
          cargos, códigos de entrada, convites, estado ativo ou suspenso, motivo e responsável
          pela suspensão ou desativação e motivo e responsável pela desativação de membros.
        </p>
        <h3>Produtos e estoque</h3>
        <p>
          O aplicativo trata nome, código, categoria e unidade dos produtos, volume, peso,
          dose, estoque mínimo e máximo, custos, preços por unidade e ambiente, saldo por
          ambiente, produtos ativos ou desativados, ambientes e categorias.
        </p>
        <h3>Movimentações e inventários</h3>
        <p>
          O aplicativo trata entradas, saídas, perdas e motivos, transferências, estornos,
          ajustes, zeragens, contagens, sessões de inventário, observações e a data, produto,
          ambiente e usuário responsável.
        </p>
        <h3>Compras e fornecedores</h3>
        <p>
          O aplicativo trata fornecedores, contatos e observações, preços por fornecedor,
          unidade e quantidade de compra, itens da lista, quantidades sugeridas, custos
          estimados e o rascunho da lista no aparelho.
        </p>
        <h3>Vendas e ficha técnica</h3>
        <p>
          O aplicativo trata vendas importadas, nomes externos, vínculo entre venda e produto,
          quantidades, tipos de venda, faturamento, custo, lucro, itens vendidos, ingredientes,
          quantidade e unidade dos ingredientes e preço por ambiente. Fichas técnicas
          cadastradas pela empresa são gravadas no aplicativo.
        </p>
        <h3>Auditoria e suporte</h3>
        <p>
          O aplicativo trata ações importantes, usuário responsável, empresa, objeto, data,
          resumo da operação, indicação de ações em modo suporte e informações de atendimento.
        </p>
        <p>
          Registros técnicos temporários ficam no aparelho e podem ser copiados ou enviados
          pelo usuário ao solicitar suporte. Eles podem incluir versão, conexão, navegador,
          formato da tela, empresa, cargo e fila offline. Os dados específicos do chat estão
          descritos na seção 3.
        </p>
      </section>

      <section>
        <h2>3. Chat de suporte</h2>
        <p>Cada usuário tem uma conversa privada com o administrador do aplicativo.</p>
        <p>
          O aplicativo grava o texto das mensagens, data e hora, autor, estado de envio e
          visualização e as opções de arquivamento e ocultação.
        </p>
        <p>
          Arquivos enviados ficam em uma área privada. O usuário pode abrir os arquivos da
          própria conversa e o administrador pode acessá-los para prestar suporte.
        </p>
        <p>
          Usuários diferentes não veem as mensagens uns dos outros. O chat não é usado para
          conversa entre funcionários ou entre empresas.
        </p>
        <p>
          Mensagens e anexos são mantidos enquanto forem necessários ao atendimento e ao
          histórico de suporte. O aplicativo não os exclui automaticamente nem os apaga quando
          a conta é excluída.
        </p>
      </section>

      <section>
        <h2>4. Dados guardados no aparelho</h2>
        <p>
          O aplicativo pode guardar no aparelho o tema, empresa ativa, conclusão do tutorial,
          avisos lidos ou dispensados, categoria e prioridade dos avisos, rascunho da lista de
          compras, lançamentos feitos sem conexão, catálogo necessário às movimentações offline
          e preferência temporária desta política.
        </p>
        <p>
          Os dados offline são separados por conta. Lançamentos offline não são apagados
          simplesmente porque a conexão foi perdida. Quando a conexão volta, o aplicativo tenta
          enviá-los. Antes de sair, o usuário pode aguardar, tentar enviar ou confirmar o
          descarte.
        </p>
        <p>
          Ao sair, o aplicativo remove a fila e o catálogo offline da conta, preferências
          pessoais, dados temporários da sessão e arquivos temporários desnecessários. O tema e
          os arquivos necessários para abrir o aplicativo podem permanecer. Ao solicitar
          exclusão, os dados locais também são removidos após a confirmação.
        </p>
      </section>

      <section>
        <h2>5. Quem acessa os dados</h2>
        <ul>
          <li><strong>Funcionários:</strong> veem o necessário para o trabalho permitido.</li>
          <li><strong>Gerentes:</strong> acessam equipe, estoque, compras, relatórios e auditoria.</li>
          <li><strong>Proprietários:</strong> acessam a gestão e os registros da empresa.</li>
          <li>
            <strong>Administrador do aplicativo:</strong> acessa todas as empresas, mesmo sem
            ser membro, em modo suporte, para suporte, manutenção ou investigação de incidente.
            As ações aparecem na auditoria da empresa, marcadas como suporte, e os gestores
            podem vê-las.
          </li>
        </ul>
        <p>Uma empresa nunca consegue ver dados operacionais de outra empresa.</p>
        <p>
          No suporte, o administrador pode ver os dados necessários à conversa e aos registros
          identificados pelo usuário ou pela empresa. Mensagens e operações de suporte podem
          ficar registradas na auditoria.
        </p>
      </section>

      <section>
        <h2>6. Empresas que ajudam a operar o aplicativo</h2>
        <ul>
          <li>
            <strong>Supabase:</strong> fornece banco de dados, login e armazenamento. O banco de
            dados fica na região de São Paulo, Brasil.
          </li>
          <li>
            <strong>Google:</strong> recebe os dados necessários à autenticação quando o usuário
            escolhe entrar com o Google.
          </li>
          <li>
            <strong>GitHub Pages:</strong> hospeda o aplicativo e pode receber endereço de
            internet e dados técnicos da conexão.
          </li>
        </ul>
        <p>
          Os provedores podem manter registros técnicos como endereço de internet, horário,
          navegador e informações da requisição. O GitHub Pages não recebe diretamente os dados
          operacionais inseridos dentro do aplicativo.
        </p>
        <p>O aplicativo não usa analytics, cookies de rastreamento nem publicidade.</p>
      </section>

      <section>
        <h2>7. Exportação</h2>
        <p>O usuário pode exportar seus dados pessoais em formato JSON pela opção da conta.</p>
        <p>
          Proprietários e gerentes autorizados podem exportar dados operacionais da empresa em
          CSV, incluindo dados disponíveis para alerta, compra e movimentação.
        </p>
      </section>

      <section>
        <h2>8. Exclusão da conta</h2>
        <p>Ao solicitar a exclusão:</p>
        <ol>
          <li>a conta perde o acesso;</li>
          <li>todos os vínculos ativos com empresas são desativados;</li>
          <li>as sessões atuais são encerradas;</li>
          <li>os lançamentos offline podem ser enviados ou descartados e os dados locais são removidos;</li>
          <li>a pessoa tem 90 dias para entrar novamente e cancelar o pedido.</li>
        </ol>
        <p>
          Durante esses 90 dias, e-mail, nome, foto, informações de login e vínculos necessários
          à reativação continuam registrados. A pessoa pode cancelar o pedido e reativar os
          vínculos. Quem é o único proprietário de uma empresa precisa transferir a propriedade
          antes de excluir a conta.
        </p>
        <p>Após os 90 dias:</p>
        <ul>
          <li>o e-mail, telefone de autenticação, senha, identidades de login, sessões e demais dados pessoais da conta são removidos;</li>
          <li>o nome exibido no perfil passa a ser “Conta excluída”;</li>
          <li>a foto é removida;</li>
          <li>convites pendentes associados ao e-mail são removidos;</li>
          <li>a conta fica bloqueada e não pode mais ser reativada.</li>
        </ul>
        <p>A exclusão não apaga automaticamente mensagens, anexos do chat, movimentações, inventários, vendas, fornecedores, compras, fichas técnicas, registros operacionais, auditoria ou referências internas.</p>
        <p>
          Esses dados continuam associados ao histórico da empresa e ao identificador interno da
          conta. O histórico é mantido para o controle da empresa, para a segurança e para o
          exercício regular de direitos. O identificador permanece no histórico, sem nome nem
          e-mail. O nome público passa a ser “Conta excluída”.
        </p>
        <p>Mensagens e anexos do chat podem continuar acessíveis conforme as regras privadas de suporte.</p>
        <p>Após os 90 dias, a exclusão é feita automaticamente.</p>
      </section>

      <section>
        <h2>9. Finalidade, dados e retenção</h2>
        <div className="privacy-policy-table-wrap" tabIndex={0} role="region" aria-label="Tabela de finalidades, dados, bases legais e retenção">
          <table className="privacy-policy-table">
            <thead>
              <tr><th>Finalidade</th><th>Dados</th><th>Base legal</th><th>Retenção</th></tr>
            </thead>
            <tbody>
              <tr><th>Criar e manter a conta</th><td>E-mail, nome, login, sessão e identificador</td><td>Execução de contrato</td><td>Enquanto a conta estiver ativa</td></tr>
              <tr><th>Vincular pessoas às empresas</th><td>Vínculo, cargo, código e convites</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto houver vínculo ou necessidade no histórico</td></tr>
              <tr><th>Operar estoque e ambientes</th><td>Produtos, unidades, custos, saldos e movimentações</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto necessário ao controle da empresa</td></tr>
              <tr><th>Realizar inventários</th><td>Contagens, sessões, ajustes e observações</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto necessário ao histórico da empresa</td></tr>
              <tr><th>Gerenciar compras e fornecedores</th><td>Fornecedores, contatos, preços e listas</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto necessário à operação</td></tr>
              <tr><th>Gerenciar vendas e preços</th><td>Vendas, custos, preços e fichas técnicas</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto necessário ao histórico comercial</td></tr>
              <tr><th>Gerar alertas e sugestões</th><td>Saldos, consumo, mínimos, máximos e ambiente</td><td>Execução de contrato e instruções da empresa</td><td>Enquanto necessário à operação</td></tr>
              <tr><th>Garantir segurança e rastreabilidade</th><td>Usuário, ação, empresa, objeto, data e modo suporte</td><td>Legítimo interesse e obrigação legal, quando aplicável</td><td>Enquanto necessário ao controle e à prestação de contas</td></tr>
              <tr><th>Usar foto de perfil</th><td>Foto e referência da imagem</td><td>Consentimento</td><td>Até remoção ou finalização da conta</td></tr>
              <tr><th>Prestar suporte</th><td>Conversas, anexos e dados técnicos enviados</td><td>Execução de contrato e legítimo interesse</td><td>Enquanto necessário ao atendimento e histórico</td></tr>
              <tr><th>Sincronizar dados offline</th><td>Empresa, produto, ambiente, quantidade e estado</td><td>Execução de contrato</td><td>Até envio confirmado ou descarte</td></tr>
              <tr><th>Responder direitos do titular</th><td>Dados necessários à solicitação</td><td>Exercício regular de direitos e obrigação legal, quando aplicável</td><td>Pelo período necessário à resposta</td></tr>
            </tbody>
          </table>
        </div>
        <p>Registros operacionais e de auditoria não possuem prazo automático fixo de eliminação no aplicativo.</p>
        <p>Alertas e sugestões de compra são apenas apoio e exigem revisão de uma pessoa. O aplicativo não toma decisões automatizadas sobre pessoas.</p>
      </section>

      <section>
        <h2>10. Menores de 18 anos</h2>
        <p>O aplicativo é destinado a maiores de 18 anos. O cadastro não verifica idade e não existe processo automático de detecção.</p>
        <p>Se uma conta de pessoa menor de 18 anos for identificada, o responsável pelo aplicativo ou a empresa pode encerrar o acesso.</p>
        <p>A identificação de menor não ativa, por si só, uma exclusão automática da conta.</p>
      </section>

      <section>
        <h2>11. Responsabilidades da empresa</h2>
        <p>A empresa que cadastra fornecedores, compradores, colegas de equipe e outros dados deve ter autorização para fornecer essas informações.</p>
        <p>A empresa deve conferir vínculos, cargos, fornecedores, preços e dados inseridos, informar titulares quando necessário e controlar quem pode acessar ou editar os registros.</p>
      </section>

      <section>
        <h2>12. Direitos do titular</h2>
        <ul>
          <li>confirmação da existência de dados;</li>
          <li>acesso e correção;</li>
          <li>exclusão, conforme a seção 8. Mensagens, anexos e histórico da empresa são mantidos;</li>
          <li>portabilidade;</li>
          <li>informação sobre compartilhamento;</li>
          <li>oposição;</li>
          <li>revogação de consentimento aplicável.</li>
        </ul>
        <p>O prazo de resposta às solicitações será de até 15 dias.</p>
        <p>Para dados da conta, use “Minha conta” ou o e-mail de privacidade. Para dados operacionais, a empresa controladora pode participar da resposta.</p>
        <p>Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados.</p>
      </section>

      <section>
        <h2>13. Dados que não são coletados</h2>
        <p>O aplicativo não coleta geolocalização, dados biométricos, dados de ponto eletrônico, folha de pagamento nem dados de saúde.</p>
      </section>

      <section>
        <h2>14. Segurança e incidentes</h2>
        <p>O aplicativo usa autenticação, controles de acesso por empresa e cargo, auditoria e proteção contra alteração ou exclusão indevida de registros críticos.</p>
        <p>As ações administrativas são registradas e ficam marcadas quando feitas em modo suporte.</p>
        <p>Em incidente que possa causar risco ou dano relevante, o responsável avaliará o ocorrido e comunicará a ANPD e os titulares afetados em prazo razoável.</p>
      </section>

      <section>
        <h2>15. Backups</h2>
        <p>Os provedores podem manter backups conforme suas próprias políticas. O aplicativo não cria cópia própria de todos os dados operacionais.</p>
        <p>Os dados podem permanecer pelo tempo estritamente necessário aos backups e à recuperação do provedor.</p>
      </section>

      <section>
        <h2>16. Transferência internacional</h2>
        <p>Os provedores podem estar sediados ou operar fora do Brasil. O Google participa apenas quando escolhido para login. A Supabase e o GitHub Pages podem processar dados em infraestruturas próprias.</p>
        <p>Quando houver transferência internacional, ela será feita com as salvaguardas aplicáveis à proteção dos dados.</p>
      </section>

      <section>
        <h2>17. Alterações desta política</h2>
        <p>Esta é a versão 1.3.0. Os usuários serão avisados no aplicativo quando houver nova versão publicada. Quando necessário, será solicitado novo aceite.</p>
        <p>Esta política entra em vigor a partir de sua publicação no aplicativo.</p>
      </section>

      <section>
        <h2>18. Histórico de versões</h2>
        <p><strong>1.3.0:</strong> versão inicial desta política.</p>
      </section>
    </div>
  )
}
