type PageGuideProps = {
  purpose: string
  doNext: string
  result: string
  roleNote?: string
}

export function PageGuide({ purpose, doNext, result, roleNote }: PageGuideProps) {
  return (
    <aside className="page-guide" aria-label="Como usar esta página">
      <div><span>Para quê</span><p>{purpose}</p></div>
      <div><span>Próximo passo</span><p>{doNext}</p></div>
      <div><span>Resultado</span><p>{result}</p></div>
      {roleNote && <p className="page-guide-role"><strong>Seu acesso:</strong> {roleNote}</p>}
    </aside>
  )
}
