import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bird,
  Check,
  ChevronRight,
  Feather,
  MapPin,
  Play,
  Send,
  Heart,
  Compass,
  Image as ImageIcon,
} from 'lucide-react';
import { chapters, getChapter } from '../content/chapters';
import {
  asset,
  type BookPage,
  type ChapterContent,
  type ChapterSummary,
  type ContentBlock,
  type ActivityConfig,
} from '../content/types';
import { readSaved, saveLocal, type Letter } from '../book/storage';

export interface PageViewProps {
  page: BookPage;
  index: number;
  total: number;
  chapter: ChapterContent;
  summary: ChapterSummary;
  next: () => void;
  selectChapter: (id: string) => void;
  notify: (text: string) => void;
  openImage: (src: string, alt: string) => void;
}

function LazyImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return <img data-src={src} alt={alt} className={className} decoding="async" />;
}

function ScrollHint() {
  const hint = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const inner = hint.current?.closest('.book-page')?.querySelector<HTMLElement>('.page-inner');
    if (!inner) return;
    const update = () => setVisible(inner.scrollHeight - inner.clientHeight - inner.scrollTop > 14);
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    inner.addEventListener('scroll', update, { passive: true });
    const frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      inner.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <button
      className={`scroll-hint ${visible ? 'visible' : ''}`}
      ref={hint}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={() => {
        const inner = hint.current?.closest('.book-page')?.querySelector('.page-inner');
        inner?.scrollBy({
          top: inner.clientHeight * 0.65,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        });
      }}
    >
      上滑，继续读
      <ChevronRight size={11} />
    </button>
  );
}

function Paragraphs({
  blocks,
  openImage,
}: {
  blocks: ContentBlock[];
  openImage: PageViewProps['openImage'];
}) {
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        if (block.type === 'paragraph')
          return (
            <p key={i} data-source-paragraph>
              {block.text}
            </p>
          );
        if (block.type === 'subheading') return <h3 key={i}>{block.text}</h3>;
        return (
          <figure className="reader-figure" key={i}>
            <button
              className="photo-button"
              aria-label={`放大照片：${block.alt}`}
              onClick={() => openImage(block.src, block.alt)}
            >
              <LazyImage src={block.src} alt={block.alt} />
            </button>
            {block.caption && <figcaption>{block.caption}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}

function LetterPage({
  chapter,
  selectChapter,
  notify,
}: Pick<PageViewProps, 'chapter' | 'selectChapter' | 'notify'>) {
  const saved = readSaved<Letter | null>(`letter:${chapter.id}`, null);
  const [text, setText] = useState(saved?.text ?? '');
  const [stored, setStored] = useState(!!saved);
  const [saveCount, setSaveCount] = useState(0);
  const next = chapter.ending.nextChapterId ? getChapter(chapter.ending.nextChapterId) : undefined;
  function store() {
    if (!text.trim()) {
      notify('先给鸥宝写一句话吧。');
      return;
    }
    if (
      saveLocal(`letter:${chapter.id}`, { text: text.trim(), updatedAt: new Date().toISOString() })
    ) {
      setStored(true);
      setSaveCount((value) => value + 1);
      notify('回信已收进这台设备的日记本。');
    } else notify('当前浏览器无法保存，请先复制你的回信。');
  }
  return (
    <div className="page-inner letter-inner">
      <div className="eyebrow">
        <Feather size={13} /> 江边悄悄话
      </div>
      <h2>
        想对鸥宝
        <br />
        说点什么？
      </h2>
      <p className="soft-copy">
        读完这页日记，
        <br />
        也留下一点你的冬日心情吧。
      </p>
      <label className="sr-only" htmlFor={`letter-${chapter.id}`}>
        给鸥宝的回信
      </label>
      <textarea
        id={`letter-${chapter.id}`}
        value={text}
        maxLength={300}
        placeholder="亲爱的鸥宝，……"
        onChange={(e) => {
          setText(e.target.value);
          setStored(false);
        }}
      />
      <div className="letter-counter">{text.length} / 300</div>
      <div className="letter-save">
        <button className="ink-button" onClick={store}>
          {stored ? <Check size={15} /> : <Send size={15} />}{' '}
          {stored ? '回信已珍藏' : '把回信收进日记'}
        </button>
        {saveCount > 0 && (
          <span className="letter-seal" aria-hidden="true" key={saveCount}>
            <img src={asset('footprint.webp')} alt="" />
            鸥宝收好啦
          </span>
        )}
      </div>
      <p className="local-note">仅保存在当前设备，不会公开发布。</p>
      <div className="next-chapter-note">
        <span className="eyebrow">把下一页，留给下一次相遇</span>
        <p>“{chapter.ending.text}”</p>
        {next && (
          <button
            onClick={() =>
              next.status === 'published'
                ? selectChapter(next.id)
                : notify(`下一章「${next.title}」，正在写给你的路上。`)
            }
          >
            下一章 · {next.title}
            <ArrowRight size={15} />{' '}
            <small>{next.status === 'published' ? '继续阅读' : '待更新'}</small>
          </button>
        )}
      </div>
    </div>
  );
}

function Activity({ activity }: { activity: ActivityConfig }) {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <div className="page-inner activity-inner">
      <div className="eyebrow">和鸥宝一起发现</div>
      <h2>{activity.title}</h2>
      {activity.type === 'quiz' ? (
        <>
          <p className="soft-copy">{activity.question}</p>
          <div className="quiz-options">
            {activity.options.map((option, i) => (
              <button
                className={answer === i ? 'selected' : ''}
                key={option}
                onClick={() => setAnswer(i)}
              >
                {option}
                {answer === i && <Check size={16} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <p className="quiz-feedback" role="status">
              {answer === activity.correctIndex ? '答对啦！' : '再认识一下鸥宝吧。'}
              {activity.explanation}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="soft-copy">{activity.description}</p>
          <a className="ink-button" href={activity.href} target="_blank" rel="noreferrer">
            {activity.label}
            <ArrowUpRight size={15} />
          </a>
        </>
      )}
    </div>
  );
}

export function PageView(props: PageViewProps) {
  const { page, chapter, summary, next, selectChapter, notify, openImage, index, total } = props;
  let content;
  switch (page.kind) {
    case 'cover':
      content = (
        <div className="page-inner cover-inner">
          <div className="cover-edition">
            <span>汉中 · 冬日来信</span>
            <span>2026 WINTER</span>
          </div>
          <div className="cover-topline">
            <span />
            一江温暖，一冬相伴
            <span />
          </div>
          <h1>
            鸥宝<span>越冬志</span>
          </h1>
          <div className="cover-english">A LITTLE GULL’S WINTER JOURNAL</div>
          <div className="family-portrait">
            <div className="portrait-wash" />
            <img
              src={asset('family.webp')}
              alt="穿着背带裤的鸥宝，和戴相机的爸爸、围粉色围巾的妈妈"
              fetchPriority="high"
            />
          </div>
          <p className="cover-poem">
            从遥远的西伯利亚，
            <br />
            飞进汉江的冬天，也飞进你的心里。
          </p>
          <button className="open-book" onClick={next}>
            翻开我们的故事
            <ArrowRight size={17} />
          </button>
          <div className="cover-bottom">
            <span className="brand-stamp">
              汉中
              <br />
              融媒
            </span>
            <span>八期连载 · 一场山水间的约定</span>
            <img src={asset('footprint.webp')} alt="" />
          </div>
        </div>
      );
      break;
    case 'contents':
      content = (
        <div className="page-inner contents-inner">
          <div className="eyebrow">CONTENTS · 越冬手记</div>
          <h2>
            把冬天，
            <br />
            一页页收藏。
          </h2>
          <div className="toc-list">
            {chapters.map((item) => (
              <button
                key={item.id}
                className={`toc-row ${item.id === summary.id ? 'current' : ''}`}
                disabled={item.status !== 'published'}
                onClick={() => (item.id === summary.id ? next() : selectChapter(item.id))}
              >
                <span className="toc-number">{String(item.number).padStart(2, '0')}</span>
                <span className="toc-text">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                {item.status === 'published' ? (
                  <span className="toc-read">
                    翻开
                    <ArrowUpRight size={13} />
                  </span>
                ) : (
                  <span className="toc-upcoming">待更新</span>
                )}
              </button>
            ))}
          </div>
          <p className="toc-footnote">
            <Feather size={13} /> 故事还在继续，冬天慢慢读。
          </p>
        </div>
      );
      break;
    case 'intro':
      content = (
        <div className="page-inner intro-inner">
          <div className="eyebrow">
            第
            {['一', '二', '三', '四', '五', '六', '七', '八'][summary.number - 1] ?? summary.number}
            章 · {summary.title}
          </div>
          {chapter.opening.greeting && (
            <span className="intro-handwriting">{chapter.opening.greeting}</span>
          )}
          <h2>{chapter.opening.title}</h2>
          <div className="intro-composition">
            <LazyImage src={chapter.opening.illustration} alt={chapter.opening.illustrationAlt} />
            {chapter.opening.annotation && (
              <span className="age-note">
                <Heart size={13} /> {chapter.opening.annotation}
              </span>
            )}
          </div>
          <div className="intro-copy">
            {chapter.opening.paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
          <img className="intro-footprint" src={asset('footprint.webp')} alt="" />
        </div>
      );
      break;
    case 'flow':
      content = (
        <div
          className={`page-inner flow-inner ${page.section === 'diary' ? 'diary-flow' : 'article-flow'}`}
        >
          <div className="eyebrow">
            {page.section === 'diary'
              ? `${chapter.diary.date} · ${chapter.diary.weekday} · ${chapter.diary.weather}`
              : '江边剪报 · 汉中的冬天'}
          </div>
          {page.title && <h2 className="flow-title">{page.title}</h2>}
          {page.subtitle && <p className="flow-subtitle">{page.subtitle}</p>}
          {page.author && <p className="flow-author">{page.author}</p>}
          <Paragraphs blocks={page.blocks} openImage={openImage} />
        </div>
      );
      break;
    case 'video':
      content = (
        <div className="page-inner video-inner">
          <div className="eyebrow">
            <Play size={12} /> 一段会动的日记
          </div>
          <h2>{chapter.video.title}</h2>
          <p className="soft-copy">
            风从翅膀下经过，
            <br />
            我的故事，也有了声音。
          </p>
          <div className="video-frame">
            <div className="paper-tape" />
            {chapter.video.src ? (
              <video
                controls
                playsInline
                preload="none"
                poster={chapter.video.poster}
                src={chapter.video.src}
                aria-label={chapter.video.title}
              />
            ) : (
              <div className="video-pending">
                <LazyImage src={chapter.video.poster} alt="飞翔在汉江上的红嘴鸥" />
                <span className="video-symbol">
                  <Bird size={28} />
                </span>
                <span className="pending-label">影像日记 · 即将更新</span>
              </div>
            )}
            <div className="video-caption">
              <span>VOL. {String(summary.number).padStart(2, '0')}</span>
              <span>鸥宝的冬日影像</span>
            </div>
          </div>
          <p className="video-note">{chapter.video.caption}</p>
          {chapter.video.aiGenerated && (
            <p className="ai-disclosure">本视频包含 AI 生成或 AI 辅助内容。</p>
          )}
          {!chapter.video.src && (
            <p className="pending-copy">
              这段旅程还在剪辑中，
              <br />
              先翻一页，读读汉江边的故事吧。
            </p>
          )}
          <div className="handwritten-note">
            下一页，是被镜头记录的真实相逢。
            <ArrowRight size={17} />
          </div>
        </div>
      );
      break;
    case 'journey':
      content = (
        <div className="page-inner journey-inner">
          <div className="eyebrow">
            <Compass size={13} /> 跟着鸥宝，看看来时的路
          </div>
          <h2>{chapter.journey!.title}</h2>
          <p className="soft-copy">{chapter.journey!.description}</p>
          <div className="journey-illustration">
            <svg className="journey-path" viewBox="0 0 300 250" fill="none" aria-hidden="true">
              <path
                d="M205 22C55 38 265 110 120 130S40 210 100 230"
                stroke="#bd8c6b"
                strokeWidth="1.6"
                strokeDasharray="4 7"
              />
              <path d="m165 87 13-12 2 10 11 2-14 12-2-9Z" fill="#58877a" />
            </svg>
            {chapter.journey!.stops.map((stop, i) => (
              <button
                className={`journey-stop stop-${i}`}
                key={stop.label}
                onClick={() => notify(`${stop.label}，${stop.note}。`)}
              >
                <MapPin size={19} />
                <strong>{stop.label}</strong>
                <span>{stop.note}</span>
              </button>
            ))}
            <LazyImage
              src={asset('oubao.webp')}
              alt="跟随族群远行的鸥宝"
              className="journey-gull"
            />
          </div>
          <p className="route-note">起终点示意 · 不代表实际迁徙轨迹</p>
          <button className="text-link" onClick={next}>
            再看看，我落脚的那条江
            <ArrowRight size={15} />
          </button>
        </div>
      );
      break;
    case 'aerial':
      content = (
        <div className="page-inner aerial-inner">
          <div className="eyebrow">
            <ImageIcon size={13} /> 鸥宝眼里的汉江
          </div>
          <h2>
            落脚的地方，
            <br />
            原来这么美。
          </h2>
          <figure className="aerial-photo">
            <button
              className="photo-button"
              aria-label="放大汉江鸟瞰照片"
              onClick={() => openImage(chapter.journey!.aerial.src, chapter.journey!.aerial.alt)}
            >
              <LazyImage src={chapter.journey!.aerial.src} alt={chapter.journey!.aerial.alt} />
            </button>
            <figcaption>天汉湿地公园 · 汉江岸边</figcaption>
          </figure>
          <p className="soft-copy">
            江水亮亮的，岸边绿绿的。
            <br />
            这里，是我们冬天的家。
          </p>
          {chapter.journey!.aerial.panoramaUrl ? (
            <a
              className="ink-button"
              href={chapter.journey!.aerial.panoramaUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开360°鸟瞰
              <ArrowUpRight size={15} />
            </a>
          ) : (
            <p className="panorama-note">
              先收下一张空中的风景。
              <br />
              <span>360°鸟瞰体验，待更新。</span>
            </p>
          )}
        </div>
      );
      break;
    case 'letter':
      content = <LetterPage {...props} />;
      break;
    case 'activity':
      content = <Activity activity={page.activity} />;
      break;
  }
  return (
    <>
      {content}
      {page.kind !== 'cover' && page.kind !== 'flow' && <ScrollHint />}
      {page.kind !== 'cover' && (
        <div className="page-footer">
          <span>鸥宝越冬志 · {summary.title}</span>
          <span>
            {String(index).padStart(2, '0')}
            <i />
            {String(total - 1).padStart(2, '0')}
          </span>
        </div>
      )}
      {index < total - 1 && page.kind !== 'cover' && (
        <div className="page-corner" aria-hidden="true">
          <ChevronRight size={13} />
        </div>
      )}
    </>
  );
}
