import type { ReactNode } from 'react'

export function Banner({ id, tone = 'info', children }: { id: string; tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`banner banner-${tone}`} role="status" data-testid={id}>
      {children}
    </div>
  )
}
