import type { ChapterSummary } from './types';

/** 新章节上线：新增独立内容文件，将 status 改为 published，并添加 load。 */
export const chapters: ChapterSummary[] = [
  {
    id: 'chapter-01',
    number: 1,
    title: '先至',
    subtitle: '初见一江温暖',
    status: 'published',
    load: () => import('./chapters/chapter-01'),
  },
  { id: 'chapter-02', number: 2, title: '汇群', subtitle: '江边来了一群人', status: 'upcoming' },
  { id: 'chapter-03', number: 3, title: '蓄翼', subtitle: '一座城的温柔变化', status: 'upcoming' },
  {
    id: 'chapter-04',
    number: 4,
    title: '横空',
    subtitle: '去认识山水间的朋友',
    status: 'upcoming',
  },
  { id: 'chapter-05', number: 5, title: '集影', subtitle: '认得那一抹红马甲', status: 'upcoming' },
  { id: 'chapter-06', number: 6, title: '守寒', subtitle: '江水里的冬日暖意', status: 'upcoming' },
  { id: 'chapter-07', number: 7, title: '辞津', subtitle: '被镜头珍藏的冬天', status: 'upcoming' },
  {
    id: 'chapter-08',
    number: 8,
    title: '有期',
    subtitle: '明年冬天，一定再见',
    status: 'upcoming',
  },
];

export function getChapter(id: string): ChapterSummary {
  return chapters.find((chapter) => chapter.id === id) ?? chapters[0];
}

export async function loadChapter(chapter: ChapterSummary) {
  if (chapter.status !== 'published' || !chapter.load) throw new Error('这一章还在写给你的路上。');
  const content = (await chapter.load()).default;
  if (content.id !== chapter.id || !content.diary || !content.article)
    throw new Error('章节内容暂时无法打开，请稍后重试。');
  return content;
}
