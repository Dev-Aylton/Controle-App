type Props = {
  headingId?: string
}

function OwnerTodo({ children }: { children: string }) {
  // <!-- TODO: responsável, confirmar antes de aprovar e publicar a política. -->
  return (
    <p className="privacy-policy-todo">
      <strong>NÃO CONFIRMADO — TODO do responsável:</strong> {children}
    </p>
  )
}

export function PrivacyPolicyContent({ headingId }: Props) {
  return (
    <div className="privacy-policy-content">
      <p className="privacy-policy-draft" role="status">
        Minuta para revisão — esta versão não foi publicada e não está vigente.
      </p>
      <p className="eyebrow">Privacidade e proteção de dados</p>
      <h1 id={headingId}>Aviso de Privacidade do Controle-App</h1>
      <p className="privacy-policy-version">
        Versão 1.0.0 · Data de vigência: não vigente (minuta)
      </p>

      <section>
        <h2>1. Papéis e controladores</h2>
        <p>
          Aylton Alberto é o controlador dos dados de conta e login, como e-mail, nome,
          identificadores de autenticação, sessão e foto de perfil. Em relação aos dados
          operacionais de uma empresa — incluindo produtos, estoque, movimentações, equipe,
          vendas importadas e auditoria da empresa —, a própria empresa é a controladora.
          O Controle-App atua como operador desses dados conforme as instruções da empresa.
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
        <h2>2. Público</h2>
        <p>
          O Controle-App destina-se exclusivamente a pessoas maiores de 18 anos.
        </p>
        <OwnerTodo>
          método de verificação da idade e procedimento para eventual identificação de pessoa
          menor de 18 anos.
        </OwnerTodo>
      </section>

      <section>
        <h2>3. Dados tratados e finalidades</h2>
        <ul>
          <li>
            <strong>Conta e login:</strong> e-mail, nome, identificadores da conta, identidade
            do provedor, sessão e, se fornecida pelo provedor de login, telefone e foto de
            perfil. São usados para autenticar e manter a conta.
          </li>
          <li>
            <strong>Operação da empresa:</strong> vínculos, cargos, produtos, custos, estoque,
            movimentações, inventários, equipe, vendas importadas, observações e auditoria.
            A empresa controladora define as finalidades; o Controle-App trata esses dados
            para disponibilizar e operar as funcionalidades contratadas.
          </li>
          <li>
            <strong>Suporte e segurança:</strong> registros de ações e informações técnicas
            disponíveis no aplicativo podem ser usados para diagnosticar falhas, proteger
            contas e investigar incidentes.
          </li>
          <li>
            <strong>Foto de perfil:</strong> imagem enviada ou fornecida pelo provedor de login.
            O consentimento para a foto enviada pelo usuário é uma base legal proposta, sujeita
            à revisão jurídica.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Acesso de suporte</h2>
        <p>
          O administrador do aplicativo pode acessar e alterar dados de qualquer empresa para
          prestar suporte. As ações realizadas nesse modo ficam registradas na auditoria com
          a marca “suporte”, visível ao proprietário da empresa.
        </p>
      </section>

      <section>
        <h2>5. Dados armazenados no aparelho</h2>
        <ul>
          <li>
            <strong>Fila e catálogo offline:</strong> armazenados no IndexedDB do navegador,
            associados à conta que os criou.
            A fila pode incluir empresa, produto e ambiente, tipo e quantidade da movimentação,
            observação, data, estado de sincronização e mensagem de erro.
          </li>
          <li>
            <strong>Preferências:</strong> tema, empresa ativa e conclusão do tutorial ficam no
            localStorage. Ao sair ou solicitar exclusão, apenas a preferência de tema é mantida.
          </li>
          <li>
            <strong>Cache do aplicativo:</strong> arquivos estáticos do PWA podem permanecer no
            Cache Storage para permitir que o aplicativo abra offline; caches não estáticos são
            removidos ao sair ou solicitar exclusão.
          </li>
          <li>
            <strong>Sessão:</strong> a sessão de autenticação é mantida localmente pelo cliente
            Supabase e removida deste aparelho quando você sai da conta.
          </li>
          <li>
            <strong>Aviso dispensado:</strong> enquanto a sessão estiver ativa, o estado de
            “ler depois” do aviso de privacidade pode ser mantido no sessionStorage e é limpo ao
            sair da conta.
          </li>
        </ul>
        <p>
          Ao sair, o aplicativo remove do aparelho os dados offline da sua conta, as preferências
          locais que não sejam o tema, a sessão e caches não estáticos. O tema e os arquivos
          estáticos necessários para abrir o PWA são mantidos. Se houver lançamentos pendentes,
          você poderá aguardar, tentar enviá-los ou confirmar o descarte antes de sair. Registros
          antigos sem conta identificada não são exibidos nem enviados e exigem confirmação para
          descarte. A solicitação de exclusão também remove os dados locais após a confirmação
          digitada. Ao remover uma foto enviada ao aplicativo, o arquivo é apagado do Storage;
          as referências do perfil e a URL de imagem do provedor nos metadados de autenticação
          também são limpas. Imagens já mantidas no cache HTTP normal do navegador podem exigir
          a limpeza de dados do site nas configurações do próprio navegador.
        </p>
        <OwnerTodo>
          o relatório técnico não confirmou cookies criados diretamente pelo aplicativo; o uso
          de cookies ou rastreadores por serviços de terceiros também não está confirmado.
        </OwnerTodo>
      </section>

      <section>
        <h2>6. Compartilhamento e transferências internacionais</h2>
        <ul>
          <li>
            <strong>Supabase:</strong> fornece banco de dados, autenticação e armazenamento.
            A região informada é São Paulo, Brasil (sa-east-1).
          </li>
          <li>
            <strong>Google:</strong> recebe dados necessários à autenticação somente se você
            escolher entrar com Google; o provedor pode tratar dados fora do Brasil.
          </li>
          <li>
            <strong>GitHub Pages:</strong> hospeda os arquivos do aplicativo e recebe as
            requisições para carregá-lo, que podem incluir endereço IP e dados técnicos. O
            serviço pode tratar dados fora do Brasil.
          </li>
        </ul>
        <p>
          O uso de Google ou GitHub pode envolver transferência internacional de dados. A região
          exata de tratamento, os registros coletados e seus prazos de retenção não estão
          confirmados. A configuração de produção do Supabase também deve ser reconfirmada antes
          da publicação.
        </p>
        <OwnerTodo>
          confirmar os operadores e serviços envolvidos, países de tratamento, dados registrados
          por GitHub Pages e Google e respectivos prazos de retenção.
        </OwnerTodo>
      </section>

      <section>
        <h2>7. Retenção e pedido de exclusão</h2>
        <p>
          Ao solicitar a exclusão, o acesso é encerrado e os vínculos com empresas são
          desativados. Durante 90 dias, você pode entrar novamente e cancelar o pedido para
          reativar a conta. Nesse período, os dados necessários à reativação e a foto de perfil
          permanecem armazenados.
        </p>
        <p>
          Após o prazo, o processo automático remove identificadores de autenticação e a foto
          de perfil e substitui o nome do perfil por “Conta excluída”. Registros operacionais
          e de auditoria podem ser preservados para continuidade e rastreabilidade. Referências
          internas pseudonimizadas podem permanecer e não significam anonimização completa.
        </p>
        <OwnerTodo>
          prazos adicionais de conservação legal ou comercial e o tratamento de dados pessoais
          que possam estar em campos livres de auditoria ainda dependem de validação jurídica.
        </OwnerTodo>
      </section>

      <section>
        <h2>8. Seus direitos e como exercê-los</h2>
        <p>
          Você pode exercer os direitos previstos na LGPD pelos recursos do aplicativo quando
          disponíveis ou pelo canal de privacidade indicado neste aviso. As solicitações serão
          atendidas nos termos da lei. Para dados operacionais, a empresa é a controladora.
        </p>
        <div className="privacy-policy-table-wrap" tabIndex={0} role="region" aria-label="Tabela de direitos e formas de solicitação">
          <table className="privacy-policy-table">
            <thead>
              <tr><th scope="col">Direito</th><th scope="col">Como solicitar</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Confirmação e acesso</th><td>Baixe os dados pessoais em Minha conta ou solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Correção</th><td>Edite nome e foto em Meu perfil; para outros dados, use o canal de privacidade.</td></tr>
              <tr><th scope="row">Anonimização, bloqueio ou eliminação</th><td>Use a opção de exclusão da conta em Minha conta; para outros dados, solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Portabilidade</th><td>Use a exportação disponível no aplicativo ou solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Informação sobre compartilhamento</th><td>Solicite pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Consequências de não consentir</th><td>Sem enviar foto, o perfil pode usar um avatar padrão; a imagem não é necessária às demais funções. A base legal proposta ainda depende de revisão.</td></tr>
              <tr><th scope="row">Revogação do consentimento</th><td>Use Meu perfil para remover a foto enviada ao aplicativo e solicite outras revogações pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Oposição</th><td>Apresente sua solicitação e justificativa pelo canal de privacidade.</td></tr>
              <tr><th scope="row">Revisão de decisões automatizadas</th><td>Solicite informações e revisão pelo canal de privacidade.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Você também pode apresentar petição à Autoridade Nacional de Proteção de Dados
          (ANPD), nos termos da legislação aplicável.
        </p>
        <OwnerTodo>
          confirmar o processo para encaminhar à empresa controladora pedidos referentes aos
          dados operacionais, o prazo interno de resposta e se existem decisões automatizadas
          com efeitos sobre as pessoas titulares.
        </OwnerTodo>
      </section>

      <section>
        <h2>9. Bases legais propostas</h2>
        <p><strong>Proposta sujeita a revisão jurídica — não é uma definição definitiva.</strong></p>
        <div className="privacy-policy-table-wrap" tabIndex={0} role="region" aria-label="Tabela de bases legais propostas">
          <table className="privacy-policy-table">
            <thead>
              <tr><th scope="col">Finalidade</th><th scope="col">Base legal proposta</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Criação da conta, autenticação e uso do serviço</th><td>Execução do serviço/contrato.</td></tr>
              <tr><th scope="row">Tratamento de dados operacionais da empresa para fornecer as funções de gestão</th><td>Execução do serviço/contrato entre a empresa e o Controle-App, sujeita à validação jurídica.</td></tr>
              <tr><th scope="row">Segurança e auditoria</th><td>Legítimo interesse, sujeito à avaliação e revisão jurídica.</td></tr>
              <tr><th scope="row">Foto de perfil enviada pelo usuário</th><td>Consentimento do usuário, sujeito à validação do mecanismo e da forma de revogação.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>10. Segurança e incidentes</h2>
        <p>
          O aplicativo usa políticas de segurança em nível de linha (RLS) para separar dados
          por empresa, controla acessos conforme os cargos, mantém auditoria protegida contra
          alteração e usa conexões HTTPS com Supabase e GitHub Pages. Nenhum sistema é totalmente
          imune a riscos. Incidentes serão tratados e comunicados conforme a legislação aplicável.
        </p>
        <OwnerTodo>
          confirmar procedimento interno de resposta a incidentes e outros controles de segurança
          antes da publicação.
        </OwnerTodo>
      </section>

      <section>
        <h2>11. Backups e restauração</h2>
        <OwnerTodo>
          NÃO CONFIRMADO: verificar no Supabase se há backups, quais dados abrangem, por quanto
          tempo são mantidos e como funciona a restauração.
        </OwnerTodo>
      </section>

      <section>
        <h2>12. Alterações, versão e vigência</h2>
        <p>
          Quando uma nova versão for publicada, usuários autenticados serão avisados no
          aplicativo. Esta minuta é a versão 1.0.0 e não está vigente. A data de vigência será
          informada quando uma versão for aprovada e publicada.
        </p>
      </section>
    </div>
  )
}
