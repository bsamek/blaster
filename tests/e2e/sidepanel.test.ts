import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupBrowser,
  teardownBrowser,
  TestContext,
  waitForElement,
} from './setup/puppeteer.config';
import type { Page } from 'puppeteer';

// Skip E2E tests in CI or when extension isn't built
const runE2E = process.env.RUN_E2E === 'true';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!runE2E)('Side Panel E2E', () => {
  let context: TestContext;
  let sidePanel: Page;

  beforeAll(async () => {
    context = await setupBrowser();
    sidePanel = await context.getSidePanelPage();
  }, 60000);

  afterAll(async () => {
    if (context) {
      await teardownBrowser(context);
    }
  });

  it('should render header', async () => {
    await waitForElement(sidePanel, 'h1');
    const headerText = await sidePanel.$eval('h1', (el) => el.textContent);
    expect(headerText).toBe('AI Blaster');
  });

  it('should render tab buttons', async () => {
    // Check that we have at least the three tabs we expect
    const tabs = await sidePanel.$$('.tab-button');
    expect(tabs.length).toBe(3);
  });

  it('should show empty state when no queries', async () => {
    await waitForElement(sidePanel, '.empty-state');
    const emptyStateText = await sidePanel.$eval(
      '.empty-state-title',
      (el) => el.textContent
    );
    expect(emptyStateText).toContain('No active queries');
  });

  it('should switch tabs', async () => {
    // Click History tab
    const historyTab = await sidePanel.$('.tab-button:nth-child(2)');
    await historyTab?.click();
    await sleep(300);

    // Check empty state for history
    const emptyState = await sidePanel.$('.empty-state');
    expect(emptyState).not.toBeNull();

    // Click Stats tab
    const statsTab = await sidePanel.$('.tab-button:nth-child(3)');
    await statsTab?.click();
    await sleep(300);

    // Check stats grid is visible
    const statsGrid = await sidePanel.$('.stats-grid');
    expect(statsGrid).not.toBeNull();
  });

  it('should show stats with zero values initially', async () => {
    // Navigate to stats tab
    const statsTab = await sidePanel.$('.tab-button:nth-child(3)');
    await statsTab?.click();
    await sleep(300);

    // Check total queries
    const totalQueries = await sidePanel.$eval(
      '.stat-card:first-child .stat-value',
      (el) => el.textContent
    );
    expect(totalQueries).toBe('0');
  });
});
