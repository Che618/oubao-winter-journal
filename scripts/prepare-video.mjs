import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { mkdir, mkdtemp, unlink, rmdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { ffmpeg: { type: 'string', default: 'ffmpeg' } } });
const run = promisify(execFile);
const source = path.join(root, '红嘴鸥第一章/视频/vidio.mp4');
const posterSource = path.join(root, '红嘴鸥第一章/视频/封面.jpg');
const target = path.join(root, 'public/assets/chapter-01');
await mkdir(target, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), 'oubao-video-'));
const label = path.join(temporary, 'ai-label.png');
try {
  await sharp(
    Buffer.from(
      '<svg width="280" height="46" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="46" rx="6" fill="black" fill-opacity="0.6"/><text x="16" y="31" font-family="Microsoft YaHei, sans-serif" font-size="24" fill="white">本片含 AI 辅助画面</text></svg>',
    ),
  )
    .png()
    .toFile(label);
  // 仅生成网页副本：烧录AI提示，保留原片内容，faststart允许边下边播。
  const video = path.join(target, 'vlog.mp4');
  await run(values.ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-i',
    label,
    '-filter_complex',
    '[0:v][1:v]overlay=W-w-20:20[v]',
    '-map',
    '[v]',
    '-map',
    '0:a:0?',
    '-c:v',
    'libx264',
    '-crf',
    '26',
    '-maxrate',
    '1400k',
    '-bufsize',
    '2800k',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'main',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-ac',
    '2',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-movflags',
    '+faststart',
    video,
  ]);
  await sharp(posterSource)
    .rotate()
    .resize({ width: 960 })
    .webp({ quality: 90 })
    .toFile(path.join(target, 'vlog-poster.webp'));
  const image = await sharp(path.join(target, 'vlog-poster.webp')).metadata();
  if (image.width !== 960 || image.height !== 540)
    throw new Error('视频封面应由 16:9 的封面.jpg 生成。');
  console.log(
    `网页视频已生成：${(await stat(video)).size} 字节；封面来自视频/封面.jpg；原片与原封面均未改动。`,
  );
} finally {
  await unlink(label).catch(() => {});
  await rmdir(temporary).catch(() => {});
}
