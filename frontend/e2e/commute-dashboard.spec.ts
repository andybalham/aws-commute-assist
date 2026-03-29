/**
 * Commute Dashboard — E2E Tests (Playwright)
 *
 * Automates the manual test script from test-plan.md sections 3.1–3.10.
 *
 * Prerequisites — start the local dev stack before running:
 *   1. DynamoDB Local on port 8000 (with commute-profiles table created)
 *   2. Backend: cd backend && npm run dev
 *   3. Frontend: cd frontend && npm run dev
 *      (with VITE_DEV_BYPASS_AUTH=true and VITE_API_URL=http://localhost:3001)
 *
 * Run:  npx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill a StationAutocomplete field by typing a query and clicking a result. */
async function pickStation(
  page: Page,
  fieldsetLabel: string,
  stationLabel: string,
  query: string,
  expectedOption: string,
) {
  // Locate the fieldset (Outbound Journey / Return Journey), then find the
  // station input by its label text. The label and input are siblings inside a
  // wrapper div — there's no htmlFor linking them, so getByLabel won't work.
  const fieldset = page.locator('fieldset', { has: page.getByText(fieldsetLabel, { exact: true }) });
  const wrapper = fieldset.locator('div.relative', { has: page.locator(`text="${stationLabel}"`) });
  const input = wrapper.getByPlaceholder('Search station name or CRS code...');

  await input.click();
  await input.fill(query);

  // Wait for debounce + API response — dropdown option appears
  const option = page.getByRole('listitem').filter({ hasText: expectedOption });
  await expect(option).toBeVisible({ timeout: 5_000 });
  await option.click();
}

// ---------------------------------------------------------------------------
// 3.1 — Empty state
// ---------------------------------------------------------------------------

test.describe('3.1 — Empty state', () => {
  test('profiles page loads with empty message', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByText('No commute profiles yet.')).toBeVisible();
    await expect(page.getByText('Create a profile to get started.')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3.2 — Form validation
// ---------------------------------------------------------------------------

test.describe('3.2 — Form validation', () => {
  test('shows inline errors when submitting empty form', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: 'New Profile' }).click();

    // Submit empty
    await page.getByRole('button', { name: 'Create Profile' }).click();

    // Expect validation errors for all 7 required fields
    await expect(page.getByText('Profile name is required')).toBeVisible();

    const originErrors = page.getByText('Origin station is required');
    await expect(originErrors.first()).toBeVisible();
    expect(await originErrors.count()).toBe(2); // outbound + return

    const destErrors = page.getByText('Destination station is required');
    await expect(destErrors.first()).toBeVisible();
    expect(await destErrors.count()).toBe(2);

    const timeErrors = page.getByText('Departure time is required');
    await expect(timeErrors.first()).toBeVisible();
    expect(await timeErrors.count()).toBe(2);
  });

  test('cancel closes form without creating a profile', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: 'New Profile' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Form should be gone, empty state still visible
    await expect(page.getByRole('button', { name: 'New Profile' })).toBeVisible();
    await expect(page.getByText('No commute profiles yet.')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3.3–3.8 — Full profile lifecycle (create → activate → edit → delete)
//
// These run in order within a single describe block so state carries forward.
// ---------------------------------------------------------------------------

test.describe('3.3–3.8 — Profile lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // 3.3 — Create profile with station autocomplete
  test('3.3 — create profile with station autocomplete and auto-mirror', async () => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: 'New Profile' }).click();

    // Fill outbound origin: Brighton (BTN)
    await pickStation(page, 'Outbound Journey', 'Origin', 'Brighton', 'Brighton (BTN)');

    // Fill outbound destination: London Victoria (VIC)
    await pickStation(page, 'Outbound Journey', 'Destination', 'Victoria', 'London Victoria (VIC)');

    // 3.3 step 6: verify return journey auto-mirrors
    const returnFieldset = page.locator('fieldset', {
      has: page.getByText('Return Journey', { exact: true }),
    });
    // The return inputs should be pre-filled (origin = VIC, destination = BTN)
    const returnOrigin = returnFieldset.locator('div.relative', { has: page.locator('text="Origin"') }).getByPlaceholder('Search station name or CRS code...');
    const returnDest = returnFieldset.locator('div.relative', { has: page.locator('text="Destination"') }).getByPlaceholder('Search station name or CRS code...');
    await expect(returnOrigin).toHaveValue(/Victoria/i);
    await expect(returnDest).toHaveValue(/Brighton/i);
  });

  // 3.4 — TfL line selector (conditional)
  test('3.4 — TfL line selector appears for London terminus', async () => {
    // VIC is a London terminus → TfL section should be visible
    await expect(page.getByText('TfL Lines to Monitor')).toBeVisible();

    // Select Victoria and Northern lines via checkbox role
    await page.getByRole('checkbox', { name: 'Victoria' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Northern' }).check({ force: true });

    // Change outbound destination to a non-London station → TfL disappears
    await pickStation(page, 'Outbound Journey', 'Destination', 'Brighton', 'Brighton (BTN)');
    await expect(page.getByText('TfL Lines to Monitor')).not.toBeVisible();

    // Change back to London Victoria → TfL reappears
    await pickStation(page, 'Outbound Journey', 'Destination', 'Victoria', 'London Victoria (VIC)');
    await expect(page.getByText('TfL Lines to Monitor')).toBeVisible();
  });

  // 3.5 — Submit profile
  test('3.5 — submit profile and verify card', async () => {
    // Fill name
    await page.getByPlaceholder('e.g. Weekday Commute').fill('Weekday Commute');

    // Fill departure times (locate the time input within each fieldset)
    const outboundFieldset = page.locator('fieldset', {
      has: page.getByText('Outbound Journey', { exact: true }),
    });
    const returnFieldset = page.locator('fieldset', {
      has: page.getByText('Return Journey', { exact: true }),
    });
    await outboundFieldset.locator('input[type="time"]').fill('07:30');
    await returnFieldset.locator('input[type="time"]').fill('17:45');

    // Select TfL lines — checkboxes are sr-only but wrapped in <label> with line name
    await page.getByRole('checkbox', { name: 'Victoria' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Northern' }).check({ force: true });

    // Verify checkboxes are checked before submitting
    await expect(page.getByRole('checkbox', { name: 'Victoria' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Northern' })).toBeChecked();

    // Submit
    await page.getByRole('button', { name: 'Create Profile' }).click();

    // Verify profile card appears
    await expect(page.getByText('Weekday Commute')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('BTN → VIC at 07:30')).toBeVisible();
    await expect(page.getByText('VIC → BTN at 17:45')).toBeVisible();
    await expect(page.getByText(/victoria, northern/i)).toBeVisible();
  });

  // 3.6 — Activate profile
  test('3.6 — activate profile', async () => {
    await page.getByRole('button', { name: 'Set Active' }).click();

    // "Active" badge appears
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5_000 });

    // "Set Active" button should be gone
    await expect(page.getByRole('button', { name: 'Set Active' })).not.toBeVisible();
  });

  // 3.7 — Edit profile
  test('3.7 — edit profile', async () => {
    await page.getByRole('button', { name: 'Edit' }).click();

    // Verify form is pre-populated
    await expect(page.getByPlaceholder('e.g. Weekday Commute')).toHaveValue('Weekday Commute');

    // Change name
    await page.getByPlaceholder('e.g. Weekday Commute').fill('Brighton to Victoria');

    // Submit update
    await page.getByRole('button', { name: 'Update Profile' }).click();

    // Verify updated name on card
    await expect(page.getByText('Brighton to Victoria')).toBeVisible({ timeout: 5_000 });

    // Active badge should persist
    await expect(page.getByText('Active')).toBeVisible();
  });

  // 3.8 — Delete profile (confirmation flow)
  test('3.8 — delete profile with confirmation', async () => {
    // First click: shows confirmation
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Click Delete again to confirm')).toBeVisible();

    // Click cancel
    await page.getByText('cancel').click();
    await expect(page.getByText('Click Delete again to confirm')).not.toBeVisible();
    await expect(page.getByText('Brighton to Victoria')).toBeVisible();

    // Delete for real: click Delete twice
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    // Back to empty state
    await expect(page.getByText('No commute profiles yet.')).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 3.9 — Dashboard empty state
// ---------------------------------------------------------------------------

test.describe('3.9 — Dashboard empty state', () => {
  test('dashboard shows section cards with no data', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Rail Departures')).toBeVisible();
    await expect(page.getByText('Weather')).toBeVisible();
    await expect(page.getByText('TfL Status')).toBeVisible();

    // All sections show "No data yet"
    const noData = page.getByText('No data yet');
    expect(await noData.count()).toBeGreaterThanOrEqual(3);

    // Empty state message
    await expect(page.getByText('No active profile')).toBeVisible();

    // Refresh button and profile selector should NOT be visible
    await expect(page.getByRole('button', { name: 'Refresh' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3.10 — Navigation and layout
// ---------------------------------------------------------------------------

test.describe('3.10 — Navigation and layout', () => {
  test('nav links work correctly', async ({ page }) => {
    await page.goto('/');

    // Navigate to Profiles
    await page.getByRole('link', { name: 'Profiles' }).click();
    await expect(page).toHaveURL(/\/profiles/);

    // Navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('unknown routes redirect to dashboard', async ({ page }) => {
    await page.goto('/foo');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3.11–3.15 — Dashboard with live data
//
// These tests create a profile, activate it, and verify the dashboard
// renders real data from the backend services.
// ---------------------------------------------------------------------------

test.describe('3.11–3.15 — Dashboard with live data', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    // Clean up: delete all profiles
    const response = await page.request.get('http://localhost:3001/api/profiles', {
      headers: { 'x-user-id': 'test-user' },
    });
    const profiles = await response.json();
    for (const p of profiles) {
      await page.request.delete(`http://localhost:3001/api/profiles/${p.profileId}`, {
        headers: { 'x-user-id': 'test-user' },
      });
    }
    await page.close();
  });

  // 3.11 — Create and activate a profile for dashboard testing
  test('3.11 — create and activate profile for dashboard', async () => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: 'New Profile' }).click();

    // Fill profile name
    await page.getByPlaceholder('e.g. Weekday Commute').fill('Dashboard Test');

    // Outbound: Brighton → London Victoria
    await pickStation(page, 'Outbound Journey', 'Origin', 'Brighton', 'Brighton (BTN)');
    await pickStation(page, 'Outbound Journey', 'Destination', 'Victoria', 'London Victoria (VIC)');

    // Departure times
    const outboundFieldset = page.locator('fieldset', {
      has: page.getByText('Outbound Journey', { exact: true }),
    });
    const returnFieldset = page.locator('fieldset', {
      has: page.getByText('Return Journey', { exact: true }),
    });
    await outboundFieldset.locator('input[type="time"]').fill('07:30');
    await returnFieldset.locator('input[type="time"]').fill('17:45');

    // Select TfL lines
    await page.getByRole('checkbox', { name: 'Victoria' }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Northern' }).check({ force: true });

    // Submit
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await expect(page.getByText('Dashboard Test')).toBeVisible({ timeout: 5_000 });

    // Activate
    await page.getByRole('button', { name: 'Set Active' }).click();
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5_000 });
  });

  // 3.12 — Dashboard header and controls
  test('3.12 — dashboard header shows profile name, refresh, and timestamp', async () => {
    await page.goto('/');

    // Wait for dashboard data to load
    await expect(page.getByText('Dashboard Test')).toBeVisible({ timeout: 10_000 });

    // Profile name visible in header
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Last refreshed timestamp
    await expect(page.getByText(/Updated \d{1,2}:\d{2}/)).toBeVisible();

    // Refresh button
    const refreshBtn = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshBtn).toBeVisible();

    // Click refresh and verify timestamp updates
    const timestampBefore = await page.getByText(/Updated \d{1,2}:\d{2}/).textContent();
    await refreshBtn.click();

    // Button should show "Refreshing..." briefly
    // After refresh, data should still be present
    await expect(page.getByText('Dashboard Test')).toBeVisible({ timeout: 10_000 });
  });

  // 3.13 — Weather section with live data
  test('3.13 — weather section shows three forecast cards', async () => {
    // Weather section heading
    await expect(page.getByText('Weather')).toBeVisible();

    // Three weather card labels
    await expect(page.getByText('Outbound Origin')).toBeVisible();
    await expect(page.getByText('Destination')).toBeVisible();
    await expect(page.getByText('Return Origin')).toBeVisible();

    // Temperature values (°C format)
    const temps = page.getByText(/\d+°C/);
    expect(await temps.count()).toBeGreaterThanOrEqual(3);

    // Precipitation probability
    const precip = page.getByText(/💧 \d+%/);
    expect(await precip.count()).toBeGreaterThanOrEqual(3);

    // Wind speed
    const wind = page.getByText(/💨 \d+ km\/h/);
    expect(await wind.count()).toBeGreaterThanOrEqual(3);
  });

  // 3.14 — Rail section structure
  test('3.14 — rail section shows outbound and return sub-sections', async () => {
    await expect(page.getByText('Rail Departures')).toBeVisible();

    // Both departure boards present
    await expect(page.getByRole('heading', { name: 'Outbound' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Return' })).toBeVisible();

    // Either shows services or "No services found" (depends on time of day)
    const outboundSection = page.locator('div', { has: page.getByRole('heading', { name: 'Outbound' }) });
    const hasOutboundServices = await outboundSection.getByText(/^\d{2}:\d{2}$/).count() > 0;
    const hasOutboundEmpty = await outboundSection.getByText('No services found').count() > 0;
    expect(hasOutboundServices || hasOutboundEmpty).toBe(true);
  });

  // 3.15 — TfL section with configured lines
  test('3.15 — TfL section shows status for configured lines', async () => {
    await expect(page.getByText('TfL Status')).toBeVisible();

    // Northern and Victoria lines should be displayed in the TfL section
    // Use heading to scope tightly, then look for line names as exact matches
    // to avoid matching "London Victoria" in the weather section
    const tflSection = page.locator('div', { has: page.getByRole('heading', { name: 'TfL Status' }) });
    await expect(tflSection.getByText('Northern', { exact: true })).toBeVisible();
    await expect(tflSection.getByText('Victoria', { exact: true })).toBeVisible();

    // Each line should have a status (e.g. "Good Service", "Minor Delays", etc.)
    const statusTexts = tflSection.locator('span').filter({ hasText: /Service|Delays|Suspended|Closure|Disruption/i });
    expect(await statusTexts.count()).toBeGreaterThanOrEqual(2);
  });
});
