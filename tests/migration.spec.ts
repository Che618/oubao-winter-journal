import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px 原地图分层完整，海鸥与六个地标能拖动、放大、复位且不误翻页`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('.flip-engine[data-ready="true"]').waitFor();
    await page.getByRole('button', { name: '打开全书目录' }).click();
    await page
      .locator('.section-tabs')
      .getByRole('button', { name: '来时的路', exact: true })
      .click();
    const active = page.locator('.book-page[aria-hidden="false"]');
    const position = await page.locator('.reading-position').textContent();
    await expect(active.locator('.migration-board')).toHaveCount(1);
    await expect(active.locator('.migration-board')).toBeVisible();
    await expect
      .poll(() =>
        active
          .locator('.migration-board img')
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await expect(active.locator('.migration-point')).toHaveCount(6);
    await expect(active.locator('.journey-path')).toHaveCount(0);
    const layout = await active.locator('.migration-inner').evaluate((element) => ({
      clipped: element.scrollHeight > element.clientHeight + 1,
      boardWidth: element.querySelector('.migration-board')!.getBoundingClientRect().width,
    }));
    expect(layout.clipped).toBe(false);
    expect(layout.boardWidth).toBeGreaterThan(100);
    await page.screenshot({ path: `test-results/migration-${viewport.width}.png` });
    const gull = active.getByRole('button', { name: '拖动海鸥探索迁徙路线' });
    const initial = await gull.getAttribute('style');
    const box = await gull.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 10, box!.y + box!.height / 2 + 80, {
      steps: 10,
    });
    await page.mouse.up();
    expect(await gull.getAttribute('style')).not.toBe(initial);
    await expect(page.locator('.reading-position')).toHaveText(position!);
    await active.getByRole('button', { name: '放大操作' }).click();
    const dialog = page.getByRole('dialog', { name: '放大迁徙地图' });
    await expect(dialog).toBeVisible();
    const landmark = dialog.getByRole('button', { name: '拖动地点：西伯利亚', exact: true });
    await landmark.scrollIntoViewIfNeeded();
    const pointStyle = await landmark.getAttribute('style');
    const pointBox = await landmark.boundingBox();
    await page.mouse.move(pointBox!.x + pointBox!.width / 2, pointBox!.y + pointBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      pointBox!.x + pointBox!.width / 2 + 40,
      pointBox!.y + pointBox!.height / 2 + 15,
      { steps: 5 },
    );
    await page.mouse.up();
    expect(await landmark.getAttribute('style')).not.toBe(pointStyle);
    await expect(dialog.locator('.migration-detail')).toContainText('西伯利亚');
    for (const label of ['内蒙古自治区', '宁夏沙湖', '延安·延河', '西安', '汉中·汉江']) {
      const point = dialog.getByRole('button', { name: `拖动地点：${label}`, exact: true });
      await point.scrollIntoViewIfNeeded();
      const original = await point.getAttribute('style');
      const rect = await point.boundingBox();
      await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
      await page.mouse.down();
      await page.mouse.move(rect!.x + rect!.width / 2 - 30, rect!.y + rect!.height / 2, {
        steps: 4,
      });
      await page.mouse.up();
      expect(await point.getAttribute('style')).not.toBe(original);
      await expect(dialog.locator('.migration-detail')).toContainText(label);
    }
    await page.screenshot({ path: `test-results/migration-expanded-${viewport.width}.png` });
    await page.getByRole('button', { name: '关闭放大地图' }).click();
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(() =>
        active
          .locator('.migration-base')
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await active.getByRole('button', { name: '还原位置' }).click();
    expect(await gull.getAttribute('style')).toBe(initial);
    await expect(active.locator('.migration-note')).toContainText('路线示意');
    // 键盘也能选择与移动，保持书页本身不动。
    const xian = active.getByRole('button', { name: '拖动地点：西安', exact: true });
    const before = await xian.getAttribute('style');
    await xian.focus();
    await xian.press('ArrowRight');
    expect(await xian.getAttribute('style')).not.toBe(before);
    await expect(active.locator('.migration-inner .migration-detail')).toContainText('西安');
    await expect(page.locator('.reading-position')).toHaveText(position!);
  });
}

test('触屏拖动地图海鸥时，不触发书本翻页', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.flip-engine[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: '打开全书目录' }).click();
  await page
    .locator('.section-tabs')
    .getByRole('button', { name: '来时的路', exact: true })
    .click();
  const gull = page.getByRole('button', { name: '拖动海鸥探索迁徙路线' });
  const before = await gull.getAttribute('style');
  const box = await gull.boundingBox();
  const session = await context.newCDPSession(page);
  const x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 5; i++)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + i * 8, y: y + i * 10 }],
    });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await gull.getAttribute('style')).not.toBe(before);
  await expect(page.locator('.reading-position')).toContainText('来时的路');
  await page.getByRole('button', { name: '放大操作' }).click();
  const scroller = page.locator('.migration-expanded');
  const viewport = await scroller.boundingBox();
  const startX = viewport!.x + viewport!.width - 45,
    startY = viewport!.y + 45;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let i = 1; i <= 6; i++)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX - i * 20, y: startY }],
    });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('.reading-position')).toContainText('来时的路');
});
