type Props = {
  headingId?: string
  release?: { version: string; publishedAt: string } | null
}

export function PrivacyPolicyContent({ headingId, release = null }: Props) {
  const published = Boolean(release?.version && release.publishedAt)
  const publishedDate = published ? new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(release!.publishedAt)) : ''
  return (
    <div className="privacy-policy-content">
      {!published && (
        <p className="privacy-policy-draft" role="status">
          Minuta para revisão — esta versão não foi publicada e não está vigente.
        </p>
      )}
      <p className="eyebrow">Privacidade e proteção de dados</p>
      <h1 id={headingId}>Aviso de Privacidade do Controle-App</h1>
      <p className="privacy-policy-version">
        {published
          ? `Versão ${release!.version} · Em vigor desde ${publishedDate}`
          : 'Versão 1.1.0 · Data de vigência: não vigente (minuta)'}
      </p>

      <section>
        <h2>1. Quem controla os dados</h2>
        <p>
          Aylton Alberto é o controlador dos dados da sua conta (e-mail, nome, autenticação,
          sessão e foto de perfil) e os usa para fornecer o Controle-App. A empresa usuária é
          a controladora dos dados operacionais (produtos, estoque, movimentações, equipe e
          vendas); o Controle-App os trata em nome da empresa, seguindo as instruções dela.
        </p>
        <p>
          Para dúvidas ou solicitações sobre privacidade, use o{' '}
          <a href="mailto:desenvolvedor.aylton@gmail.com" aria-label="Enviar e-mail ao canal de privacidade">
            canal de privacidade por e-mail
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Quem pode usar o aplicativo</h2>
        <p>
          O Controle-App é destinado exclusivamente a maiores de 18 anos e não verifica a idade
          no cadastro. Se tomarmos conhecimento de conta de pessoa menor de 18 anos, ela será
          encerrada e os dados pessoais serão excluídos conforme a seção 7.
        </p>
      </section>

      <section>
        <h2>3. Quais dados são usados</h2>
        <ul>
          <li>
            <strong>Conta e acesso:</strong> e-mail, nome, identificadores da conta, provedor de
            login, sessão e foto de perfil. Esses dados permitem entrar e manter sua conta.
          </li>
          <li>
            <strong>Operação da empresa:</strong> vínculos, cargos, produtos, custos, estoque,
            movimentações, inventários, equipes, vendas importadas, observações, divergências,
            peso ou porções de insumos, fichas técnicas de pratos/drinks e auditoria.
          </li>
          <li>
            <strong>Suporte e segurança:</strong> registros de ações e informações técnicas
            disponíveis no aplicativo podem ser usados para diagnosticar falhas, proteger contas
            e investigar incidentes.
          </li>
          <li>
            <strong>Foto de perfil:</strong> a foto é opcional. Você pode usar um avatar padrão
            sem enviar uma imagem.
          </li>
        </ul>
        <p>
          O Controle-App não vende dados pessoais nem os usa para publicidade.
        </p>
        <p>
          Sugestões de reposição, alertas de estoque, análise entre contagens e importações
          assistidas são ferramentas operacionais sobre produtos e movimentações. Nenhuma
          alteração automática é aplicada sem revisão ou confirmação do usuário.
        </p>
        <p>
          Evite digitar dados pessoais de terceiros em observações, campos livres e outros
          registros operacionais.
        </p>
      </section>

      <section>
        <h2>4. Quando há suporte administrativo</h2>
        <p>
          A equipe administradora (hoje, o próprio desenvolvedor) pode acessar ou alterar dados
          de uma empresa para prestar suporte. Essas ações ficam registradas na auditoria e
          identificadas como suporte, para que o proprietário da empresa possa conferir o que
          foi feito.
        </p>
      </section>

      <section>
        <h2>5. Dados guardados neste aparelho</h2>
        <ul>
          <li>
            <strong>Fila e catálogo offline:</strong> armazenados no IndexedDB do navegador e
            associados à conta que os criou. A fila pode incluir empresa, produto e ambiente,
            tipo e quantidade da movimentação, observação, data, estado de sincronização e
            motivo de perda. O catálogo ajuda a consultar itens sem conexão.
          </li>
          <li>
            <strong>Preferências:</strong> tema, empresa ativa e conclusão do tutorial ficam no
            localStorage. A leitura, dispensa e estado de notificações também são guardados
            localmente por empresa e conta. Ao sair ou solicitar exclusão, apenas a preferência
            de tema é mantida.
          </li>
          <li>
            <strong>Cache do aplicativo:</strong> arquivos estáticos do PWA podem permanecer no
            Cache Storage para permitir que o aplicativo abra offline. Caches não estáticos são
            removidos ao sair ou solicitar exclusão.
          </li>
          <li>
            <strong>Sessão:</strong> a sessão de autenticação é mantida localmente pelo cliente
            Supabase e removida deste aparelho quando você sai da conta.
          </li>
        </ul>
        <p>
          Ao sair, o aplicativo remove do aparelho os dados offline da sua conta, as preferências
          locais que não sejam o tema, a sessão e os caches não estáticos. O tema e os arquivos
          estáticos necessários para abrir o PWA são mantidos.
        </p>
        <p>
          Se houver lançamentos pendentes, você poderá aguardar, tentar enviá-los ou confirmar
          o descarte antes de sair. Registros antigos sem conta identificada não são exibidos
          nem enviados e exigem confirmação para descarte.
        </p>
        <p>
          Ao solicitar exclusão, os dados locais também são removidos após a confirmação
          digitada. Ao remover uma foto enviada ao aplicativo, o arquivo é apagado do Storage
          e as referências da foto no perfil são limpas.
        </p>
        <p>
          O Controle-App não usa cookies próprios nem ferramentas de análise ou publicidade.
          A sessão e as preferências ficam no armazenamento local do navegador, como descrito
          acima. Ao entrar com Google, o Google pode usar cookies nos domínios dele, conforme
          a política de privacidade do Google.
        </p>
      </section>

      <section>
        <h2>6. Empresas que ajudam a operar o aplicativo</h2>
        <ul>
          <li>
            <strong>Supabase Inc.:</strong> fornece banco de dados, autenticação e armazenamento.
            Os dados do projeto ficam em São Paulo, Brasil (sa-east-1). A Supabase é uma empresa
            sediada nos Estados Unidos.
          </li>
          <li>
            <strong>Google:</strong> recebe dados necessários à autenticação somente se você
            escolher entrar com Google. O Google pode tratar dados fora do Brasil.
          </li>
          <li>
            <strong>GitHub Pages:</strong> hospeda o aplicativo e recebe endereço IP e dados
            técnicos das requisições. O GitHub pode tratar dados fora do Brasil.
          </li>
        </ul>
        <p>
          Consulte as políticas de{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a>,{' '}
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a>{' '}
          e <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </section>

      <section>
        <h2>7. Quanto tempo os dados ficam guardados e como excluir a conta</h2>
        <p>
          Ao solicitar a exclusão, o acesso é encerrado e os vínculos com empresas são
          desativados. Durante 90 dias, você pode entrar novamente e cancelar o pedido para
          reativar a conta. Nesse período, os dados necessários à reativação e a foto de perfil
          permanecem armazenados.
        </p>
        <p>
          Após o prazo, o processo automático remove os identificadores de autenticação e a foto
          de perfil e substitui o nome do perfil por “Conta excluída”.
        </p>
        <p>
          Os registros operacionais e de auditoria não têm prazo fixo de eliminação: ficam
          enquanto forem necessários ao histórico e ao controle da empresa.
        </p>
        <p>
          Alguns identificadores internos podem continuar associados aos registros antigos.
        </p>
      </section>

      <section>
        <h2>8. Seus direitos e como solicitar</h2>
        <p>
          Você pode confirmar, corrigir, acessar ou solicitar a exclusão dos seus dados pelos
          recursos disponíveis no aplicativo ou pelo canal de privacidade. Responderemos em até
          15 dias, nos termos da LGPD.
        </p>
        <p>
          Se o pedido for sobre dados operacionais, indicaremos a empresa responsável e,
          quando necessário, repassaremos o pedido a ela.
        </p>
        <div className="privacy-policy-table-wrap" tabIndex={0} role="region" aria-label="Tabela de direitos e formas de solicitação">
          <table className="privacy-policy-table">
            <thead>
              <tr><th scope="col">Direito</th><th scope="col">Como solicitar</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Confirmação e acesso</th><td>Baixe os dados pessoais em Minha conta ou solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Correção</th><td>Edite seu nome e foto em Meu perfil. Para outros dados, use o canal de privacidade.</td></tr>
              <tr><th scope="row">Anonimização, bloqueio ou eliminação</th><td>Use a opção de exclusão da conta em Minha conta. Para outros dados, use o canal de privacidade.</td></tr>
              <tr><th scope="row">Portabilidade</th><td>Use a exportação disponível no aplicativo ou solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Informação sobre compartilhamento</th><td>Solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Consequências de não consentir</th><td>A foto é opcional; sem ela o perfil usa um avatar padrão e todas as funções continuam disponíveis.</td></tr>
              <tr><th scope="row">Revogação do consentimento</th><td>Use Meu perfil para remover a foto enviada ao aplicativo e solicite outras revogações pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Oposição</th><td>Apresente sua solicitação e justificativa pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Decisões automatizadas</th><td>O Controle-App não toma decisões automatizadas sobre pessoas. Alertas e sugestões dizem respeito a produtos e exigem revisão ou confirmação humana.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Você também pode apresentar uma petição à Autoridade Nacional de Proteção de Dados
          (ANPD), nos termos da legislação aplicável.
        </p>
      </section>

      <section>
        <h2>9. Bases legais adotadas</h2>
        <p>LGPD, artigo 7º:</p>
        <div className="privacy-policy-table-wrap" tabIndex={0} role="region" aria-label="Tabela de bases legais">
          <table className="privacy-policy-table">
            <thead>
              <tr><th scope="col">Finalidade</th><th scope="col">Base legal adotada</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Criação da conta e autenticação</th><td>Execução de contrato (art. 7º, V).</td></tr>
              <tr><th scope="row">Dados operacionais usados nas funções de gestão</th><td>Execução do serviço contratado pela empresa (art. 7º, V).</td></tr>
              <tr><th scope="row">Contagens, divergências, furos e sugestões de reposição</th><td>Execução do serviço contratado pela empresa e legítimo interesse de controle operacional (art. 7º, V e IX).</td></tr>
              <tr><th scope="row">Fichas técnicas, receita comercial e preços por ambiente</th><td>Execução do serviço contratado pela empresa (art. 7º, V).</td></tr>
              <tr><th scope="row">Segurança e auditoria</th><td>Legítimo interesse (art. 7º, IX).</td></tr>
              <tr><th scope="row">Foto enviada pelo usuário</th><td>Consentimento (art. 7º, I).</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>10. Segurança e resposta a problemas</h2>
        <p>
          O aplicativo usa políticas de segurança em nível de linha (RLS) para separar dados por
          empresa, controla acessos conforme as funções de usuário, mantém auditoria protegida
          contra alteração e usa conexões HTTPS com Supabase e GitHub Pages.
        </p>
        <p>
          Nenhum sistema é totalmente imune a riscos. Em caso de incidente de segurança que possa
          causar risco ou dano relevante, comunicaremos a ANPD e os titulares afetados, conforme
          a LGPD.
        </p>
      </section>

      <section>
        <h2>11. Backups e restauração</h2>
        <p>
          O plano atual do Supabase não inclui backups automáticos, e o Controle-App não mantém cópias próprias dos dados. Por isso, dados excluídos conforme a seção 7 não ficam guardados em cópias criadas por nós. Em caso de falha grave do serviço, a recuperação dos dados pode não ser possível.
        </p>
      </section>

      <section>
        <h2>12. Alterações, versão e vigência</h2>
        <p>
          {published
            ? `Esta é a versão ${release!.version}, em vigor desde ${publishedDate}.`
            : 'Quando uma nova versão for publicada, usuários autenticados serão avisados no aplicativo. Esta minuta é a versão 1.1.0 e não está vigente. A data de vigência será informada quando uma versão for aprovada e publicada.'}
        </p>
      </section>
    </div>
  )
}
