type MutationCallback = (mutations: MutationRecord[]) => void;

export class DOMObserver {
  private observer: MutationObserver | null = null;
  private callback: MutationCallback | null = null;

  observe(
    target: Node,
    options: MutationObserverInit,
    callback: MutationCallback
  ): void {
    this.disconnect();

    this.callback = callback;
    this.observer = new MutationObserver((mutations) => {
      if (this.callback) {
        this.callback(mutations);
      }
    });

    this.observer.observe(target, options);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.callback = null;
  }
}

export async function waitForElement(
  selector: string,
  timeout = 10000,
  root: ParentNode = document
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = root.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root instanceof Document ? root.body : root, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

export async function waitForElementRemoval(
  selector: string,
  timeout: number,
  root: ParentNode = document
): Promise<void> {
  return new Promise((resolve, reject) => {
    const element = root.querySelector(selector);
    if (!element) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (!el) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(root instanceof Document ? root.body : root, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element removal: ${selector}`));
    }, timeout);
  });
}
