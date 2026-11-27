import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { Maximize2, RotateCcw, X } from 'lucide-react';
import type { MigrationMapConfig } from '../content/types';

type Point = { x: number; y: number };
const width = 2480,
  height = 3508;
const bounded = (point: Point): Point => ({
  x: Math.max(80, Math.min(width - 80, point.x)),
  y: Math.max(650, Math.min(height - 180, point.y)),
});

export function MigrationMap({ config }: { config: MigrationMapConfig }) {
  const board = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: string; pointer: number; start: Point; origin: Point } | null>(null);
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [gull, setGull] = useState<Point>({ x: 1205, y: 1000 });
  const [active, setActive] = useState(config.stops[0].id);
  const [expanded, setExpanded] = useState(false);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    // 从放大视图返回时，重新挂载的纸页图层也要立即显示。
    if (expanded || board.current?.closest('.book-page')?.getAttribute('aria-hidden') === 'false') {
      board.current?.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((image) => {
        image.src = image.dataset.src!;
      });
    }
  }, [expanded]);
  const stop = config.stops.find((item) => item.id === active)!;
  const coordinates = (event: PointerEvent): Point => {
    const rect = board.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  };
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
      setMoved(true);
    }
  }
  function begin(event: PointerEvent<HTMLButtonElement>, id: string, origin: Point) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointer: event.pointerId, start: coordinates(event), origin };
    if (id !== 'gull') setActive(id);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointer) return;
    const point = coordinates(event),
      { id, start, origin } = drag.current;
    apply(id, { x: origin.x + point.x - start.x, y: origin.y + point.y - start.y });
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
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
    apply(id, { x: point.x + delta.x, y: point.y + delta.y });
  }
  const position = (point: Point): CSSProperties => ({
    left: `${(point.x / width) * 100}%`,
    top: `${(point.y / height) * 100}%`,
  });
  const map = (
    <div className="migration-board" ref={board} data-no-flip aria-label="可拖动的红嘴鸥迁徙地图">
      <img
        className="migration-base"
        data-src={config.base}
        src={expanded ? config.base : undefined}
        alt="红嘴鸥越冬迁徙路线手绘地图：西伯利亚至汉中汉江，路线与日期按提供素材展示，非精确地理地图"
        draggable={false}
      />
      <img
        className="migration-route"
        data-src={config.route}
        src={expanded ? config.route : undefined}
        alt=""
        draggable={false}
      />
      <img
        className="migration-mascot"
        data-src={config.mascot}
        src={expanded ? config.mascot : undefined}
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
                '--marker-size': `${(item.markerWidth / width) * 100}cqw`,
              } as CSSProperties
            }
            aria-label={`拖动地点：${item.label}`}
            aria-pressed={active === item.id}
            onPointerDown={(e) => begin(e, item.id, point)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => key(e, item.id, point)}
            onClick={() => setActive(item.id)}
          >
            <img
              data-src={item.marker}
              src={expanded ? item.marker : undefined}
              alt=""
              draggable={false}
            />
          </button>
        );
      })}
      <button
        className="migration-gull"
        style={position(gull)}
        aria-label="拖动海鸥探索迁徙路线"
        onPointerDown={(e) => begin(e, 'gull', gull)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={(e) => key(e, 'gull', gull)}
      >
        <img
          data-src={config.cursor}
          src={expanded ? config.cursor : undefined}
          alt=""
          draggable={false}
        />
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
        <p className="migration-guide">拖动海鸥或地点，看看来时的路</p>
        <div className="migration-fit">{!expanded && map}</div>
        {details}
        <div className="migration-tools">
          <button
            onClick={() => {
              setExpanded(true);
              dialog.current?.showModal();
            }}
          >
            <Maximize2 size={13} />
            放大操作
          </button>
          <button
            onClick={() => {
              setPoints({});
              setGull({ x: 1205, y: 1000 });
              setActive(config.stops[0].id);
              setMoved(false);
            }}
          >
            <RotateCcw size={13} />
            还原位置
          </button>
        </div>
        <p className="migration-note">
          {moved
            ? '地点已临时移动，可还原；不改变原图地理信息。'
            : '路线示意，非精确地理地图 · 时间沿用素材标注'}
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
