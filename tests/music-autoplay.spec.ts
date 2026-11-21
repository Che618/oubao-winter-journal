import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test('浏览器允许自动播放时，无需点击、仍在封面时即播放压缩音频', async ({ page }) => {
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  const audio = page.locator('.background-music');
  await expect
    .poll(() => audio.evaluate((el) => (el as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '翻开我们的故事' })).toBeVisible();
  await expect(page.getByRole('button', { name: '背景音乐' })).toContainText('音乐开');
  await page.getByRole('button', { name: '背景音乐' }).click();
  await page.mouse.click(8, 42);
  expect(await audio.evaluate((el) => (el as HTMLAudioElement).paused)).toBe(true);
});
