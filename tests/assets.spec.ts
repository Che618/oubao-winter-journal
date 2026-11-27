import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
      .filter((file) => file.startsWith('第一章 平面素材打包/') || file.startsWith('红嘴鸥照片/'))
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
      ...[
        '--paper-image',
        '--blank-image',
        '--cover-image',
        '--logo-image',
        '--contents-image',
      ].map((key) => getComputedStyle(document.querySelector('.app-shell')!).getPropertyValue(key)),
    ].join('\n'),
  );
  for (const entry of manifest)
    expect(rendered, `未展示：${entry.source}`).toContain(`assets/${entry.asset}`);
  const photos = await page
    .locator('.album-photos img')
    .evaluateAll((images) => images.map((image) => image.getAttribute('data-src')));
  expect(new Set(photos).size).toBe(18);
  expect(await page.locator('.family-companions img').count()).toBe(3);
  expect(await page.locator('.page-artwork').count()).toBe(0);
});

test('场景背景保留原PNG像素，首页纸面来自指定的2号设计图', async () => {
  test.skip(!existsSync('红嘴鸥第一章'), 'CI只使用网页派生素材，本地核对原图像素');
  const original = (asset: string) =>
    path.join('红嘴鸥第一章', manifest.find((entry) => entry.asset === asset)!.source);
  const background = await sharp(original('notebook-blank.webp')).ensureAlpha().raw().toBuffer();
  const derivedBackground = await sharp('public/assets/notebook-scene.webp')
    .ensureAlpha()
    .raw()
    .toBuffer();
  expect(background.equals(derivedBackground)).toBe(true);
  const cover = await sharp(original('notebook-title.webp'))
    .extract({ left: 136, top: 418, width: 1240, height: 1835 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const derivedCover = await sharp('public/assets/notebook-title.webp')
    .ensureAlpha()
    .raw()
    .toBuffer();
  expect(cover.equals(derivedCover)).toBe(true);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px 首页直接用原封面，本章目录能跳转，18张照片完整显示且可放大`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('.flip-engine[data-ready="true"]').waitFor();
    await page.evaluate(async () => {
      const styles = getComputedStyle(document.querySelector('.app-shell')!);
      await Promise.all(
        ['--scene-image', '--cover-image'].map(async (key) => {
          const image = new Image();
          image.src = styles.getPropertyValue(key).trim().slice(5, -2);
          await image.decode();
        }),
      );
    });
    await expect(page.locator('.page-cover')).toHaveCSS('background-image', /notebook-title.webp/);
    await page.screenshot({ path: `test-results/cover-${viewport.width}.png` });
    await page.getByRole('button', { name: '翻开我们的故事' }).click();
    await expect(page.locator('.reading-position')).toContainText('目录');
    await page.screenshot({ path: `test-results/contents-${viewport.width}.png` });
    await page
      .getByRole('navigation', { name: '本章阅读目录' })
      .getByRole('button', { name: '汉江影像' })
      .click();
    await expect(page.locator('.reading-position')).toContainText('汉江影像');
    let spreads = 0;
    const total = await page.locator('.book-page').count();
    for (let i = 0; i < total; i++) {
      const current = page.locator('.book-page[aria-hidden="false"]');
      const kind = await current.getAttribute('data-page-kind');
      const previousId = await current.getAttribute('data-page-id');
      if (kind === 'album') {
        spreads++;
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
      }
      if (await page.getByRole('button', { name: '下一页', exact: true }).isDisabled()) break;
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect
        .poll(() => page.locator('.book-page[aria-hidden="false"]').getAttribute('data-page-id'))
        .not.toBe(previousId);
      await expect(page.locator('.book-page[aria-hidden="false"]')).toHaveAttribute(
        'data-motion-ready',
        'true',
      );
    }
    await expect(page.locator('.reading-position')).toContainText('合上日记');
    expect(spreads).toBe(9);
  });
}
