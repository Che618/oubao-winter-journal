import { asset, type ChapterContent } from '../../src/content/types';

// 仅供扩展回归测试，产品目录中不会发布这份演示内容。
const chapter: ChapterContent = {
  id: 'chapter-02',
  opening: {
    title: '第二章测试开篇',
    paragraphs: ['测试新章节使用独立内容，复用同一本书。'],
    illustration: asset('oubao.webp'),
    illustrationAlt: '测试用鸥宝形象',
  },
  diary: {
    title: '第二章测试日记',
    date: '11月15日',
    weekday: '星期日',
    weather: '晴',
    paragraphs: ['这是一段仅在自动化测试中出现的第二章日记。'],
    signature: '——第二章测试签名',
  },
  video: { title: '第二章测试影像', poster: asset('chapter-01/photo-02.webp') },
  article: {
    title: '第二章测试报道',
    author: '测试署名',
    blocks: [{ type: 'paragraph', text: '测试报道不会出现在第一章中。' }],
  },
  activities: [
    {
      type: 'quiz',
      id: 'food',
      title: '测试小课堂',
      question: '请选择第一项',
      options: ['第一项', '第二项'],
      correctIndex: 0,
      explanation: '这是一段测试反馈。',
    },
  ],
  ending: { text: '测试新章节独立结束。' },
};
export default chapter;
