/** 内容与页面分离：新章节复用这些类型，不需要复制书本组件。 */
export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'photo'; src: string; alt: string; caption?: string }
  | { type: 'subheading'; text: string };

export interface ChapterSummary {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  status: 'published' | 'upcoming';
  load?: () => Promise<{ default: ChapterContent }>;
}

export interface ChapterContent {
  id: string;
  /** 原有平面设计作为独立扉页呈现，不用小图挤进正文。 */
  frontMatter?: ArtworkPage[];
  closingArtwork?: ArtworkPage[];
  album?: { id: string; title: string; photos: { src: string; alt: string; caption: string }[] }[];
  opening: {
    greeting?: string;
    title: string;
    paragraphs: string[];
    illustration: string;
    illustrationAlt: string;
    annotation?: string;
    companions?: { name: string; src: string; alt: string }[];
  };
  diary: {
    title: string;
    date: string;
    weekday: string;
    weather: string;
    paragraphs: string[];
    signature: string;
  };
  video: { title: string; poster: string; src?: string; caption?: string; aiGenerated?: boolean };
  article: { title: string; subtitle?: string; author: string; blocks: ContentBlock[] };
  journey?: {
    title: string;
    description: string;
    stops: { label: string; note: string }[];
    aerial: { src: string; alt: string; panoramaUrl?: string };
  };
  /** 后续小课堂、拼图等在此注册，不必改动翻书逻辑。 */
  activities?: ActivityConfig[];
  ending: { text: string; nextChapterId?: string };
}

export interface ArtworkPage {
  id: string;
  title: string;
  src: string;
  alt: string;
}

export type ActivityConfig =
  | {
      type: 'quiz';
      id: string;
      title: string;
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }
  | { type: 'link'; id: string; title: string; description: string; href: string; label: string };

export type FlowSection = 'diary' | 'article';
export interface FlowPage {
  id: string;
  kind: 'flow';
  section: FlowSection;
  title?: string;
  subtitle?: string;
  author?: string;
  blocks: ContentBlock[];
}
export type BookPage =
  | { id: string; kind: 'artwork'; artwork: ArtworkPage }
  | { id: string; kind: 'album'; spread: NonNullable<ChapterContent['album']>[number] }
  | { id: string; kind: 'cover' | 'contents' | 'intro' | 'video' | 'journey' | 'aerial' | 'letter' }
  | { id: string; kind: 'activity'; activity: ActivityConfig }
  | FlowPage;

export const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
