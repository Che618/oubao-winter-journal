const prefix = 'oubao-journal:v1:';
export function readSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export interface ReadingPosition {
  chapterId: string;
  pageId: string;
  pageIndex: number;
}
export interface Letter {
  text: string;
  updatedAt: string;
}
