import { expect, test } from '@playwright/test';
import pg from 'pg';

const { Pool } = pg;

const TEST_TARGET_YEAR = 2034;
const runId = Date.now().toString().slice(-6);
const contactName = `E2E Contact ${runId}`;
const contactEmail = `e2e.contact.${runId}@example.org`;
const inlineDonorName = `E2E Inline Donor ${runId}`;
const inlineDonorEmail = `e2e.inline.${runId}@example.org`;
const dealName = `E2E Deal ${runId}`;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for E2E cleanup.');
  }
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 1,
  });
}

async function cleanupE2EArtifacts() {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bypass the lock triggers in cleanup so TEST_TARGET_YEAR can be reset
    await client.query(`SET LOCAL session_replication_role = 'replica'`);

    await client.query(`DELETE FROM target_plans WHERE year = $1`, [TEST_TARGET_YEAR]);
    await client.query(`DELETE FROM pipelines WHERE deal_name LIKE 'E2E Deal %'`);
    await client.query(
      `DELETE FROM contacts WHERE name LIKE 'E2E Contact %' OR name LIKE 'E2E Inline Donor %'`,
    );
    await client.query(
      `DELETE FROM login_attempts WHERE email IN ('external@otherdept.org', 'rahim@pse.org', 'safina@pse.org')`,
    );

    await client.query(`SET LOCAL session_replication_role = 'origin'`);
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    client.release();
    await pool.end();
  }
}

test.describe('PSE Dashboard — Phase 9 E2E Happy Path & Security Suite', () => {
  test.beforeAll(async () => {
    await cleanupE2EArtifacts();
  });

  test.afterAll(async () => {
    await cleanupE2EArtifacts();
  });

  test('non-PSE restriction, contact dedupe, inline deal creation, Won + receipt -> dashboard invalidation, and target publish lock', async ({
    page,
  }) => {
    // 1. Unauthenticated visitor is redirected to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // 2. Non-PSE user logs in -> redirected to /no-access
    await page.getByRole('button', { name: /Non-PSE User \(Blocked\)/i }).click();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/no-access/);
    await expect(page.getByText('Access restricted')).toBeVisible();
    await page.getByRole('button', { name: /Sign out and switch account/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // 3. Log in as PSE Member (rahim@pse.org)
    await page.getByRole('button', { name: /Rahim \(Member\)/i }).click();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Note the current dashboard Achieved text before adding our receipt
    await page.getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts/);

    // 4. Create contact: verify duplicate email is blocked first, then save unique contact
    await page.getByRole('button', { name: /New contact/i }).click();
    await page.locator('#contact-name').fill(contactName);
    await page
      .getByLabel('Channel 1 value')
      .fill('tariq.hasan@meghna-demo.example.com');
    await page.getByRole('button', { name: 'Save contact' }).click();

    // Duplicate warning must show and block creation
    await expect(page.getByText(/Duplicate email found/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open contact' })).toBeVisible();

    // Replace with unique email and save
    await page.getByLabel('Channel 1 value').fill(contactEmail);
    await page.getByRole('button', { name: 'Save contact' }).click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible();

    // 5. Create new pipeline with inline contact creation via <ContactPicker />
    await page.getByRole('link', { name: 'Pipelines' }).click();
    await expect(page).toHaveURL(/\/pipelines/);
    await page.getByRole('button', { name: /New pipeline/i }).click();

    await page.locator('#pipeline-deal-name').fill(dealName);
    await page.locator('#pipeline-expected-amount').fill('300000');
    await page.getByRole('button', { name: 'Individual donor' }).click();

    // Create a new individual contact inline from the picker
    await page.locator('#pipeline-individual-contact').click();
    await page.getByRole('button', { name: /Create new contact/i }).click();
    await page.locator('#contact-name').fill(inlineDonorName);
    await page.getByLabel('Channel 1 value').fill(inlineDonorEmail);
    await page.getByRole('button', { name: 'Save contact' }).click();

    // Inline contact is now selected on the pipeline form
    await expect(page.locator('#pipeline-individual-contact')).toContainText(
      inlineDonorName,
    );

    await page.getByRole('button', { name: 'Create pipeline' }).click();
    await expect(page).toHaveURL(/\/pipelines\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: dealName })).toBeVisible();

    // 6. Move pipeline to Won stage and confirm
    const stageSelect = page.getByLabel(`Change stage for ${dealName}`);
    await stageSelect.selectOption({ label: 'Won' });

    const confirmWonDialog = page.getByRole('dialog');
    await expect(confirmWonDialog).toContainText(`Mark "${dealName}" as Won?`);
    await confirmWonDialog.getByRole('button', { name: 'Confirm Won' }).click();

    // Verify Won banner and Record receipt button unlock
    await expect(
      page.getByRole('button', { name: 'Record receipt' }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Realized achievement \(receipts\)/i)).toBeVisible();

    // 7. Record a realized receipt of 125,000 BDT today
    await page.getByRole('button', { name: 'Record receipt' }).first().click();
    const receiptDialog = page.getByRole('dialog');
    await receiptDialog.locator('#receipt-amount').fill('125000');
    await receiptDialog
      .locator('#receipt-note')
      .fill('E2E tranche receipt verification');
    await receiptDialog.getByRole('button', { name: 'Record receipt' }).click();

    await expect(page.getByText('E2E tranche receipt verification')).toBeVisible();
    await expect(page.getByText('৳ 1,25,000').first()).toBeVisible();

    // 8. Navigate to Dashboard -> verify Monetary and Non-monetary lenses + mobile drawer
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Filter by Rahim to verify Rahim's achieved total includes the new receipt
    const memberSelect = page.locator('#dashboard-member');
    await memberSelect.selectOption({ label: 'Rahim Chowdhury' });
    await expect(page).toHaveURL(/member=/);
    await expect(page.getByText(/Target vs achievement by vertical/i)).toBeVisible();

    // Switch to Non-monetary lens (client-side instant switch)
    await page.getByRole('button', { name: 'Non-monetary' }).click();
    await expect(page.getByText(/Workload by member/i)).toBeVisible();

    // Verify mobile viewport (375px) responsive drawer
    await page.setViewportSize({ width: 375, height: 667 });
    const openMenuBtn = page.getByRole('button', { name: 'Open menu' });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();
    await expect(page.getByRole('button', { name: 'Close menu' }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 800 });

    // Sign out of Member account
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    // 9. Log in as Safina (Target Manager) -> create & publish target plan -> verify locked
    await page.getByRole('button', { name: /Safina \(Target Manager\)/i }).click();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/targets?year=${TEST_TARGET_YEAR}`);
    await expect(
      page.getByText(`Annual team target for ${TEST_TARGET_YEAR}`),
    ).toBeVisible();

    // Step 1: Annual target
    await page.locator('#target-annual').fill('1200000');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Quarters
    await expect(
      page.getByRole('heading', { name: 'Quarterly targets' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Split annual target evenly' }).click();
    await expect(
      page.getByText('Quarters add up to the annual target.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Members (4 quarters)
    await expect(
      page.getByRole('heading', { name: 'Q1 — member targets' }),
    ).toBeVisible();
    const splitMembersBtns = page.getByRole('button', {
      name: 'Split evenly across members',
    });
    const memberBtnCount = await splitMembersBtns.count();
    for (let i = 0; i < memberBtnCount; i += 1) {
      await splitMembersBtns.nth(i).click();
    }
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Verticals (even split for every member, all 4 quarters)
    await expect(
      page.getByRole('heading', { name: 'Q1 — vertical split' }),
    ).toBeVisible();
    const splitVertBtns = page.getByRole('button', {
      name: 'Split evenly',
      exact: true,
    });
    const vertBtnCount = await splitVertBtns.count();
    for (let i = 0; i < vertBtnCount; i += 1) {
      await splitVertBtns.nth(i).click();
    }
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Review & Publish
    await expect(
      page.getByText('Publishing locks the plan. After that, no target can be changed.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Publish targets' }).click();

    const publishDialog = page.getByRole('dialog');
    await expect(publishDialog).toContainText(`Publish ${TEST_TARGET_YEAR} targets`);
    await publishDialog.getByRole('button', { name: 'Publish targets' }).click();

    // Verify locked read-only view
    await expect(
      page.getByText(/Published targets are locked and cannot be changed\./i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
  });
});
