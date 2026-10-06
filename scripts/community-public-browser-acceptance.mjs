// QR R14 current-head evidence trigger — parent e398ad59cdf62f8634251ffd3a55f942b970fb37; harness-only.\nimport assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = String(process.env.COMMUNITY_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const executablePath = process.env.CHROME_BIN;
assert(executablePath, 'CHROME_BIN is required');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const failures = [];
const publicResponses = [];

async function acceptPage(path, checks) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => failures.push(`${path} pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    if (/\/rest\/v1\/rpc\/community_search_public|\/functions\/v1\/community-public-query/.test(url)) {
      publicResponses.push({ path, url, status: response.status() });
      if (response.status() >= 400) failures.push(`${path} public request ${response.status()}: ${url}`);
    }
  });

  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${path} did not load successfully`);
  await checks(page);
  await page.close();
}

try {
  await acceptPage('/gallery/', async (page) => {
    assert.equal((await page.locator('h1').textContent())?.trim(), 'Gallery');
    assert.equal(await page.locator('.notice').count(), 0, 'Gallery rendered config-unavailable state');
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'Gallery rendered an error alert');
    await page.locator('.search input').fill('integration-public-smoke');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/community_search_public')),
      page.locator('.search button[type="submit"]').click()
    ]);
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'Gallery search rendered an error alert');
  });

  await acceptPage('/qa/', async (page) => {
    assert.equal((await page.locator('h1').textContent())?.trim(), 'Q&A');
    assert.equal(await page.locator('.notice').count(), 0, 'Q&A rendered config-unavailable state');
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'Q&A rendered an error alert');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/community_search_public')),
      page.locator('.tabs button').nth(1).click()
    ]);
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'Q&A Tips search rendered an error alert');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/functions/v1/community-public-query')),
      page.locator('.tabs button').nth(0).click()
    ]);
    assert.equal(await page.locator('[role="alert"]').count(), 0, 'Q&A Questions search rendered an error alert');
  });

  const galleryRpc = publicResponses.some((x) => x.path === '/gallery/' && x.url.includes('/rest/v1/rpc/community_search_public') && x.status < 400);
  const qaPublicRpc = publicResponses.some((x) => x.path === '/qa/' && x.url.includes('/functions/v1/community-public-query') && x.status < 400);
  const qaTipRpc = publicResponses.some((x) => x.path === '/qa/' && x.url.includes('/rest/v1/rpc/community_search_public') && x.status < 400);
  assert(galleryRpc, 'No successful anonymous Gallery public-search response was observed');
  assert(qaPublicRpc, 'No successful anonymous Q&A Questions response was observed');
  assert(qaTipRpc, 'No successful anonymous Q&A Tips response was observed');
  assert.deepEqual(failures, []);

  console.log(JSON.stringify({ ok: true, publicResponses }, null, 2));
} finally {
  await browser.close();
}
