import type {Locator, Page, PageScreenshotOptions } from '@playwright/test';
import { expect } from '@playwright/test';

export const screenshotStable = (
  locatorOrPage: Locator | Page,
  name: string,
  opts: Partial<PageScreenshotOptions> = {},
) =>
  expect(locatorOrPage).toHaveScreenshot(name, {
    animations: 'disabled',
    scale: 'css',
    ...opts,
  });
