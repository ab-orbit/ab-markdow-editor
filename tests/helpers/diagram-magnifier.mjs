import { expect } from '@playwright/test';
import assert from 'node:assert/strict';

/** Exercise real hover and keyboard interactions against any of the three engines. */
export async function checkDiagramMagnifier(page, figure, screenshot) {
  await figure.scrollIntoViewIfNeeded();
  const drawing = figure.locator('[data-diagram-drawing]'), source = drawing.locator(':scope > svg');
  const original = await source.elementHandle();
  const timing = await figure.locator('output').getAttribute('aria-label');
  await figure.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true }).click();
  const button = figure.getByRole('button', { name: 'Desativar lupa do diagrama', exact: true });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  const id = await drawing.getAttribute('id');
  const lens = page.locator(`[data-diagram-magnifier="${id}"]`);
  const bounds = await source.boundingBox(); assert.ok(bounds);
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.5);
  await expect(lens).toBeVisible();
  assert.equal(await lens.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
  const enlarged = lens.locator(':scope > div > svg');
  const enlargedBounds = await enlarged.boundingBox();
  assert.ok(Math.abs(enlargedBounds.width / bounds.width - 2) < 0.02, 'the actual vector drawing is enlarged 2×');
  assert.ok(Math.abs(enlargedBounds.height / bounds.height - 2) < 0.02);
  await expect(enlarged).toContainText('NOTEBOOK');
  const before = await enlarged.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.5);
  await expect.poll(async () => (await enlarged.boundingBox()).x).not.toBe(before.x);
  await page.mouse.dblclick(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.5);
  await expect(page.getByLabel('Bancada Markdown')).not.toHaveAttribute('data-block-editing', 'true');
  assert.equal(await page.evaluate(() => getSelection()?.toString() || ''), '', 'inspection does not select diagram text');
  assert.equal(await original.evaluate(node => node.isConnected), true, 'hover retains the original SVG node');
  const afterTiming = await figure.locator('output').getAttribute('aria-label');
  assert.equal(afterTiming.replace(', em cache', ''), timing.replace(', em cache', ''), 'hover never reruns the renderer; a cached visibility refresh may update its label');
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('figure[data-diagram-engine] [id], [data-diagram-magnifier] [id]')].map(node => node.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  assert.deepEqual(duplicateIds, [], 'magnified definitions do not collide with original diagrams');
  const frame = await lens.boundingBox();
  assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= await page.evaluate(() => innerWidth) && frame.y + frame.height <= await page.evaluate(() => innerHeight));
  if (screenshot) await page.screenshot({ path: screenshot });
  await page.mouse.move(0, 0); await expect(lens).toBeHidden();
  // A previous double-click may already have focused the drawing; re-enter it
  // from the toolbar to exercise the actual keyboard-focus transition.
  await button.focus();
  await drawing.focus(); await expect(lens).toBeVisible();
  const keyboardBefore = await enlarged.boundingBox();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await enlarged.boundingBox()).x).not.toBe(keyboardBefore.x);
  await page.keyboard.press('Escape');
  await expect(lens).toHaveCount(0);
  await expect(figure.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await figure.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true }).click();
  await figure.getByRole('button', { name: 'Desativar lupa do diagrama', exact: true }).click();
  await expect(page.locator(`[data-diagram-magnifier="${id}"]`)).toHaveCount(0);
}
