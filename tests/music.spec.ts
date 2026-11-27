import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--autoplay-policy=user-gesture-required'] } });

async function openBook(page: Page) {
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
}
const paused = (page: Page) =>
  page.locator('.background-music').evaluate((el) => (el as HTMLAudioElement).paused);

test('进入即加载，自动播放被拦截后轻触封面播放；关闭后不误恢复，重新进入默认开启', async ({
  page,
}) => {
  // 固定模拟手势策略；手势后仍调用原生play验证真实音频，避免依赖Chrome版本和加载时机。
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let activated = false;
    for (const type of ['pointerdown', 'touchend', 'keydown'])
      document.addEventListener(
        type,
        (event) => {
          if (event.isTrusted) activated = true;
        },
        true,
      );
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !activated)
        return Promise.reject(new DOMException('Requires user activation', 'NotAllowedError'));
      return play.call(this);
    };
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.mp3')) requests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await openBook(page);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(await paused(page)).toBe(true);
  await expect(page.getByRole('button', { name: '背景音乐' })).toContainText('轻触听音乐');
  // 不翻书，轻触页面空白区域即可解锁有声播放。
  await page.mouse.click(8, 42);
  await expect.poll(() => paused(page)).toBe(false);
  await expect
    .poll(() =>
      page.locator('.background-music').evaluate((el) => (el as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0);
  expect(
    await page.locator('.background-music').evaluate((el) => ({
      volume: (el as HTMLAudioElement).volume,
      loop: (el as HTMLAudioElement).loop,
    })),
  ).toEqual({ volume: 0.2, loop: true });
  await expect(page.getByRole('button', { name: '翻开我们的故事' })).toBeVisible();
  await page.getByRole('button', { name: '背景音乐' }).click();
  await expect.poll(() => paused(page)).toBe(true);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  expect(await paused(page)).toBe(true);
  await page.reload();
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  await expect(page.getByRole('button', { name: '背景音乐' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await paused(page)).toBe(true);
  // 被拦截时点击音乐按钮直接播放，不会被误当成关闭。
  await expect(page.getByRole('button', { name: '背景音乐' })).toContainText('轻触听音乐');
  await page.getByRole('button', { name: '背景音乐' }).click();
  await expect.poll(() => paused(page)).toBe(false);
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await expect(page.locator('.music-credit')).toContainText('Kevin MacLeod');
  await expect(
    page.locator('.music-credit').getByRole('link', { name: 'CC BY 4.0' }),
  ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  await page.getByRole('button', { name: '关闭目录' }).click();
  const fits = await page.evaluate(() => {
    const brand = document.querySelector('.site-brand')!.getBoundingClientRect();
    const actions = document.querySelector('.header-actions')!.getBoundingClientRect();
    return (
      brand.right < actions.left &&
      actions.right <= innerWidth &&
      document.documentElement.scrollWidth <= innerWidth
    );
  });
  expect(fits).toBe(true);
});

test('真实媒体播放时暂停BGM，视频暂停后恢复，关闭音乐后不误恢复', async ({ page }) => {
  await openBook(page);
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await expect.poll(() => paused(page)).toBe(false);
  // 用本地MP3作为video的可解码媒体源，验证真实play/pause事件，而非伪造播放状态。
  await page.evaluate(async () => {
    const video = document.createElement('video');
    video.id = 'test-video';
    video.src = new URL('audio/dream-culture-web.mp3', location.href).href;
    video.muted = true;
    document.querySelector('.book-page[aria-hidden="false"] .page-inner')!.append(video);
    await video.play();
  });
  await expect.poll(() => paused(page)).toBe(true);
  await page.locator('#test-video').evaluate((el) => (el as HTMLVideoElement).pause());
  await expect.poll(() => paused(page)).toBe(false);
  await page.locator('#test-video').evaluate((el) => (el as HTMLVideoElement).play());
  await expect.poll(() => paused(page)).toBe(true);
  await page.getByRole('button', { name: '背景音乐' }).click();
  await page.locator('#test-video').evaluate((el) => (el as HTMLVideoElement).pause());
  expect(await paused(page)).toBe(true);
  await expect(page.getByRole('button', { name: '背景音乐' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('音频加载失败可重试，不影响翻书', async ({ page }) => {
  await page.route('**/audio/dream-culture-web.mp3', (route) => route.abort());
  await openBook(page);
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  const toggle = page.getByRole('button', { name: '背景音乐' });
  await expect(toggle).toContainText('重试音乐');
  await expect(page.locator('.reading-position')).toContainText('目录');
  await page.unroute('**/audio/dream-culture-web.mp3');
  await toggle.click();
  await expect.poll(() => paused(page)).toBe(false);
  await expect(toggle).toContainText('音乐开');
});
