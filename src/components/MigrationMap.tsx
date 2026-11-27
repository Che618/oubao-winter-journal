import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { Bird, Maximize2, RotateCcw, X } from 'lucide-react';
import type { MigrationMapConfig } from '../content/types';

type Point = { x: number; y: number };
const width = 2480,
  height = 3508;
const initialGull = { x: 1040, y: 1080 };
const bounded = (point: Point): Point => ({
  x: Math.max(80, Math.min(width - 80, point.x)),
  y: Math.max(650, Math.min(height - 180, point.y)),
});

export function MigrationMap({ config }: { config: MigrationMapConfig }) {
  const board = useRef<HTMLDivElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{
    id: string;
    pointer: number;
    start: Point;
    origin: Point;
    scale: Point;
    target: HTMLButtonElement;
    next: Point;
  } | null>(null);
  const frame = useRef(0);
  const flight = useRef<Animation | null>(null);
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [gull, setGull] = useState<Point>(initialGull);
  const [active, setActive] = useState(config.stops[0].id);
  const [expanded, setExpanded] = useState(false);
  const [flying, setFlying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [boardWidth, setBoardWidth] = useState(0);
  useEffect(() => {
    const area = fit.current;
    const page = area?.closest('.book-page');
    if (!area || !page) return;
    const updateVisibility = () => {
      // 地图自己持有图片加载状态，避免React重绘/放大返回后外部赋值的src丢失。
      if (page.classList.contains('is-preloaded') || page.getAttribute('aria-hidden') === 'false')
        setLoaded(true);
      if (page.getAttribute('aria-hidden') === 'true') flight.current?.cancel();
    };
    const visibility = new MutationObserver(updateVisibility);
    visibility.observe(page, {
      attributes: true,
      attributeFilter: ['class', 'aria-hidden'],
    });
    // 只在真实尺寸改变时测量；翻页库频繁改class时不强制同步布局。
    const resize = new ResizeObserver(([entry]) => {
      const { width: availableWidth, height: availableHeight } = entry.contentRect;
      if (availableWidth && availableHeight)
        setBoardWidth(Math.floor(Math.min(availableWidth, (availableHeight * width) / height)));
    });
    resize.observe(area);
    updateVisibility();
    return () => {
      visibility.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame.current);
      flight.current?.cancel();
    };
  }, []);
  const source = (url: string) =>
    loaded || expanded ? (revision ? `${url}?retry=${revision}` : url) : undefined;
  const stop = config.stops.find((item) => item.id === active)!;
  function apply(id: string, point: Point) {
    const next = bounded(point);
    if (id === 'gull') {
      setGull(next);
      const nearest = config.stops.reduce((a, b) => {
        const p = points[a.id] ?? a,
          q = points[b.id] ?? b;
        return Math.hypot(next.x - p.x, next.y - p.y) < Math.hypot(next.x - q.x, next.y - q.y)
          ? a
          : b;
      });
      setActive(nearest.id);
    } else {
      setPoints((previous) => ({ ...previous, [id]: next }));
      setActive(id);
    }
  }
  function begin(event: PointerEvent<HTMLButtonElement>, id: string, origin: Point) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    flight.current?.cancel();
    const rect = board.current!.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    drag.current = {
      id,
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin,
      scale: { x: rect.width / width, y: rect.height / height },
      target: event.currentTarget,
      next: origin,
    };
    if (id !== 'gull') setActive(id);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointer) return;
    const current = drag.current;
    current.next = bounded({
      x: current.origin.x + (event.clientX - current.start.x) / current.scale.x,
      y: current.origin.y + (event.clientY - current.start.y) / current.scale.y,
    });
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (drag.current !== current) return;
      const dx = (current.next.x - current.origin.x) * current.scale.x;
      const dy = (current.next.y - current.origin.y) * current.scale.y;
      // 拖动期间仅移动当前合成层；结束才提交React状态，避免重绘整张地图。
      current.target.style.transform = `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0)`;
    });
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointer) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    current.target.style.removeProperty('transform');
    delete current.target.dataset.dragging;
    apply(current.id, current.next);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, id: string, point: Point) {
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -40, y: 0 },
      ArrowRight: { x: 40, y: 0 },
      ArrowUp: { x: 0, y: -40 },
      ArrowDown: { x: 0, y: 40 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    flight.current?.cancel();
    apply(id, { x: point.x + delta.x, y: point.y + delta.y });
  }
  const position = (point: Point): CSSProperties => ({
    left: `${(point.x / width) * 100}%`,
    top: `${(point.y / height) * 100}%`,
  });
  function flyRoute() {
    flight.current?.cancel();
    const target = board.current?.querySelector<HTMLButtonElement>('.migration-gull');
    if (!target) return;
    const rect = board.current!.getBoundingClientRect();
    const destination = config.stops.at(-1)!;
    const finish = () => {
      setGull({ x: destination.x - 120, y: destination.y - 65 });
      setActive(destination.id);
      setFlying(false);
      flight.current = null;
    };
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      target.closest('.app-shell')?.getAttribute('data-motion') === 'off'
    ) {
      finish();
      return;
    }
    const route = [gull, ...config.stops.map((point) => ({ x: point.x - 120, y: point.y - 65 }))];
    const animation = target.animate(
      route.map((point) => ({
        transform: `translate(-50%, -50%) translate3d(${((point.x - gull.x) / width) * rect.width}px, ${((point.y - gull.y) / height) * rect.height}px, 0)`,
      })),
      { duration: 10000, easing: 'linear' },
    );
    flight.current = animation;
    setFlying(true);
    animation.onfinish = finish;
    animation.oncancel = () => {
      flight.current = null;
      setFlying(false);
    };
  }
  const map = (
    <div
      className="migration-board"
      ref={board}
      data-no-flip
      aria-label="可拖动的红嘴鸥迁徙地图"
      style={
        expanded
          ? undefined
          : {
              width: boardWidth || '100%',
              height: boardWidth ? (boardWidth * height) / width : undefined,
            }
      }
    >
      <img
        className="migration-base"
        src={source(config.base)}
        width={2480}
        height={3508}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
        alt="红嘴鸥越冬迁徙路线手绘地图：西伯利亚至汉中汉江，路线与日期按提供素材展示，非精确地理地图"
        draggable={false}
      />
      <img className="migration-route" src={source(config.route)} alt="" draggable={false} />
      <img
        className="migration-mascot"
        src={source(config.mascot)}
        alt="飞翔的鸥宝"
        draggable={false}
      />
      {config.stops.map((item) => {
        const point = points[item.id] ?? item;
        return (
          <button
            key={item.id}
            className={`migration-point ${active === item.id ? 'is-active' : ''}`}
            style={
              {
                ...position(point),
                '--marker-size': `${Math.max(7, (item.markerWidth / width) * (expanded ? 540 : boardWidth || 250))}px`,
              } as CSSProperties
            }
            aria-label={`拖动地点：${item.label}`}
            aria-pressed={active === item.id}
            title={`${item.label} · ${item.note}`}
            onPointerDown={(e) => begin(e, item.id, point)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => key(e, item.id, point)}
            onClick={() => setActive(item.id)}
          >
            <img src={source(item.marker)} alt="" draggable={false} />
          </button>
        );
      })}
      <button
        className="migration-gull"
        style={{
          ...position(gull),
          width: Math.max(32, Math.min(80, (expanded ? 540 : boardWidth || 250) * 0.12)),
        }}
        aria-label="拖动海鸥探索迁徙路线"
        title="拖动海鸥探索迁徙路线"
        onPointerDown={(e) => begin(e, 'gull', gull)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={(e) => key(e, 'gull', gull)}
      >
        <img src={source(config.cursor)} alt="" draggable={false} />
      </button>
    </div>
  );
  const details = (
    <p className="migration-detail" role="status">
      <strong>{stop.label}</strong>
      <span>{stop.note}</span>
    </p>
  );
  return (
    <>
      <div className="page-inner migration-inner">
        <h2 className="sr-only">红嘴鸥越冬迁徙路线</h2>
        <div className="migration-fit" ref={fit}>
          {!expanded && map}
        </div>
        {failed && (
          <button
            className="migration-retry"
            onClick={() => {
              setFailed(false);
              setRevision((previous) => previous + 1);
            }}
          >
            地图加载未完成，点击重试
          </button>
        )}
        <div className="migration-tools">
          <button
            aria-label="沿路线飞行"
            title="沿路线飞行"
            aria-pressed={flying}
            onClick={() => (flying ? flight.current?.cancel() : flyRoute())}
          >
            <Bird size={16} />
          </button>
          <button
            aria-label="放大操作"
            title="放大操作"
            onClick={() => {
              flight.current?.cancel();
              setExpanded(true);
              dialog.current?.showModal();
            }}
          >
            <Maximize2 size={15} />
          </button>
          <button
            aria-label="还原位置"
            title="还原位置"
            onClick={() => {
              flight.current?.cancel();
              setPoints({});
              setGull(initialGull);
              setActive(config.stops[0].id);
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <p className="sr-only" role="status">
          {stop.label} · {stop.note}
        </p>
      </div>
      <dialog
        ref={dialog}
        className="migration-dialog"
        aria-label="放大迁徙地图"
        onKeyDown={(event) => event.stopPropagation()}
        onCancel={() => setExpanded(false)}
        onClose={() => setExpanded(false)}
      >
        <div className="migration-dialog-heading">
          <span>拖动海鸥与地点 · 地图可滑动查看</span>
          <button aria-label="关闭放大地图" onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </div>
        <div className="migration-expanded">{expanded && map}</div>
        {details}
      </dialog>
    </>
  );
}
