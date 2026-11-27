import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '红嘴鸥第一章/第一章 迁徙地图平面素材打包');
const output = path.join(root, 'public/assets/chapter-01/migration');
await mkdir(output, { recursive: true });
const jobs = [
  ['红嘴鸥手绘迁徙地图制作底板.psd.png', 'map.webp', 1240],
  ['线路.png', 'route.webp', 384],
  ['红嘴鸥移动光标图.png', 'gull.webp', 220],
  ['飞翔的鸥宝.png', 'oubao-flying.webp', 360],
];
for (const [file, target, width] of jobs) {
  await sharp(path.join(source, file))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
    .toFile(path.join(output, target));
}
await sharp(path.join(source, '4翻开日记内页放地图的纯页面.png'))
  .extract({ left: 136, top: 418, width: 1240, height: 1835 })
  .webp({ lossless: true })
  .toFile(path.join(output, 'paper.webp'));
// 地标原图为透明长条；按预览中的6个点拆开，使每个点能单独拖动。
const markers = [
  { id: 'siberia', left: 277, top: 0, width: 124, height: 123 },
  { id: 'inner-mongolia', left: 534, top: 1761, width: 65, height: 66 },
  { id: 'shahu', left: 438, top: 1929, width: 66, height: 66 },
  { id: 'yanan', left: 499, top: 2259, width: 67, height: 67 },
  { id: 'xian', left: 246, top: 2507, width: 67, height: 67 },
  { id: 'hanzhong', left: 0, top: 2895, width: 124, height: 122 },
];
for (const { id, ...crop } of markers) {
  await sharp(path.join(source, '所有地标点（需放在线路上面）.png'))
    .extract(crop)
    .webp({ lossless: true })
    .toFile(path.join(output, `point-${id}.webp`));
}
await writeFile(
  path.join(output, 'SOURCES.json'),
  JSON.stringify(
    {
      layers: jobs.map(([file, asset]) => ({ source: file, asset })),
      paper: { source: '4翻开日记内页放地图的纯页面.png', asset: 'paper.webp' },
      markers: {
        source: '所有地标点（需放在线路上面）.png',
        assets: markers.map(({ id }) => `point-${id}.webp`),
      },
      references: [
        '4翻开日记内页+地图 内页制作底板.png',
        '4翻开日记内页+地图 内页预览图.png',
        '红嘴鸥手绘迁徙地图 预览图.png',
      ],
      note: '制作底板、预览图用于核对纸页布局、路线与地标叠放；网页使用分层素材，不重复插入整幅预览。',
    },
    null,
    2,
  ) + '\n',
);
console.log('迁徙地图分层、6个独立地标及来源记录已生成，原始文件未修改。');
