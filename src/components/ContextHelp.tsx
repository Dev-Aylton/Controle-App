type ContextHelpProps = {
  title: string
  description: string
  steps?: string[]
  result?: string
}

export function ContextHelp({ title, description, steps = [], result }: ContextHelpProps) {
  return (
    <aside className="context-help" aria-label={title}>
      <div className="context-help-heading">
        <span aria-hidden="true">i</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
      {steps.length > 0 && (
        <ol>
          {steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
      {result && <p className="context-help-result"><strong>Resultado esperado:</strong> {result}</p>}
    </aside>
  )
}
