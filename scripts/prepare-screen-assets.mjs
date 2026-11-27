import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'public/assets/screen');
await mkdir(target, { recursive: true });
// 保留原设计内容、色彩与构图；按手机显示尺寸生成独立网页副本。
for (const name of [
  'notebook-scene',
  'notebook-title',
  'notebook-blank',
  'notebook-logo',
  'notebook-chapter',
  'scene-edge',
]) {
  await sharp(path.join(root, `public/assets/${name}.webp`))
    .resize({ width: name === 'scene-edge' ? 21 : 900, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 })
    .toFile(path.join(target, `${name}.webp`));
}
const source = path.join(root, '红嘴鸥第一章/第一章 平面素材打包/日记本设计素材');
const cover = (await readdir(source)).find((name) => name.startsWith('2 '));
await sharp(path.join(source, cover))
  .resize({ width: 900 })
  .webp({ quality: 90, effort: 6 })
  .toFile(path.join(target, 'homepage.webp'));
await sharp(path.join(root, 'public/assets/chapter-01/migration/paper.webp'))
  .resize({ width: 900 })
  .webp({ quality: 90, effort: 6 })
  .toFile(path.join(target, 'migration-paper.webp'));
await sharp(
  path.join(root, '红嘴鸥第一章/第一章 迁徙地图平面素材打包/4翻开日记内页放地图的纯页面.png'),
)
  .resize({ width: 900 })
  .webp({ quality: 90, effort: 6 })
  .toFile(path.join(target, 'migration-scene.webp'));
console.log('首屏与纸张的轻量显示副本已生成，原始设计和无损校对图保留。');
