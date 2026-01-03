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

describe.skipIf(!runE2E)('Popup E2E', () => {
  let context: TestContext;
  let popup: Page;

  beforeAll(async () => {
    context = await setupBrowser();
    popup = await context.getPopupPage();
  }, 60000);

  afterAll(async () => {
    if (context) {
      await teardownBrowser(context);
    }
  });

  it('should render query input', async () => {
    await waitForElement(popup, '[data-testid="query-input"]');
    const input = await popup.$('[data-testid="query-input"]');
    expect(input).not.toBeNull();
  });

  it('should render provider toggles', async () => {
    const chatgptToggle = await popup.$('[data-testid="provider-toggle-chatgpt"]');
    const claudeToggle = await popup.$('[data-testid="provider-toggle-claude"]');
    const geminiToggle = await popup.$('[data-testid="provider-toggle-gemini"]');

    expect(chatgptToggle).not.toBeNull();
    expect(claudeToggle).not.toBeNull();
    expect(geminiToggle).not.toBeNull();
  });

  it('should have submit button disabled when query is empty', async () => {
    const submitButton = await popup.$('[data-testid="submit-button"]');
    const isDisabled = await submitButton?.evaluate((el) =>
      (el as HTMLButtonElement).disabled
    );

    expect(isDisabled).toBe(true);
  });

  it('should enable submit button when query entered', async () => {
    await popup.type('[data-testid="query-input"]', 'Test query');

    const submitButton = await popup.$('[data-testid="submit-button"]');
    const isDisabled = await submitButton?.evaluate((el) =>
      (el as HTMLButtonElement).disabled
    );

    expect(isDisabled).toBe(false);
  });

  it('should toggle provider selection', async () => {
    // Click to deselect chatgpt
    await popup.click('[data-testid="provider-toggle-chatgpt"]');

    const toggle = await popup.$('[data-testid="provider-toggle-chatgpt"]');
    const classes = await toggle?.evaluate((el) => el.className);

    expect(classes).not.toContain('selected');

    // Click to re-select
    await popup.click('[data-testid="provider-toggle-chatgpt"]');

    const classesAfter = await toggle?.evaluate((el) => el.className);
    expect(classesAfter).toContain('selected');
  });
});
