import type {
  BookPage,
  ChapterContent,
  ContentBlock,
  FlowPage,
  FlowSection,
} from '../content/types';

/**
 * 用实际页面样式测量分页，不按字数硬切。短屏、横屏和字号变化都会重排。
 * 文段超出一页时按 Unicode 字符拆分，文字原样保留。
 */
function paginateFlow(
  chapter: ChapterContent,
  section: FlowSection,
  width: number,
  height: number,
): FlowPage[] {
  const diary = section === 'diary';
  const blocks: ContentBlock[] = diary
    ? [...chapter.diary.paragraphs, chapter.diary.signature].map((text) => ({
        type: 'paragraph',
        text,
      }))
    : chapter.article.blocks;
  const pages: FlowPage[] = [];
  const outer = document.createElement('div');
  outer.className = 'book-page measurement-page';
  outer.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none`;
  const inner = document.createElement('div');
  inner.className = `page-inner flow-inner ${diary ? 'diary-flow' : 'article-flow'}`;
  outer.append(inner);
  document.body.append(outer);
  let page!: FlowPage;
  let prose!: HTMLDivElement;

  function newPage() {
    inner.replaceChildren();
    const first = pages.length === 0;
    page = {
      id: `${chapter.id}-${section}-${pages.length + 1}`,
      kind: 'flow',
      section,
      blocks: [],
      title: first ? (diary ? chapter.diary.title : chapter.article.title) : undefined,
      subtitle: first && !diary ? chapter.article.subtitle : undefined,
      author: first && !diary ? chapter.article.author : undefined,
    };
    pages.push(page);
    const label = document.createElement('div');
    label.className = 'eyebrow';
    label.textContent = diary
      ? `${chapter.diary.date} · ${chapter.diary.weekday} · ${chapter.diary.weather}`
      : '江边剪报 · 汉中的冬天';
    inner.append(label);
    if (page.title) {
      const heading = document.createElement('h2');
      heading.className = 'flow-title';
      heading.textContent = page.title;
      inner.append(heading);
    }
    if (page.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'flow-subtitle';
      subtitle.textContent = page.subtitle;
      inner.append(subtitle);
    }
    if (page.author) {
      const author = document.createElement('p');
      author.className = 'flow-author';
      author.textContent = page.author;
      inner.append(author);
    }
    prose = document.createElement('div');
    prose.className = 'prose';
    inner.append(prose);
  }

  function nodeFor(block: ContentBlock) {
    if (block.type === 'photo') {
      const figure = document.createElement('figure');
      figure.className = 'reader-figure';
      const img = document.createElement('img');
      img.alt = block.alt;
      figure.append(img);
      if (block.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = block.caption;
        figure.append(caption);
      }
      return figure;
    }
    const el = document.createElement(block.type === 'subheading' ? 'h3' : 'p');
    el.textContent = block.text;
    return el;
  }
  function fits(node: HTMLElement) {
    prose.append(node);
    const bottom = node.getBoundingClientRect().bottom;
    const limit =
      inner.getBoundingClientRect().bottom - parseFloat(getComputedStyle(inner).paddingBottom);
    node.remove();
    return bottom <= limit + 0.5;
  }
  function commit(block: ContentBlock) {
    page.blocks.push(block);
    prose.append(nodeFor(block));
  }

  try {
    newPage();
    for (const block of blocks) {
      if (fits(nodeFor(block))) {
        commit(block);
        continue;
      }
      if (block.type !== 'paragraph') {
        if (page.blocks.length) newPage();
        // 为首篇的大标题留出空间，将图片放到下一页。
        if (!fits(nodeFor(block)) && page.title) newPage();
        commit(block);
        continue;
      }
      let remaining = Array.from(block.text);
      while (remaining.length) {
        if (fits(nodeFor({ type: 'paragraph', text: remaining.join('') }))) {
          commit({ type: 'paragraph', text: remaining.join('') });
          break;
        }
        let low = 0,
          high = remaining.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (fits(nodeFor({ type: 'paragraph', text: remaining.slice(0, mid).join('') })))
            low = mid;
          else high = mid - 1;
        }
        if (low < 12 && page.blocks.length) {
          newPage();
          continue;
        }
        if (low === 0) {
          if (page.title) {
            newPage();
            continue;
          }
          throw new Error('当前阅读区域过小，请竖屏阅读。');
        }
        commit({ type: 'paragraph', text: remaining.slice(0, low).join('') });
        remaining = remaining.slice(low);
        if (remaining.length) newPage();
      }
    }
    return pages.filter((p) => p.blocks.length > 0 || p.title);
  } finally {
    outer.remove();
  }
}

export function buildPages(chapter: ChapterContent, width: number, height: number): BookPage[] {
  return [
    { id: 'cover', kind: 'cover' },
    { id: 'contents', kind: 'contents' },
    { id: `${chapter.id}-intro`, kind: 'intro' },
    ...paginateFlow(chapter, 'diary', width, height),
    { id: `${chapter.id}-video`, kind: 'video' },
    ...paginateFlow(chapter, 'article', width, height),
    ...(chapter.journey
      ? [
          { id: `${chapter.id}-journey`, kind: 'journey' as const },
          { id: `${chapter.id}-aerial`, kind: 'aerial' as const },
        ]
      : []),
    ...(chapter.activities ?? []).map((activity) => ({
      id: `${chapter.id}-${activity.id}`,
      kind: 'activity' as const,
      activity,
    })),
    { id: `${chapter.id}-letter`, kind: 'letter' },
  ];
}
