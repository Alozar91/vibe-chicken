/** Выбор версии интерфейса по режиму (см. lib/uiMode.ts).
 *  Каждый маршрут задаёт desktop-компонент и, при наличии, мобильную версию. */

import type { ReactNode } from 'react'
import { useUiMode } from '../lib/uiMode'

export default function Responsive({ desktop, mobile }: { desktop: ReactNode; mobile?: ReactNode }) {
  const { isMobile } = useUiMode()
  return <>{isMobile && mobile ? mobile : desktop}</>
}
