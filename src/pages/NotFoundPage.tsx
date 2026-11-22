import { Container, Card } from '../components'
import { NavLink } from 'react-router-dom'

export function NotFoundPage() {
  return <Container><h1>Página não encontrada</h1><Card><p>Esse endereço não faz parte do Controle-App.</p><NavLink to="/">Voltar ao início</NavLink></Card></Container>
}
