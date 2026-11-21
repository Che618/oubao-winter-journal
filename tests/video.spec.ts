import { test, expect } from '@playwright/test';

test('视频承接日记并引出稿件，点击前不下载，播放时停BGM、翻页暂停、返回保留进度', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/vlog.mp4')) requests.push(request.url());
  });
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  const order = await page
    .locator('.book-page')
    .evaluateAll((pages) => pages.map((page) => page.getAttribute('data-page-kind')));
  const videoIndex = order.indexOf('video');
  expect(order.slice(0, videoIndex).filter((kind) => kind === 'flow').length).toBeGreaterThan(0);
  expect(order[videoIndex + 1]).toBe('flow');
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await page
    .getByRole('navigation', { name: '本章阅读目录' })
    .getByRole('button', { name: '影像日记' })
    .click();
  const video = page.locator('.book-page[aria-hidden="false"] video');
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(page.locator('.book-page[aria-hidden="false"] .ai-disclosure')).toContainText('AI');
  expect(requests).toHaveLength(0);
  const audio = page.locator('.background-music');
  await expect.poll(() => audio.evaluate((el) => (el as HTMLAudioElement).paused)).toBe(false);
  await video.evaluate((el) => (el as HTMLVideoElement).play());
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.2);
  const info = await video.evaluate((el) => {
    const media = el as HTMLVideoElement;
    return { duration: media.duration, width: media.videoWidth, height: media.videoHeight };
  });
  expect(info.duration).toBeGreaterThan(68);
  expect(info.duration).toBeLessThan(69);
  expect(info).toMatchObject({ width: 1280, height: 720 });
  await expect.poll(() => audio.evaluate((el) => (el as HTMLAudioElement).paused)).toBe(true);
  await page.screenshot({ path: 'test-results/video-playing.png' });
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('.reading-position')).toContainText('江边剪报');
  const hiddenVideo = page.locator('video');
  await expect.poll(() => hiddenVideo.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(true);
  const position = await hiddenVideo.evaluate((el) => (el as HTMLVideoElement).currentTime);
  await expect.poll(() => audio.evaluate((el) => (el as HTMLAudioElement).paused)).toBe(false);
  await page.getByRole('button', { name: '上一页', exact: true }).click();
  expect(await video.evaluate((el) => (el as HTMLVideoElement).currentTime)).toBeCloseTo(
    position,
    1,
  );
  expect(await video.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(true);
});
