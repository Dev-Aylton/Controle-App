import { Container, Card } from '../components'

export function OfflinePage() {
  return <Container><h1>Sem conexão</h1><Card><p>Você pode continuar lançando movimentos se estiver usando a fila offline. Quando a conexão voltar, o envio será retomado.</p></Card></Container>
}
