import sharp from 'sharp';
import { mkdir, readdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// 只读取原始素材，所有网页派生图均写入 public/assets。
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '红嘴鸥第一章');
const output = path.join(root, 'public/assets');
const design = path.join(source, '第一章 平面素材打包');
const { values } = parseArgs({
  options: { photos: { type: 'string' }, chapter: { type: 'string' } },
});
async function preparePhotos(folder, chapterId) {
  if (!/^chapter-\d{2,}$/.test(chapterId)) throw new Error('章节ID应为 chapter-02 这样的格式。');
  const target = path.join(output, chapterId);
  const photos = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name)).sort();
  if (!photos.length) throw new Error('该目录中未找到图片。');
  // 避免用户误将派生目录作为原始输入。
  const relative = path.relative(output, path.resolve(folder));
  if (!relative.startsWith('..') && !path.isAbsolute(relative))
    throw new Error('请指定 public/assets 之外的原始素材目录。');
  await mkdir(target, { recursive: true });
  for (const [i, file] of photos.entries()) {
    const name = `photo-${String(i + 1).padStart(2, '0')}.webp`;
    await sharp(path.join(folder, file))
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(target, name));
    console.log(`${file} → assets/${chapterId}/${name}`);
  }
  return photos.length;
}
if (values.photos || values.chapter) {
  if (!values.photos || !values.chapter)
    throw new Error('请同时传入 --photos 素材目录 和 --chapter 章节ID。');
  await preparePhotos(path.resolve(root, values.photos), values.chapter);
  process.exit(0);
}
await access(source);
await mkdir(output, { recursive: true });
const jobs = [
  ['日记本设计素材/日记本单页.png', 'paper.webp', 900],
  ['日记本设计素材/1 未翻开LOGO页 设计 zsr.png', 'notebook-logo.webp', 900],
  ['日记本设计素材/2 翻开封面页 设计 zsr.png', 'notebook-title.webp', 900],
  ['日记本设计素材/3 翻开封面页+目录 第一期 先至 设计 zsr.png', 'notebook-chapter.webp', 900],
  ['日记本设计素材/纯翻开空白页   备选.png', 'notebook-blank.webp', 900],
  ['日记本设计素材/欧宝脚印.png', 'footprint.webp', 220],
  ['红嘴鸥IP设计素材/欧宝 1 zsr.png', 'oubao.webp', 600],
  ['红嘴鸥IP设计素材/红嘴鸥一家三口.png', 'family.webp', 900],
  ['红嘴鸥IP设计素材/红嘴鸥妈妈形象设计.png', 'mother.webp', 500],
  ['红嘴鸥IP设计素材/鸥爸1 zsr.png', 'father.webp', 500],
];
for (const [file, name, width] of jobs) {
  const input = path.join(design, file);
  if (name.startsWith('notebook-')) {
    const metadata = await sharp(input).metadata();
    const scale = metadata.width / 1511;
    await sharp(input)
      .extract({
        left: Math.round(136 * scale),
        top: Math.round(418 * scale),
        width: Math.round(1240 * scale),
        height: Math.round(1835 * scale),
      })
      .webp({ lossless: true })
      .toFile(path.join(output, name));
  } else {
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(path.join(output, name));
  }
}
const blank = path.join(design, '日记本设计素材', '纯翻开空白页   备选.png');
// 背景保留完整原图像素；书页单独裁切后，在同一纸张坐标上翻动。
await sharp(blank).webp({ lossless: true }).toFile(path.join(output, 'notebook-scene.webp'));
await sharp(blank)
  .extract({ left: 1490, top: 0, width: 21, height: 2845 })
  .webp({ lossless: true })
  .toFile(path.join(output, 'scene-edge.webp'));
const { width, height } = await sharp(blank).metadata();
await sharp(blank)
  .extract({ left: 0, top: height - 380, width, height: 380 })
  .resize({ width: 1600 })
  .webp({ quality: 85 })
  .toFile(path.join(output, 'river-watercolor.webp'));
const photoCount = await preparePhotos(path.join(source, '红嘴鸥照片'), 'chapter-01');
const photoFiles = (await readdir(path.join(source, '红嘴鸥照片')))
  .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  .sort();
const manifest = [
  ...jobs.map(([file, name]) => ({ source: `第一章 平面素材打包/${file}`, asset: name })),
  ...photoFiles.map((file, i) => ({
    source: `红嘴鸥照片/${file}`,
    asset: `chapter-01/photo-${String(i + 1).padStart(2, '0')}.webp`,
  })),
];
await writeFile(
  path.join(output, 'chapter-01-sources.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`已生成 ${jobs.length + photoCount + 3} 张网页派生素材，原始文件未改动。`);
