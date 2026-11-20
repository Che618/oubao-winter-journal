import { useState, useSyncExternalStore } from 'react';
import { readSaved, saveLocal } from './storage';

const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (changed: () => void) => {
  preference.addEventListener('change', changed);
  return () => preference.removeEventListener('change', changed);
};

/** 系统偏好即时生效，用户也可以单独关掉装饰动效。 */
export function useMotionSettings() {
  const reduced = useSyncExternalStore(subscribe, () => preference.matches);
  const [requested, setRequested] = useState(() => readSaved('motion', true));
  return {
    enabled: requested && !reduced,
    reduced,
    toggle: () => {
      const next = !requested;
      setRequested(next);
      saveLocal('motion', next);
    },
  };
}
