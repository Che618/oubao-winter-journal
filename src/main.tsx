import { createRoot } from 'react-dom/client';
import App from './App';
import './fonts/title.css';
import './styles.css';
import './motion.css';
import './music.css';
import './album.css';
import './design.css';
import './typography.css';
import './migration.css';

createRoot(document.getElementById('root')!).render(<App />);

// 静态首页不等待JS、字体与分页。交互封面及背景解码完成后一次替换，避免逐层显现。
const startup = document.getElementById('startup-cover');
if (startup) {
  const observer = new MutationObserver(() => {
    if (document.querySelector('.loading-page .text-link')) {
      observer.disconnect();
      startup.remove();
      return;
    }
    if (!document.querySelector('.flip-engine[data-ready="true"]')) return;
    observer.disconnect();
    Promise.all(
      ['notebook-scene', 'notebook-title', 'scene-edge'].map((name) => {
        const image = new Image();
        image.src = new URL(`assets/screen/${name}.webp`, document.baseURI).href;
        return image.decode().catch(() => {});
      }),
    ).then(() => requestAnimationFrame(() => startup.remove()));
  });
  observer.observe(document.getElementById('root')!, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-ready'],
  });
}
