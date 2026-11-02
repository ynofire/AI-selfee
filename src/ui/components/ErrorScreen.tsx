import { COPY } from '../copy'

export function ErrorScreen({ message }: { message: string }) {
  return (
    <section className="card" role="alert" data-testid="error-screen">
      <h1>{COPY.errors.title}</h1>
      <p>{message}</p>
      <a href="/">{COPY.errors.home}</a>
    </section>
  )
}
