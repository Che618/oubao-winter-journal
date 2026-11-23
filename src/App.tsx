import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Feather,
  List,
  RotateCcw,
  Sparkles,
  Pause,
  Music2,
  VolumeX,
  X,
} from 'lucide-react';
import { chapters, getChapter, loadChapter } from './content/chapters';
import { asset, type BookPage, type ChapterContent } from './content/types';
import { buildPages } from './book/paginate';
import { readSaved, saveLocal, type ReadingPosition } from './book/storage';
import { FlipBook, type BookHandle } from './book/FlipBook';
import { useMotionSettings } from './book/useMotionSettings';
import { useBackgroundMusic } from './book/useBackgroundMusic';

const pageNames: Record<BookPage['kind'], string> = {
  cover: '封面',
  backCover: '合上日记',
  album: '汉江影像',
  contents: '目录',
  intro: '认识鸥宝',
  flow: '日记',
  video: '影像日记',
  journey: '来时的路',
  aerial: '鸟瞰汉江',
  activity: '和鸥宝一起玩',
  letter: '给鸥宝回信',
};

function getPageName(page: BookPage) {
  return page.kind === 'flow' && page.section === 'article' ? '江边剪报' : pageNames[page.kind];
}

export default function App() {
  const motion = useMotionSettings();
  const [chapterId, setChapterId] = useState(chapters[0].id);
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<BookPage[]>([]);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const [resume, setResume] = useState(() => readSaved<ReadingPosition | null>('position', null));
  const savedPosition = useRef<ReadingPosition | null>(null);
  const book = useRef<BookHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const summary = getChapter(chapterId);
  const menuRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLDialogElement>(null);

  const notify = useCallback((text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const music = useBackgroundMusic(notify);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setContent(null);
    loadChapter(getChapter(chapterId))
      .then((chapter) => {
        if (!cancelled) setContent(chapter);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '日记暂时无法打开。');
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  useLayoutEffect(() => {
    if (!stage.current) return;
    const measure = () => {
      const rect = stage.current!.getBoundingClientRect();
      // 键盘弹出时保持书页尺寸，避免输入过程中重排并丢失焦点。
      if (document.activeElement instanceof HTMLTextAreaElement) return;
      const width = Math.round(rect.width),
        height = Math.round(rect.height);
      if (width && height)
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!content || size.width < 180 || size.height < 180) return;
    let cancelled = false;
    // 字体按文字分片加载；先加载本章用到的字形，再测量，避免字体替换后正文超页。
    Promise.all([
      document.fonts.load(
        '17px "Journal Kai"',
        [
          content.diary.title,
          content.diary.signature,
          ...content.diary.paragraphs,
          ...content.opening.paragraphs,
        ].join(''),
      ),
      document.fonts.load('30px "Ma Shan Zheng"', '鸥宝日记'),
    ])
      .catch(() => [])
      .then(() => {
        if (cancelled) return;
        try {
          const nextPages = buildPages(content, size.width, size.height);
          const previous = savedPosition.current;
          const nextIndex =
            previous?.chapterId === content.id
              ? Math.max(
                  0,
                  nextPages.findIndex((page) => page.id === previous.pageId),
                )
              : 0;
          setIndex(nextIndex);
          setPages(nextPages);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : '书页排版失败。');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [content, size]);

  const onFlip = useCallback(
    (value: number) => {
      setIndex(value);
      const page = pages[value];
      if (!page) return;
      const position = { chapterId, pageId: page.id, pageIndex: value };
      savedPosition.current = position;
      // 封面和目录不覆盖上次读到的正文，保留“继续阅读”的意义。
      if (value > 1) saveLocal('position', position);
    },
    [pages, chapterId],
  );

  const selectChapter = useCallback(
    (id: string) => {
      const target = getChapter(id);
      if (target.status !== 'published') {
        notify(`「${target.title}」还在写给你的路上。`);
        return;
      }
      setMenu(false);
      music.startReading();
      if (id === chapterId) {
        const first = pages.findIndex((page) => page.kind === 'intro');
        book.current?.goTo(Math.max(0, first));
      } else {
        savedPosition.current = { chapterId: id, pageId: `${id}-intro`, pageIndex: 2 };
        setPages([]);
        setChapterId(id);
      }
    },
    [chapterId, pages, notify, music.startReading],
  );

  function continueReading() {
    if (!resume) return;
    if (getChapter(resume.chapterId).status !== 'published') {
      setResume(null);
      return;
    }
    if (resume.chapterId === chapterId) {
      const found = pages.findIndex((page) => page.id === resume.pageId);
      book.current?.goTo(found >= 0 ? found : Math.min(resume.pageIndex, pages.length - 1));
    } else {
      savedPosition.current = resume;
      setPages([]);
      setChapterId(resume.chapterId);
    }
    setResume(null);
  }

  useEffect(() => {
    const dialog = menuRef.current;
    if (menu && !dialog?.open) dialog?.showModal();
    if (!menu && dialog?.open) dialog.close();
  }, [menu]);
  useEffect(() => {
    const dialog = imageRef.current;
    if (image && !dialog?.open) dialog?.showModal();
    if (!image && dialog?.open) dialog.close();
  }, [image]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        menu ||
        image ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        book.current?.next();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        book.current?.previous();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [menu, image]);

  const currentPage = pages[index];
  const progress = pages.length > 1 ? index / (pages.length - 1) : 0;
  const sections = pages.reduce<{ title: string; index: number }[]>((result, page, i) => {
    const title = getPageName(page);
    if (!result.some((section) => section.title === title)) result.push({ title, index: i });
    return result;
  }, []);

  return (
    <div
      className="app-shell"
      data-motion={motion.enabled ? 'on' : 'off'}
      style={
        {
          '--paper-image': `url("${asset('paper.webp')}")`,
          '--blank-image': `url("${asset('notebook-blank.webp')}")`,
          '--cover-image': `url("${asset('notebook-title.webp')}")`,
          '--logo-image': `url("${asset('notebook-logo.webp')}")`,
          '--scene-image': `url("${asset('notebook-scene.webp')}")`,
          '--scene-edge': `url("${asset('scene-edge.webp')}")`,
          '--contents-image': `url("${content?.contentsDesign ?? asset('notebook-blank.webp')}")`,
        } as React.CSSProperties
      }
    >
      <audio
        ref={music.audioRef}
        className="background-music"
        src={`${import.meta.env.BASE_URL}audio/dream-culture-web.mp3`}
        // 只预取元数据；完整音频等播放时再下载，避免 2MB 音频拖住首屏。
        preload="metadata"
        loop
        aria-hidden="true"
      />
      <div className="landscape-background" aria-hidden="true" />
      <header className="site-header">
        <a
          className="site-brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            book.current?.goTo(0);
          }}
        >
          <Feather size={17} />
          <span>鸥宝越冬志</span>
          <span className="brand-divider" />
          <small>汉中 · 冬日手记</small>
        </a>
        <div className="header-actions">
          <button
            className={`music-toggle ${music.playing ? 'is-playing' : ''}`}
            aria-label="背景音乐"
            aria-pressed={music.enabled}
            title={
              music.blocked
                ? '重试播放音乐'
                : music.needsGesture
                  ? '轻触播放音乐'
                  : music.enabled
                    ? '关闭背景音乐'
                    : '播放背景音乐'
            }
            onClick={music.toggle}
          >
            {music.enabled ? <Music2 size={16} /> : <VolumeX size={16} />}
            <span>
              {music.blocked
                ? '重试音乐'
                : music.playing
                  ? '音乐开'
                  : music.needsGesture && music.enabled
                    ? '轻触听音乐'
                    : music.enabled
                      ? '音乐待播'
                      : '音乐关'}
            </span>
            <i className="music-bars" aria-hidden="true">
              <b />
              <b />
              <b />
            </i>
          </button>
          <button
            className="motion-toggle"
            aria-label="装饰动效"
            aria-pressed={motion.enabled}
            disabled={motion.reduced}
            title={
              motion.reduced
                ? '已跟随系统减少动态效果'
                : motion.enabled
                  ? '暂停装饰动效'
                  : '开启装饰动效'
            }
            onClick={motion.toggle}
          >
            {motion.enabled ? <Pause size={14} /> : <Sparkles size={14} />}
            <span>{motion.enabled ? '静止画面' : '开启动效'}</span>
          </button>
          <button className="header-menu" onClick={() => setMenu(true)} aria-label="打开全书目录">
            <List size={17} />
            <span>目录</span>
          </button>
        </div>
      </header>
      <main className="reading-room">
        <div className="desktop-margin margin-left">
          <span>WINTER IN HANZHONG</span>
          <i />
          <span>把相逢，写进日记。</span>
        </div>
        <div className="book-stage">
          <div className="book-size" ref={stage}>
            <div className="book-paper-stack" aria-hidden="true" />
            {content && pages.length && !error ? (
              <FlipBook
                motionEnabled={motion.enabled}
                ref={book}
                pages={pages}
                chapter={content}
                summary={summary}
                width={size.width}
                height={size.height}
                startPage={index}
                onFlip={onFlip}
                onRead={music.startReading}
                selectChapter={selectChapter}
                notify={notify}
                openImage={(src, alt) => setImage({ src, alt })}
              />
            ) : (
              <div className="loading-page" role="status">
                <Feather size={30} />
                <p>{error || '正在翻开冬天的故事…'}</p>
                {error && (
                  <button className="text-link" onClick={() => window.location.reload()}>
                    重新打开
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            )}
            <button
              className="ribbon-bookmark"
              onClick={() => setMenu(true)}
              aria-label="打开章节书签"
            >
              <Bookmark size={16} />
              <span>
                目<br />录
              </span>
            </button>
          </div>
        </div>
        <div className="desktop-margin margin-right">
          <span>八期连载</span>
          <i />
          <span>一场山水间的约定</span>
        </div>
      </main>
      <footer className="reader-controls">
        <div className="navigation-row">
          <button
            className="nav-arrow"
            aria-label="上一页"
            disabled={index === 0 || !pages.length}
            onClick={() => book.current?.previous()}
          >
            <ArrowLeft size={19} />
          </button>
          <div className="reading-position" aria-live="polite">
            <span>
              {index === 0
                ? '一只小鸥的冬日来信'
                : `第${summary.number}章 · ${summary.title} · ${currentPage ? getPageName(currentPage) : ''}`}
            </span>
            <small>
              {index === 0
                ? '向左轻滑，或点击翻开'
                : `${String(index).padStart(2, '0')} / ${String(pages.length - 1).padStart(2, '0')}`}
            </small>
          </div>
          <button
            className="nav-arrow next-arrow"
            aria-label="下一页"
            disabled={index === pages.length - 1 || !pages.length}
            onClick={() => book.current?.next()}
          >
            <ArrowRight size={19} />
          </button>
        </div>
        <div
          className="reading-progress"
          role="progressbar"
          aria-label="本章阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="room-caption">
          从一江相逢，到一年之约 <span>·</span> 鸥宝在汉中
        </p>
      </footer>
      {resume && index === 0 && pages.length > 0 && (
        <button className="resume-reading" onClick={continueReading}>
          <BookOpen size={14} /> 继续上次的阅读
          <ChevronRight size={14} />
        </button>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      <dialog
        className="contents-dialog"
        ref={menuRef}
        aria-labelledby="directory-title"
        onCancel={() => setMenu(false)}
        onClose={() => setMenu(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMenu(false);
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">BOOKMARKS · 我的书签</span>
            <h2 id="directory-title">冬天，读到哪一页？</h2>
          </div>
          <button className="icon-button" aria-label="关闭目录" onClick={() => setMenu(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          <div className="section-tabs">
            {sections.map((section) => (
              <button
                key={section.title}
                className={
                  getPageName(currentPage ?? { id: '', kind: 'cover' }) === section.title
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  book.current?.goTo(section.index);
                  setMenu(false);
                }}
              >
                {section.title}
              </button>
            ))}
          </div>
          <span className="eyebrow chapter-directory-label">全书八章</span>
          {chapters.map((item) => (
            <button
              className={`drawer-chapter ${item.id === chapterId ? 'active' : ''}`}
              key={item.id}
              disabled={item.status !== 'published'}
              onClick={() => selectChapter(item.id)}
            >
              <span>{String(item.number).padStart(2, '0')}</span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
              {item.status === 'published' ? <ArrowRight size={15} /> : <em>待更新</em>}
            </button>
          ))}
          <button
            className="restart-button"
            onClick={() => {
              book.current?.goTo(0);
              setMenu(false);
            }}
          >
            <RotateCcw size={14} />
            从封面重新读起
          </button>
          <div className="music-credit">
            <span className="eyebrow">音乐 · 冬日伴奏</span>
            <p>“Dream Culture” — Kevin MacLeod</p>
            <p>网页音频已压缩，乐曲内容未剪辑。</p>
            <p>
              <a
                href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046"
                target="_blank"
                rel="noreferrer"
              >
                incompetech.com
              </a>
              <span> · </span>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
            </p>
          </div>
        </div>
      </dialog>
      <dialog
        className="image-dialog"
        ref={imageRef}
        aria-label="照片查看器"
        onCancel={() => setImage(null)}
        onClose={() => setImage(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setImage(null);
        }}
      >
        <button
          className="image-close icon-button"
          aria-label="关闭照片"
          onClick={() => setImage(null)}
        >
          <X size={24} />
        </button>
        {image && (
          <figure>
            <img src={image.src} alt={image.alt} />
            <figcaption>{image.alt}</figcaption>
          </figure>
        )}
      </dialog>
    </div>
  );
}
