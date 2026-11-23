import { useCallback, useEffect, useRef, useState } from 'react';

/** 全书共享音轨：进入即尝试播放，浏览器拦截时由首次手势解锁。 */
export function useBackgroundMusic(notify: (text: string) => void) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const requested = useRef(true);
  const pending = useRef(false);
  const attempt = useRef(0);
  const [enabled, setEnabled] = useState(requested.current);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const allowed = useCallback(
    () =>
      requested.current &&
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
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setNeedsGesture(true);
          return;
        }
        setBlocked(true);
        notifyRef.current('音乐暂时未能播放，可以点击右上角音乐按钮重试。');
      })
      .finally(() => {
        if (attempt.current === current) pending.current = false;
      });
  }, [allowed]);

  const startReading = useCallback(() => {
    // 在点击/滑动的同一个事件中调用 play，兼容手机浏览器的声音策略。
    sync();
  }, [sync]);

  const toggle = useCallback(() => {
    // 被浏览器阻止或资源失败时，按钮用于重试，不必先关再开。
    const next = blocked || needsGesture ? true : !requested.current;
    requested.current = next;
    setEnabled(next);
    setBlocked(false);
    setNeedsGesture(false);
    sync();
  }, [blocked, needsGesture, sync]);

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
      setNeedsGesture(false);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      if (requested.current) setBlocked(true);
    };
    const onVideo = (event: Event) => {
      if (event.target instanceof HTMLVideoElement) sync();
    };
    const onGesture = (event: Event) => {
      // 音乐按钮自己处理开关，避免捕获阶段的播放请求与点击开关冲突。
      if (event.target instanceof Element && event.target.closest('.music-toggle')) return;
      sync();
    };
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    document.addEventListener('play', onVideo, true);
    document.addEventListener('pause', onVideo, true);
    document.addEventListener('ended', onVideo, true);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('touchend', onGesture, true);
    document.addEventListener('click', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    audio.volume = 0.2;
    // 仍立即尝试播放，以保持浏览器原生的自动播放判定；完整音频由播放请求触发下载。
    sync();
    return () => {
      attempt.current++;
      pending.current = false;
      audio.pause();
      audio.removeEventListener('playing', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      document.removeEventListener('play', onVideo, true);
      document.removeEventListener('pause', onVideo, true);
      document.removeEventListener('ended', onVideo, true);
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('touchend', onGesture, true);
      document.removeEventListener('click', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
    };
  }, [allowed, sync]);

  return { audioRef, enabled, playing, blocked, needsGesture, startReading, toggle };
}
