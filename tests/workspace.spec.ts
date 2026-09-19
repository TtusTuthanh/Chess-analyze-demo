import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function importPgn(page: Page, text: string) {
  await page.getByRole('button', { name: 'Import PGN', exact: true }).click();
  await page.getByRole('textbox', { name: 'PGN text', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
}
test('real Stockfish WASM runs and navigation cancels stale searches', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.evaluation-score strong')).not.toHaveText('—', { timeout: 20_000 });
  await expect(page.locator('.engine-status')).toHaveText('Ready', { timeout: 20_000 });
  await expect(page.locator('.classification')).toBeVisible();
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  await expect(page.getByRole('button', { name: 'e2 white pawn', exact: true })).toBeVisible();
  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'e4 white pawn', exact: true })).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('.position-tag')).toHaveText('17. Rd8#');
  await expect(page.locator('.evaluation-score strong')).toHaveText('+M0', { timeout: 20_000 });
  expect(errors).toEqual([]);
});
test('invalid PGN is recoverable, annotations and nested variations export', async ({ page }) => {
  await page.goto('/');
  await importPgn(page, '1.e4 e5\n2.Nf3 Qz9');
  await expect(page.getByRole('alert')).toContainText('Line 2 · “Qz9”');
  await page
    .getByRole('textbox', { name: 'PGN text', exact: true })
    .fill('[Event "Roundtrip"]\n[Custom "preserved"]\n1.e4 e5 (1...c5 2.Nf3 (2.Nc3)) 2.Nf3 *');
  await page.getByRole('button', { name: 'Import game', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await page.getByRole('textbox', { name: 'Move comment' }).fill('Control the center.');
  await page.getByRole('button', { name: '!', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Variation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Variation moves' }).fill('c6 d4 d5');
  await page.getByRole('button', { name: 'Add variation', exact: true }).click();
  await expect(page.locator('.position-tag')).toHaveText('2... d5');
  await page.getByRole('button', { name: 'Export game', exact: true }).click();
  const pgn = await page.getByRole('textbox', { name: 'Exported PGN' }).inputValue();
  expect(pgn).toContain('[Custom "preserved"]');
  expect(pgn).toContain('$1 {Control the center.}');
  expect(pgn).toContain('(1... c6 2. d4 2... d5)');
  expect(pgn).toContain('(2. Nc3)');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PGN', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('annotated-game.pgn');
  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save project as JSON', exact: true }).click();
  const file = await (await projectDownload).path();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Import PGN', exact: true }).click();
  await page
    .getByLabel('Upload PGN or project')
    .setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: await (await import('node:fs/promises')).readFile(file!),
    });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.position-tag')).toHaveText('2... d5');
  await expect(page.locator('.moves-scroll')).toContainText('Control the center.');
});
test('drawings, cancel and undo work and persist as standard PGN directives', async ({ page }) => {
  await page.goto('/');
  const from = page.locator('[data-square="e2"]'),
    to = page.locator('[data-square="e4"]');
  const f = (await from.boundingBox())!,
    t = (await to.boundingBox())!;
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await page.locator('[data-square="f7"]').click({ button: 'right' });
  await expect(page.locator('.square-highlight')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('textbox', { name: 'Move comment' }).fill('Discard me');
  await page.getByRole('button', { name: 'Cancel changes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Move comment' })).toHaveValue('');
  await page.getByRole('button', { name: 'Export game', exact: true }).click();
  const pgn = await page.getByRole('textbox', { name: 'Exported PGN' }).inputValue();
  expect(pgn).toContain('[%cal Ge2e4]');
  expect(pgn).toContain('[%csl Gf7]');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('heading', { level: 1 }).click();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.square-highlight')).toHaveCount(0);
});
test('whole-game analysis and reports use actual cached evaluations', async ({ page }) => {
  await page.goto('/');
  await importPgn(page, '1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 *');
  await page.getByRole('button', { name: 'Analyze entire game', exact: true }).click();
  await expect(page.locator('.progress-caption')).toHaveText('7 / 7 positions · done', {
    timeout: 40_000,
  });
  await page.getByRole('button', { name: 'View game report' }).click();
  await expect(page.locator('.accuracy-cards')).not.toContainText('—');
  await expect(page.locator('.report-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the board' }).click();
  await page.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(page.locator('.classification')).toBeVisible();
});
test('pause/resume, MultiPV and project restore', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyze entire game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause game analysis' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause game analysis' }).click();
  await expect(page.getByRole('button', { name: 'Resume game analysis' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume game analysis' }).click();
  await expect(page.locator('.progress-caption')).toHaveText('34 / 34 positions · done', {
    timeout: 35_000,
  });
  await page.getByRole('combobox', { name: 'MultiPV' }).selectOption('3');
  await page.getByRole('button', { name: 'Analyze current position', exact: true }).click();
  await expect(page.locator('.pv-line')).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator('.engine-status')).toHaveText('Ready', { timeout: 30_000 });
  await page.getByRole('textbox', { name: 'Move comment' }).fill('Project restoration test');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.workspace-footer')).toContainText('Saved on this device');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Move comment' })).toHaveValue(
    'Project restoration test',
  );
  await expect(page.getByRole('combobox', { name: 'MultiPV' })).toHaveValue('3');
});
test('mobile panels, legal board moves and dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'First move', exact: true }).click();
  await page.getByRole('button', { name: 'e2 white pawn', exact: true }).click();
  await page.getByRole('button', { name: 'e4', exact: true }).click();
  await expect(page.getByRole('button', { name: 'e4 white pawn', exact: true })).toBeVisible();
  await page.locator('.mobile-tabs').getByRole('button', { name: 'moves', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Move comment' })).toBeVisible();
  await page.locator('.mobile-tabs').getByRole('button', { name: 'analysis', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Analyze entire game', exact: true }),
  ).toBeVisible();
});
