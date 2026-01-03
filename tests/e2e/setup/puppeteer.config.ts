import puppeteer, { Browser, Page } from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = resolve(__dirname, '../../../dist');

export interface TestContext {
  browser: Browser;
  extensionId: string;
  getPopupPage: () => Promise<Page>;
  getSidePanelPage: () => Promise<Page>;
  getOptionsPage: () => Promise<Page>;
}

export async function setupBrowser(): Promise<TestContext> {
  const browser = await puppeteer.launch({
    headless: false, // Extensions require non-headless mode (or new headless)
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  // Wait for service worker to register and get extension ID
  const serviceWorkerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === 'service_worker' &&
      target.url().includes('chrome-extension://'),
    { timeout: 30000 }
  );

  const extensionId = serviceWorkerTarget.url().split('/')[2];

  return {
    browser,
    extensionId,

    getPopupPage: async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
        waitUntil: 'networkidle0',
      });
      return page;
    },

    getSidePanelPage: async () => {
      const page = await browser.newPage();
      await page.goto(
        `chrome-extension://${extensionId}/src/sidepanel/index.html`,
        {
          waitUntil: 'networkidle0',
        }
      );
      return page;
    },

    getOptionsPage: async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/options/index.html`, {
        waitUntil: 'networkidle0',
      });
      return page;
    },
  };
}

export async function teardownBrowser(context: TestContext): Promise<void> {
  await context.browser.close();
}

export async function waitForElement(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

export async function clickAndWait(
  page: Page,
  selector: string,
  waitTime = 500
): Promise<void> {
  await page.click(selector);
  await new Promise((r) => setTimeout(r, waitTime));
}
