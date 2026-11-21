import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const manifest: { source: string; asset: string }[] = JSON.parse(
  readFileSync('public/assets/chapter-01-sources.json', 'utf8'),
);

test('第一章28张素材全部有网页用途，18张照片完整编入相簿', async ({ page }) => {
  expect(manifest).toHaveLength(28);
  // 本机还保留原图时，逐文件核对；CI不依赖原始素材。
  const sourceRoot = '红嘴鸥第一章';
  if (existsSync(sourceRoot)) {
    const files = readdirSync(sourceRoot, { recursive: true })
      .filter((file) => /\.(png|jpe?g)$/i.test(String(file)))
      .map((file) => String(file).replaceAll(path.sep, '/'))
      .sort();
    expect(manifest.map((entry) => entry.source).sort()).toEqual(files);
  }
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  const rendered = await page.evaluate(() =>
    [
      ...Array.from(document.querySelectorAll('img')).map(
        (img) => img.getAttribute('data-src') || img.getAttribute('src') || '',
      ),
      getComputedStyle(document.querySelector('.app-shell')!).getPropertyValue('--paper-image'),
    ].join('\n'),
  );
  for (const entry of manifest)
    expect(rendered, `未展示：${entry.source}`).toContain(`assets/${entry.asset}`);
  const photos = await page
    .locator('.album-photos img')
    .evaluateAll((images) => images.map((image) => image.getAttribute('data-src')));
  expect(new Set(photos).size).toBe(18);
  expect(await page.locator('.family-companions img').count()).toBe(2);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px 全部装帧和相簿图片可翻到、正常加载、完整显示且可放大`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('.flip-engine[data-ready="true"]').waitFor();
    await page.getByRole('button', { name: '打开全书目录' }).click();
    await page
      .locator('.section-tabs')
      .getByRole('button', { name: '日记装帧', exact: true })
      .click();
    let artwork = 0,
      spreads = 0;
    const total = await page.locator('.book-page').count();
    for (let i = 0; i < total; i++) {
      const current = page.locator('.book-page[aria-hidden="false"]');
      const kind = await current.getAttribute('data-page-kind');
      if (kind === 'artwork' || kind === 'album') {
        kind === 'artwork' ? artwork++ : spreads++;
        const images = current.locator('img');
        await expect
          .poll(() =>
            images.evaluateAll((imgs) =>
              imgs.every((image) => image.complete && image.naturalWidth > 0),
            ),
          )
          .toBe(true);
        const layout = await current.locator('.page-inner').evaluate((inner) => ({
          fits: inner.scrollHeight <= inner.clientHeight + 1,
          images: Array.from(inner.querySelectorAll('img')).every(
            (image) => image.clientHeight > 40 && getComputedStyle(image).objectFit === 'contain',
          ),
        }));
        expect(layout).toEqual({ fits: true, images: true });
        await current.locator('.photo-button').first().click();
        await expect(page.getByRole('dialog', { name: '照片查看器' })).toBeVisible();
        await page.getByRole('button', { name: '关闭照片' }).click();
        if (kind === 'album' && spreads === 1)
          await page.screenshot({ path: `test-results/album-${viewport.width}.png` });
        if (kind === 'artwork' && artwork === 1)
          await page.screenshot({ path: `test-results/artwork-${viewport.width}.png` });
      }
      if (await page.getByRole('button', { name: '下一页', exact: true }).isDisabled()) break;
      await page.getByRole('button', { name: '下一页', exact: true }).click();
    }
    expect(artwork).toBe(4);
    expect(spreads).toBe(9);
  });
}
