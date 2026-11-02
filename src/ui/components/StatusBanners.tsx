import { expiryInfo } from '../../core/storage'
import { COPY } from '../copy'
import type { PersistNotice } from '../hooks/usePersisted'
import { Banner } from './Banner'

interface Props {
  storageOk: boolean
  consented: boolean
  lastActiveAt: number
  now: () => number
  notice: PersistNotice
  /** 처음 화면인가. 지워졌다/질문이 바뀌었다는 알림은 처음 화면에서만 보여 준다. */
  atStart: boolean
}

export function StatusBanners({ storageOk, consented, lastActiveAt, now, notice, atStart }: Props) {
  const info = expiryInfo(lastActiveAt, now())
  const expiring = consented && !info.expired && info.hoursLeft < 24
  return (
    <>
      {!storageOk && (
        <Banner id="banner-nostore" tone="warn">
          {COPY.banners.nostore}
        </Banner>
      )}
      {expiring && (
        <Banner id="banner-expiring" tone="warn">
          {COPY.banners.expiring(info.hoursLeft)}
        </Banner>
      )}
      {atStart && notice === 'expired' && <Banner id="banner-expired">{COPY.banners.expired}</Banner>}
      {atStart && notice === 'incompatible' && <Banner id="banner-bankchanged">{COPY.banners.bankChanged}</Banner>}
    </>
  )
}
