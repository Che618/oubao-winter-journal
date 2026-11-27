import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  await expect(page.getByRole('button', { name: '翻开我们的故事' })).toBeVisible();
}
async function goTo(page: Page, section: string) {
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await page.locator('.section-tabs').getByRole('button', { name: section, exact: true }).click();
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
}

test('动态模式翻页后可读，可暂停并记住偏好，系统减少动态即时生效', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  const toggle = page.getByRole('button', { name: '装饰动效' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await expect(page.locator('.reading-position')).toContainText('目录');
  await expect(page.locator('.page-contents')).toHaveAttribute('data-motion-ready', 'true');
  await goTo(page, '认识鸥宝');
  await expect
    .poll(() =>
      page
        .locator('.intro-composition > img')
        .evaluate((el) =>
          el.getAnimations().some((animation) => animation.playState === 'running'),
        ),
    )
    .toBe(true);
  await goTo(page, '日记');
  await expect
    .poll(() =>
      page
        .locator('.book-page[aria-hidden="false"] .prose')
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('1');
  const position = await page.locator('.reading-position').textContent();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.reading-position')).toHaveText(position!);
  await expect
    .poll(() =>
      page
        .locator('.landscape-background')
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
    )
    .toBe(0);
  await page.reload();
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toBeDisabled();
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await expect(page.locator('.reading-position')).toContainText('目录');
  expect(errors).toEqual([]);
});

test('按顺序翻开、滑动和返回；目录只开放已上线章节', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole('button', { name: '翻开我们的故事' }).click();
  await expect(page.locator('.reading-position')).toContainText('目录');
  await expect(
    page.getByRole('navigation', { name: '本章阅读目录' }).getByRole('button'),
  ).toHaveCount(6);
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await expect(page.locator('.drawer-chapter:disabled')).toHaveCount(7);
  await page.getByRole('button', { name: '关闭目录' }).click();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('.reading-position')).toContainText('认识鸥宝');
  const box = await page.locator('.book-size').boundingBox();
  await page.mouse.move(box!.x + box!.width - 45, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 45, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.reading-position')).toContainText('日记');
  await page.getByRole('button', { name: '上一页', exact: true }).click();
  await expect(page.locator('.reading-position')).toContainText('认识鸥宝');
  await goTo(page, '影像日记');
  await expect(page.locator('[aria-hidden="false"] video')).toHaveAttribute(
    'src',
    /chapter-01\/vlog.mp4$/,
  );
  await expect(page.locator('[aria-hidden="false"] .ai-disclosure')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 1440, height: 1000 },
]) {
  test(`${viewport.width}×${viewport.height} 正文不丢字、不超页；图片可放大`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    const report = await page.evaluate(async () => {
      // 导入实际章节数据，对比分页后的全部正文，防止长段落切分丢失文字。
      const { default: chapter } = await import('/src/content/chapters/chapter-01.ts' as string);
      const normalized = (text: string) => text.replace(/\s/g, '');
      const text = (selector: string) =>
        Array.from(document.querySelectorAll(selector))
          .map((el) => el.textContent)
          .join('');
      const article = chapter.article.blocks
        .filter((b: { type: string }) => b.type === 'paragraph')
        .map((b: { text: string }) => b.text)
        .join('');
      const originalParagraphs = chapter.article.blocks
        .filter((block: { type: string }) => block.type === 'paragraph')
        .map((block: { text: string }) => block.text);
      let sourceIndex = 0,
        offset = 0,
        continuations = 0;
      const indentErrors: string[] = [];
      for (const element of document.querySelectorAll('.article-flow [data-source-paragraph]')) {
        const text = element.textContent ?? '';
        const continued = offset > 0;
        const marked = element.getAttribute('data-continued') === 'true';
        const indent = parseFloat(getComputedStyle(element).textIndent);
        if (
          originalParagraphs[sourceIndex]?.slice(offset, offset + text.length) !== text ||
          marked !== continued ||
          (continued ? indent !== 0 : indent <= 0)
        )
          indentErrors.push(text.slice(0, 20));
        if (continued) continuations++;
        offset += text.length;
        if (offset === originalParagraphs[sourceIndex]?.length) {
          sourceIndex++;
          offset = 0;
        }
      }
      const clipped = Array.from(document.querySelectorAll('.flow-inner')).filter((inner) => {
        const last = inner.querySelector('.prose')?.lastElementChild;
        if (!last) return false;
        // 非当前页受库隐藏；先仅检测有布局的页，所有页在下面逐页检测。
        if (!inner.getBoundingClientRect().height) return false;
        return (
          last.getBoundingClientRect().bottom >
          inner.getBoundingClientRect().bottom -
            parseFloat(getComputedStyle(inner).paddingBottom) +
            1
        );
      }).length;
      return {
        articleMatches:
          normalized(text('.article-flow [data-source-paragraph]')) === normalized(article),
        diaryMatches:
          normalized(text('.diary-flow [data-source-paragraph]')) ===
          normalized([...chapter.diary.paragraphs, chapter.diary.signature].join('')),
        clipped,
        width: document.documentElement.scrollWidth,
        indentErrors,
        continuations,
      };
    });
    expect(report.articleMatches).toBe(true);
    expect(report.diaryMatches).toBe(true);
    expect(report.indentErrors).toEqual([]);
    expect(await page.locator('.book-page[data-page-kind="flow"] .diary-flow').count()).toBe(1);
    expect(report.clipped).toBe(0);
    expect(report.width).toBeLessThanOrEqual(viewport.width);
    // 逐页检查真正显示的正文，防止隐藏页的零尺寸掩盖溢出。
    await goTo(page, '日记');
    const diaryPage = page.locator('.book-page[aria-hidden="false"] .diary-flow');
    await expect(diaryPage.locator('[data-source-paragraph]')).toHaveCount(
      await page.evaluate(async () => {
        const { default: chapter } = await import('/src/content/chapters/chapter-01.ts' as string);
        return chapter.diary.paragraphs.length + 1;
      }),
    );
    const footerBeforeScroll = await page
      .locator('.book-page[aria-hidden="false"] .page-footer')
      .boundingBox();
    const scrollBefore = await diaryPage.evaluate((element) => element.scrollTop);
    const diaryBox = await diaryPage.boundingBox();
    await page.mouse.move(diaryBox!.x + diaryBox!.width / 2, diaryBox!.y + diaryBox!.height / 2);
    await page.mouse.wheel(0, 480);
    await expect
      .poll(() => diaryPage.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(scrollBefore);
    await diaryPage.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    expect(await diaryPage.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollBefore);
    await expect(diaryPage.locator('[data-source-paragraph]').last()).toBeVisible();
    const footerAfterScroll = await page
      .locator('.book-page[aria-hidden="false"] .page-footer')
      .boundingBox();
    expect(footerAfterScroll!.y).toBeCloseTo(footerBeforeScroll!.y, 0);
    await diaryPage.evaluate((element) => element.scrollTo({ top: 0 }));
    await goTo(page, '江边剪报');
    const articlePages = await page.locator('.book-page').count();
    await expect(
      page.locator('.book-page[data-page-kind="flow"][data-page-id*="-article-"]'),
    ).toHaveCount(1);
    for (let i = 0; i < articlePages; i++) {
      const currentPage = page.locator('.book-page[aria-hidden="false"]');
      if (
        (await currentPage.getAttribute('data-page-kind')) !== 'flow' ||
        !(await currentPage.getAttribute('data-page-id'))?.includes('-article-')
      )
        break;
      const article = currentPage.locator('.article-flow');
      await expect(article).toHaveCSS('overflow-y', 'auto');
      const beginning = await article.evaluate((element) => element.scrollTop);
      await expect(article.locator('.prose .reader-figure')).toHaveCount(4);
      await expect
        .poll(() =>
          article
            .locator('.prose .reader-figure img')
            .evaluateAll((images) =>
              images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
            ),
        )
        .toBe(true);
      await article.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      expect(await article.evaluate((element) => element.scrollTop)).toBeGreaterThan(beginning);
      await expect(article.locator('.prose > p').last()).toBeVisible();
      await expect(currentPage.getByRole('button', { name: '上滑，继续读' })).toBeHidden();
      await article.evaluate((element) => element.scrollTo({ top: 0 }));
      await expect(currentPage.getByRole('button', { name: '上滑，继续读' })).toBeVisible();
      break;
    }
    await goTo(page, '鸟瞰汉江');
    const img = page.locator('.book-page[aria-hidden="false"] .aerial-photo img');
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: '放大汉江鸟瞰照片' }).click();
    await expect(page.getByRole('dialog', { name: '照片查看器' })).toBeVisible();
    await page.getByRole('button', { name: '关闭照片' }).click();
    await page.screenshot({ path: `test-results/aerial-${viewport.width}.png` });
    await goTo(page, '鸟瞰汉江');
    await expect(page.locator('.panorama-note')).not.toContainText('360°鸟瞰体验，待更新');
  });
}

test('章末引导到公众号评论区，网页不提供留言表单并可恢复阅读位置', async ({ page }) => {
  await ready(page);
  await goTo(page, '江边悄悄话');
  await expect(
    page.locator('.book-page[aria-hidden="false"] .wechat-comment-invitation'),
  ).toContainText('在文末评论区');
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '把回信收进日记' })).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('letter:'))),
  ).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: '继续上次的阅读' }).click();
  await expect(page.locator('.reading-position')).toContainText('江边悄悄话');
  await expect(
    page.locator('.book-page[aria-hidden="false"] .wechat-comment-invitation'),
  ).toContainText('微信公众号文章');
});

test('改变屏幕尺寸保持阅读区域，重建翻书实例不报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await goTo(page, '江边剪报');
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.reading-position')).toContainText('江边剪报');
    await expect(page.locator('.book-page[aria-hidden="false"] .flow-title')).toHaveText(
      '西伯利亚的朋友，又来啦！',
    );
  }
  await goTo(page, '鸟瞰汉江');
  await expect(page.locator('.reading-position')).toContainText('鸟瞰汉江');
  expect(errors).toEqual([]);
});

test('只新增章节配置即可切换第二章，并复用小课堂与公众号留言引导', async ({ page }) => {
  await page.route(/\/src\/content\/chapters\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'status: "upcoming"',
      'status: "published", load: () => import("/tests/fixtures/chapter-02.ts")',
    );
    await route.fulfill({ response, body });
  });
  await ready(page);
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await page.locator('.drawer-chapter').filter({ hasText: '汇群' }).click();
  await expect(page.locator('.book-page[aria-hidden="false"] h2')).toHaveText('第二章测试开篇');
  await goTo(page, '日记');
  await expect(page.locator('.book-page[aria-hidden="false"] h2')).toHaveText('第二章测试日记');
  await goTo(page, '和鸥宝一起玩');
  await page.getByRole('button', { name: '第一项', exact: true }).click();
  await expect(page.locator('.quiz-feedback')).toContainText('答对啦');
  await goTo(page, '江边悄悄话');
  await expect(
    page.locator('.book-page[aria-hidden="false"] .wechat-comment-invitation'),
  ).toContainText('微信公众号文章');
  await expect(page.locator('textarea')).toHaveCount(0);
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await page.locator('.drawer-chapter').filter({ hasText: '先至' }).click();
  await expect(page.locator('.book-page[aria-hidden="false"] h2')).toHaveText('鸥宝！');
  await goTo(page, '江边悄悄话');
  await expect(
    page.locator('.book-page[aria-hidden="false"] .wechat-comment-invitation'),
  ).toContainText('微信公众号文章');
});
