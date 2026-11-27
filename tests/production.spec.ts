import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`${viewport.width}px 构建产物在仓库子路径下可显示，封面背景目录图片均无404`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED')
        errors.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    await page.goto('./');
    await page.locator('.flip-engine[data-ready="true"]').waitFor();
    // 验证浏览器实际解析出的CSS背景地址，不能只检查HTML或文件是否存在。
    const backgrounds = await page
      .locator('.book-stage, .page-cover, .page-contents, .landscape-background')
      .evaluateAll(async (elements) => {
        return Promise.all(
          elements.map(async (element) => {
            const url =
              getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
            if (!url) return { url: '', loaded: false };
            const image = new Image();
            image.src = url;
            await image.decode();
            return { url, loaded: image.naturalWidth > 0 };
          }),
        );
      });
    expect(backgrounds).toHaveLength(4);
    expect(
      backgrounds.every(
        (background) => background.loaded && !background.url.includes('/assets/assets/'),
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/production-cover-${viewport.width}.png` });
    await page.getByRole('button', { name: '翻开我们的故事' }).click();
    await expect(page.locator('.reading-position')).toContainText('目录');
    await page
      .getByRole('navigation', { name: '本章阅读目录' })
      .getByRole('button', { name: '鸥宝日记' })
      .click();
    await expect(page.locator('.book-page[aria-hidden="false"] .diary-wordmark')).toHaveText(
      '鸥宝日记',
    );
    const diary = page.locator('.book-page[aria-hidden="false"] .diary-flow');
    await expect(diary.locator('[data-source-paragraph]')).toHaveCount(8);
    const diaryStart = await diary.evaluate((element) => element.scrollTop);
    await diary.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    expect(await diary.evaluate((element) => element.scrollTop)).toBeGreaterThan(diaryStart);
    await expect(diary.locator('[data-source-paragraph]').last()).toBeVisible();
    await diary.evaluate((element) => element.scrollTo({ top: 0 }));
    expect(
      await page.evaluate(
        () =>
          document.fonts.check('17px "Journal Kai"', '初见汉江') &&
          document.fonts.check('30px "Ma Shan Zheng"', '鸥宝日记'),
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/production-diary-${viewport.width}.png` });
    await page.getByRole('button', { name: '打开全书目录' }).click();
    await page
      .locator('.section-tabs')
      .getByRole('button', { name: '来时的路', exact: true })
      .click();
    const migration = page.locator('.book-page[aria-hidden="false"] .migration-board');
    await expect
      .poll(() =>
        migration
          .locator('img')
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await expect(migration.locator('.migration-point')).toHaveCount(6);
    const bird = migration.getByRole('button', { name: '拖动海鸥探索迁徙路线' });
    const birdPosition = await bird.getAttribute('style');
    await bird.focus();
    await bird.press('ArrowDown');
    expect(await bird.getAttribute('style')).not.toBe(birdPosition);
    await expect(page.locator('.reading-position')).toContainText('来时的路');
    await page.getByRole('button', { name: '打开全书目录' }).click();
    await page.locator('.section-tabs').getByRole('button', { name: '目录', exact: true }).click();
    await page
      .getByRole('navigation', { name: '本章阅读目录' })
      .getByRole('button', { name: '江边剪报' })
      .click();
    const photo = page.locator('.book-page[aria-hidden="false"] img').first();
    if (await photo.count())
      await expect
        .poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('正式构建中的第一集可解码播放，视频播放时暂停背景音乐', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await page
    .getByRole('navigation', { name: '本章阅读目录' })
    .getByRole('button', { name: '影像日记' })
    .click();
  const video = page.locator('.book-page[aria-hidden="false"] video');
  await expect(video).toHaveAttribute('src', /\/assets\/chapter-01\/vlog.mp4$/);
  await expect(video).toHaveAttribute('poster', /\/assets\/chapter-01\/vlog-poster.webp$/);
  const poster = await video.evaluate((element) => {
    const image = new Image();
    image.src = (element as HTMLVideoElement).poster;
    return image.decode().then(() => ({ width: image.naturalWidth, height: image.naturalHeight }));
  });
  expect(poster).toEqual({ width: 960, height: 540 });
  await expect(page.locator('.book-page[aria-hidden="false"] .ai-disclosure')).toContainText('AI');
  await video.evaluate((element) => (element as HTMLVideoElement).play());
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.2);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBe(1280);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).duration)).toBeGreaterThan(
    68,
  );
  await expect
    .poll(() =>
      page.locator('.background-music').evaluate((element) => (element as HTMLAudioElement).paused),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/production-video.png' });
  await video.evaluate((element) => (element as HTMLVideoElement).pause());
  expect(errors).toEqual([]);
});
