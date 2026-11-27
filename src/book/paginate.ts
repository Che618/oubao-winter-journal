import type {
  BookPage,
  ChapterContent,
  ContentBlock,
  FlowPage,
  FlowSection,
} from '../content/types';

function flowPage(chapter: ChapterContent, section: FlowSection): FlowPage {
  const diary = section === 'diary';
  const blocks: ContentBlock[] = diary
    ? [...chapter.diary.paragraphs, chapter.diary.signature].map((text) => ({
        type: 'paragraph',
        text,
      }))
    : chapter.article.blocks;

  return {
    id: `${chapter.id}-${section}-1`,
    kind: 'flow',
    section,
    blocks,
    title: diary ? chapter.diary.title : chapter.article.title,
    subtitle: diary ? undefined : chapter.article.subtitle,
    author: diary ? undefined : chapter.article.author,
  };
}

export function buildPages(chapter: ChapterContent): BookPage[] {
  return [
    { id: 'cover', kind: 'cover' },
    { id: 'contents', kind: 'contents' },
    { id: `${chapter.id}-intro`, kind: 'intro' },
    flowPage(chapter, 'diary'),
    { id: `${chapter.id}-video`, kind: 'video' },
    flowPage(chapter, 'article'),
    ...(chapter.album ?? []).map((spread) => ({
      id: `${chapter.id}-${spread.id}`,
      kind: 'album' as const,
      spread,
    })),
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
    { id: `${chapter.id}-back-cover`, kind: 'backCover' },
  ];
}
