import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PageFlip } from '../vendor/page-flip';
import { PageView, type PageViewProps } from '../components/PageView';
import type { BookPage } from '../content/types';

export interface BookHandle {
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
}
interface Props extends Omit<PageViewProps, 'page' | 'index' | 'total' | 'next'> {
  motionEnabled: boolean;
  pages: BookPage[];
  width: number;
  height: number;
  startPage: number;
  onFlip: (index: number) => void;
}

/** 翻书库独占 host 内的 DOM，React 页面挂在独立根上，避免重排时互相移动节点。 */
export const FlipBook = forwardRef<BookHandle, Props>(function FlipBook(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<PageFlip | null>(null);
  const live = useRef(props);
  live.current = props;
  const reducedMotion = !props.motionEnabled;

  const next = () => {
    const book = engine.current;
    if (!book || book.getState() !== 'read') return;
    if (book.getCurrentPageIndex() < live.current.pages.length - 1) book.flipNext('bottom');
  };
  const previous = () => {
    const book = engine.current;
    if (!book || book.getState() !== 'read') return;
    if (book.getCurrentPageIndex() > 0) book.flipPrev('bottom');
  };
  useImperativeHandle(ref, () => ({
    next,
    previous,
    goTo: (index) => {
      const book = engine.current;
      if (book && index >= 0 && index < live.current.pages.length) book.turnToPage(index);
    },
  }));

  useEffect(() => {
    if (!host.current) return;
    const { pages, width, height, startPage } = live.current;
    const container = document.createElement('div');
    container.className = 'flip-engine';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    host.current.append(container);
    const nodes: HTMLElement[] = [],
      roots: Root[] = [];
    pages.forEach((page, index) => {
      const element = document.createElement('article');
      element.className = `book-page page-${page.kind}`;
      element.dataset.pageId = page.id;
      element.dataset.pageKind = page.kind;
      element.setAttribute('aria-label', page.kind === 'cover' ? '日记本封面' : `第${index}页`);
      if (page.kind === 'cover') element.dataset.density = 'hard';
      container.append(element);
      nodes.push(element);
      const root = createRoot(element);
      roots.push(root);
    });
    const book = new PageFlip(container, {
      width,
      height,
      size: 'fixed',
      usePortrait: true,
      autoSize: false,
      showCover: false,
      startPage,
      drawShadow: true,
      maxShadowOpacity: 0.24,
      flippingTime: reducedMotion ? 1 : 720,
      // 手势由下面统一处理，视频、地图、输入框不交给库拦截。
      useMouseEvents: false,
      showPageCorners: true,
      mobileScrollSupport: true,
    });
    let disposed = false;
    let initialized = false;
    function reveal(index: number) {
      nodes.forEach((node, i) => {
        const active = i === index;
        node.inert = !active;
        node.setAttribute('aria-hidden', String(!active));
        // 翻页期间保持内容稳定，翻页结束后才触发装饰与入场效果。
        node.dataset.motionReady = String(active && book.getState() === 'read');
        if (Math.abs(i - index) <= 1)
          node.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
            if (!img.src) img.src = img.dataset.src!;
          });
        if (!active) node.querySelectorAll('video').forEach((video) => video.pause());
      });
      live.current.onFlip(index);
    }
    book.on('flip', (event) => reveal(Number(event.data)));
    book.on('changeState', (event) => {
      nodes.forEach((node, i) => {
        node.dataset.motionReady = String(
          event.data === 'read' && i === book.getCurrentPageIndex(),
        );
      });
    });
    // 在父树生命周期外一次提交所有独立页面，再启动翻页，避免封面已可操作而正文尚未就绪。
    queueMicrotask(() => {
      if (disposed) return;
      flushSync(() =>
        pages.forEach((page, index) => {
          roots[index].render(
            <PageView
              {...live.current}
              page={page}
              index={index}
              total={pages.length}
              next={next}
            />,
          );
        }),
      );
      engine.current = book;
      book.loadFromHTML(nodes);
      initialized = true;
      reveal(startPage);
      container.dataset.ready = 'true';
    });

    let pointer: { x: number; y: number; time: number; folding: boolean } | null = null;
    const point = (e: PointerEvent) => {
      const rect = book.getUI().getDistElement().getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const interactive = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest('button,a,input,textarea,select,video,[data-no-flip]');
    const down = (e: PointerEvent) => {
      if (!initialized || interactive(e.target) || book.getState() !== 'read' || e.button !== 0)
        return;
      const pos = point(e);
      const folding = pos.x > width - 65 && pos.y > height - 100;
      pointer = { x: e.clientX, y: e.clientY, time: Date.now(), folding };
      container.setPointerCapture(e.pointerId);
      if (folding) book.startUserTouch(pos);
    };
    const move = (e: PointerEvent) => {
      if (pointer?.folding) book.userMove(point(e), true);
    };
    const up = (e: PointerEvent) => {
      if (!pointer) return;
      const dx = e.clientX - pointer.x,
        dy = e.clientY - pointer.y;
      if (pointer.folding) book.userStop(point(e));
      else if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? next() : previous();
      pointer = null;
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    };
    const cancel = (e: PointerEvent) => {
      if (pointer?.folding) book.userStop(point(e));
      pointer = null;
    };
    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', cancel);
    return () => {
      disposed = true;
      engine.current = null;
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerup', up);
      container.removeEventListener('pointercancel', cancel);
      // 独立根在父树提交完成后卸载，避免 React 生命周期内嵌套卸载。
      setTimeout(() => {
        roots.forEach((root) => root.unmount());
        if (initialized) book.destroy();
        else container.remove();
      }, 0);
      container.style.display = 'none';
    };
  }, [props.pages, props.width, props.height, reducedMotion]);

  return <div className="book-host" ref={host} />;
});
