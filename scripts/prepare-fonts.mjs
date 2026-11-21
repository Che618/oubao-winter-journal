import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = fileURLToPath(new URL('../', import.meta.url));
async function sourceText(folder) {
  const texts = await Promise.all(
    (await readdir(folder, { withFileTypes: true })).map(async (entry) => {
      const file = path.join(folder, entry.name);
      return entry.isDirectory()
        ? sourceText(file)
        : /\.(tsx?|example)$/.test(entry.name)
          ? readFile(file, 'utf8')
          : '';
    }),
  );
  return texts.join('');
}
// 每次启动/构建从全部章节提取字形；后续章无需手工重新制作字体。
const text = await sourceText(path.join(root, 'src'));
const original = await readFile(
  path.join(root, 'node_modules/@fontsource/lxgw-wenkai/files/lxgw-wenkai-latin-500-normal.woff2'),
);
const font = await subsetFont(original, text, { targetFormat: 'woff2' });
await mkdir(path.join(root, 'src/fonts'), { recursive: true });
await writeFile(path.join(root, 'src/fonts/diary-kai.woff2'), font);
const titleSource = path.join(root, 'node_modules/@fontsource/ma-shan-zheng');
const titleCss = await readFile(path.join(titleSource, '400.css'), 'utf8');
const titleRules = [];
for (const block of titleCss.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
  const ranges = block[1].match(/unicode-range:\s*([^;]+)/)?.[1];
  if (!ranges) continue;
  const chars = Array.from('鸥宝日记').filter((char) =>
    ranges.split(',').some((range) => {
      const [start, end = start] = range
        .trim()
        .replace('U+', '')
        .split('-')
        .map((value) => parseInt(value, 16));
      return char.codePointAt(0) >= start && char.codePointAt(0) <= end;
    }),
  );
  if (!chars.length) continue;
  const file = block[1].match(/url\(([^)]+\.woff2)\)/)?.[1];
  if (!file) throw new Error('标题字体源文件缺失');
  const name = `title-${titleRules.length}.woff2`;
  await writeFile(
    path.join(root, 'src/fonts', name),
    await subsetFont(await readFile(path.join(titleSource, file)), chars.join(''), {
      targetFormat: 'woff2',
    }),
  );
  titleRules.push(
    `@font-face { font-family: 'Ma Shan Zheng'; font-weight: 400; font-display: swap; src: url('./${name}') format('woff2'); unicode-range: ${chars.map((char) => `U+${char.codePointAt(0).toString(16)}`).join(',')}; }`,
  );
}
if (!titleRules.length) throw new Error('标题字体生成失败');
await writeFile(path.join(root, 'src/fonts/title.css'), titleRules.join('\n'));
await mkdir(path.join(root, 'public/fonts'), { recursive: true });
for (const [name, license] of [
  ['lxgw-wenkai', 'LXGW-WenKai-OFL.txt'],
  ['ma-shan-zheng', 'MaShanZheng-OFL.txt'],
]) {
  await copyFile(
    path.join(root, `node_modules/@fontsource/${name}/LICENSE`),
    path.join(root, `public/fonts/${license}`),
  );
}
console.log(`日记楷体字形已生成：${font.length} 字节。`);
