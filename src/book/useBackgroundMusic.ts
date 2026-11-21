import { useCallback, useEffect, useRef, useState } from 'react';
import { readSaved, saveLocal } from './storage';

/** 一个全书共用的音轨，切章或重新分页不重建；只在读者手势后开始加载。 */
export function useBackgroundMusic(notify: (text: string) => void) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const requested = useRef(readSaved('music', true));
  const activated = useRef(false);
  const pending = useRef(false);
  const attempt = useRef(0);
  const [enabled, setEnabled] = useState(requested.current);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const allowed = useCallback(
    () =>
      requested.current &&
      activated.current &&
      !document.hidden &&
      !Array.from(document.querySelectorAll('video')).some(
        (video) => !video.paused && !video.ended,
      ),
    [],
  );

  const sync = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!allowed()) {
      attempt.current++;
      pending.current = false;
      audio.pause();
      return;
    }
    if (!audio.paused || pending.current) return;
    if (audio.error) audio.load();
    audio.volume = 0.2;
    pending.current = true;
    const current = ++attempt.current;
    void audio
      .play()
      .catch((error: unknown) => {
        if (attempt.current !== current || !allowed()) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setBlocked(true);
        notifyRef.current('音乐暂时未能播放，可以点击右上角音乐按钮重试。');
      })
      .finally(() => {
        if (attempt.current === current) pending.current = false;
      });
  }, [allowed]);

  const startReading = useCallback(() => {
    activated.current = true;
    // 在点击/滑动的同一个事件中调用 play，兼容手机浏览器的声音策略。
    sync();
  }, [sync]);

  const toggle = useCallback(() => {
    // 被浏览器阻止或资源失败时，按钮用于重试，不必先关再开。
    const next = blocked ? true : !requested.current;
    requested.current = next;
    activated.current = true;
    setEnabled(next);
    setBlocked(false);
    saveLocal('music', next);
    sync();
  }, [blocked, sync]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      if (!allowed()) {
        audio.pause();
        return;
      }
      setPlaying(true);
      setBlocked(false);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      if (activated.current && requested.current) setBlocked(true);
    };
    const onVideo = (event: Event) => {
      if (event.target instanceof HTMLVideoElement) sync();
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    document.addEventListener('play', onVideo, true);
    document.addEventListener('pause', onVideo, true);
    document.addEventListener('ended', onVideo, true);
    document.addEventListener('visibilitychange', sync);
    return () => {
      attempt.current++;
      pending.current = false;
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      document.removeEventListener('play', onVideo, true);
      document.removeEventListener('pause', onVideo, true);
      document.removeEventListener('ended', onVideo, true);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [allowed, sync]);

  return { audioRef, enabled, playing, blocked, startReading, toggle };
}
