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
