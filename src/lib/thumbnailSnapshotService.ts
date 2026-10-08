import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

// In-flight generation promises to avoid duplicate simultaneous renders
const inFlightSnapshots = new Map<string, Promise<Buffer | null>>();

/**
 * Locate Chrome or Edge executable on the machine
 */
export function getChromiumExecutablePath(): string | null {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidatePaths = [
    // Windows Chrome & Edge
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

export function getCacheDir(): string {
  const publicDir = path.join(process.cwd(), 'public', 'thumbnails');
  if (fs.existsSync(publicDir)) {
    return publicDir;
  }
  const cacheDir = path.join(process.cwd(), '.cache', 'thumbnails');
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(publicDir, { recursive: true });
      return publicDir;
    } catch {
      fs.mkdirSync(cacheDir, { recursive: true });
      return cacheDir;
    }
  }
  return cacheDir;
}

/**
 * Captures a full rendered snapshot of a GitHub template using Headless Browser
 */
export async function captureTemplateSnapshot(
  owner: string,
  repo: string,
  forceFresh = false
): Promise<Buffer | null> {
  const cacheKey = `${owner}_${repo}`.toLowerCase();
  
  // 1. Check public static directory first (synced with git, ultra-fast & works on Vercel)
  const publicFile = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);
  const cacheFile = path.join(process.cwd(), '.cache', 'thumbnails', `${cacheKey}.jpg`);
  const targetFile = fs.existsSync(publicFile) ? publicFile : cacheFile;

  if (!forceFresh && fs.existsSync(targetFile)) {
    try {
      const stats = await fs.promises.stat(targetFile);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      // Valid for 7 days
      if (ageHours < 168 && stats.size > 1000) {
        return await fs.promises.readFile(targetFile);
      }
    } catch {
      // Ignore cache read error and re-generate
    }
  }

  // 2. Prevent duplicate concurrent runs for the same repo
  if (inFlightSnapshots.has(cacheKey)) {
    return inFlightSnapshots.get(cacheKey)!;
  }

  const task = (async (): Promise<Buffer | null> => {
    const executablePath = getChromiumExecutablePath();
    if (!executablePath) {
      console.warn('Chromium executable not found, skipping headless snapshot');
      return null;
    }

    let browser: any = null;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1280,800',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

      // Target the internal GitHub preview route that serves HTML & assets
      const port = process.env.PORT || '3000';
      const targetUrl = `http://localhost:${port}/api/github/preview/${owner}/${repo}/index.html`;

      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      });

      // Automatically click any entrance / start celebration buttons if present to reveal main content
      await page.evaluate(() => {
        const selectors = [
          '#diveInBtn',
          '#enterSiteBtn',
          '.gold-button',
          '.sponge-primary-btn',
          '.btn-primary',
          '#start-btn',
          '#startBtn',
          '#openBtn',
          '.entrance-overlay button',
          '.gate-overlay button',
          '#entranceModal button',
          '[data-action="enter"]',
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel) as HTMLElement;
          if (btn && typeof btn.click === 'function') {
            btn.click();
            break;
          }
        }
      });

      // Small delay to ensure CSS transitions, web fonts, and title typography are settled
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 85,
        clip: {
          x: 0,
          y: 0,
          width: 1280,
          height: 800,
        },
      });

      const buffer = Buffer.from(screenshotBuffer);

      // Save to public static directory and local cache
      fs.promises.writeFile(publicFile, buffer).catch(() => {});
      fs.promises.writeFile(cacheFile, buffer).catch((err) => {
        console.warn('Failed to write thumbnail cache:', err);
      });

      return buffer;
    } catch (err: any) {
      console.error(`Headless snapshot failed for ${owner}/${repo}:`, err.message || err);
      return null;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
      inFlightSnapshots.delete(cacheKey);
    }
  })();

  inFlightSnapshots.set(cacheKey, task);
  return task;
}
