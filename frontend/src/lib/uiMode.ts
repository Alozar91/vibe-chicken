/** Две версии интерфейса (§6 задачи «мобильная версия»):
 *  auto — по ширине экрана (<768px → мобильная), desktop/mobile — ручной выбор,
 *  запоминается в localStorage. Переключатели: в мобильном разделе «Ещё»
 *  и в шапке ПК-версии. */

import { useEffect, useState } from 'react'

export type UiMode = 'auto' | 'desktop' | 'mobile'

const KEY = 'chicken-ui-mode'
const MQ = '(max-width: 767px)'

export function getUiMode(): UiMode {
  const v = localStorage.getItem(KEY)
  return v === 'desktop' || v === 'mobile' ? v : 'auto'
}

export function setUiMode(mode: UiMode): void {
  localStorage.setItem(KEY, mode)
  window.dispatchEvent(new Event('ui-mode-changed'))
}

/** Эффективный режим: auto → по media-запросу, иначе — выбранный вручную. */
export function useUiMode(): { mode: UiMode; isMobile: boolean; setMode: (m: UiMode) => void } {
  const [mode, setModeState] = useState<UiMode>(getUiMode)
  const [narrow, setNarrow] = useState(() => window.matchMedia(MQ).matches)

  useEffect(() => {
    const onModeChange = () => setModeState(getUiMode())
    window.addEventListener('ui-mode-changed', onModeChange)
    const mql = window.matchMedia(MQ)
    const onMq = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mql.addEventListener('change', onMq)
    return () => {
      window.removeEventListener('ui-mode-changed', onModeChange)
      mql.removeEventListener('change', onMq)
    }
  }, [])

  return {
    mode,
    isMobile: mode === 'mobile' ? true : mode === 'desktop' ? false : narrow,
    setMode: setUiMode,
  }
}
