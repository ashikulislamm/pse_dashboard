import assert from 'node:assert/strict';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
});

const ADMIN_ID = '10000000-0000-0000-0000-000000000001';
const MEMBER_ID = '10000000-0000-0000-0000-000000000003';
const EXTERNAL_NON_PSE_ID = '10000000-0000-0000-0000-000000000099';
const EXISTING_CONTACT_ID = '20000000-0000-0000-0000-000000000003';
const LOCKED_PLAN_ID = '70000000-0000-0000-0000-000000000001';
const LOCKED_QUARTER_ID = '70000000-0000-0000-0000-000000000101';

/**
 * Helper: runs a block inside a transaction that ALWAYS rolls back after asserting
 * whether it threw an expected error or succeeded.
 */
async function expectFailure(name, fn, expectedMessagePattern) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let threw = false;
    let errorMessage = '';
    try {
      await fn(client);
      // Force deferred constraints to fire before rollback
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    } catch (err) {
      threw = true;
      errorMessage = err.message || String(err);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }

    assert.equal(threw, true, `[FAIL] ${name}: expected query to fail, but it succeeded.`);
    if (expectedMessagePattern) {
      assert.match(
        errorMessage,
        expectedMessagePattern,
        `[FAIL] ${name}: error "${errorMessage}" did not match ${expectedMessagePattern}`,
      );
    }
    console.log(`  ✓ ${name}`);
  } finally {
    client.release();
  }
}

async function runTests() {
  console.log('Running Phase 2 PostgreSQL Invariant & RLS Tests...\n');

  // 1. Duplicate email rejected
  await expectFailure(
    '1. Duplicate normalized email is rejected',
    async (client) => {
      await client.query(
        `INSERT INTO contact_channels (contact_id, kind, value, value_normalized)
         VALUES ($1, 'email', 'tariq.hasan@meghna-demo.example.com', 'tariq.hasan@meghna-demo.example.com')`,
        [EXISTING_CONTACT_ID],
      );
    },
    /unique|duplicate key/i,
  );

  // 2. Duplicate phone rejected
  await expectFailure(
    '2. Duplicate normalized phone (E.164) is rejected',
    async (client) => {
      await client.query(
        `INSERT INTO contact_channels (contact_id, kind, value, value_normalized)
         VALUES ($1, 'phone', '+8801711000002', '+8801711000002')`,
        [EXISTING_CONTACT_ID],
      );
    },
    /unique|duplicate key/i,
  );

  // 3. Contact without channel rejected at commit (deferred constraint trigger)
  await expectFailure(
    '3. Contact without any email/phone channel is rejected by deferred constraint trigger',
    async (client) => {
      await client.query(
        `INSERT INTO contacts (type, name, owner_id)
         VALUES ('individual', 'Channelless Contact', $1)`,
        [MEMBER_ID],
      );
    },
    /contact needs at least one email or phone/i,
  );

  // 4. Pipeline expected_amount <= 0 rejected
  await expectFailure(
    '4. Pipeline with expected_amount <= 0 is rejected',
    async (client) => {
      const { rows: stages } = await client.query(`SELECT id FROM pipeline_stages LIMIT 1`);
      const { rows: cats } = await client.query(`SELECT id FROM contribution_categories LIMIT 1`);
      await client.query(
        `INSERT INTO pipelines (
           deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, stage_id, expected_amount, currency, amount_base
         ) VALUES ($1, $2, 'cash', $3, 'individual', $4, $5, 0, 'BDT', 0)`,
        ['Zero Deal', MEMBER_ID, cats[0].id, EXISTING_CONTACT_ID, stages[0].id],
      );
    },
    /expected_amount|check/i,
  );

  // 5. In-kind pipeline without valuation note rejected
  await expectFailure(
    '5. In-kind pipeline without in_kind_valuation_note is rejected',
    async (client) => {
      const { rows: stages } = await client.query(`SELECT id FROM pipeline_stages LIMIT 1`);
      const { rows: cats } = await client.query(`SELECT id FROM contribution_categories LIMIT 1`);
      await client.query(
        `INSERT INTO pipelines (
           deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, stage_id, expected_amount, currency, amount_base, in_kind_valuation_note
         ) VALUES ($1, $2, 'in_kind', $3, 'individual', $4, $5, 50000, 'BDT', 50000, NULL)`,
        ['Unvalued In-Kind', MEMBER_ID, cats[0].id, EXISTING_CONTACT_ID, stages[0].id],
      );
    },
    /in_kind_valuation_note|check/i,
  );

  // 6. Meeting with neither contact_id nor pipeline_id rejected
  await expectFailure(
    '6. Meeting with neither contact_id nor pipeline_id is rejected',
    async (client) => {
      await client.query(
        `INSERT INTO meetings (contact_id, pipeline_id, scheduled_at, owner_id)
         VALUES (NULL, NULL, now(), $1)`,
        [MEMBER_ID],
      );
    },
    /check/i,
  );

  // 7. Non-PSE user reads zero rows across all business tables via RLS
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [
        EXTERNAL_NON_PSE_ID,
      ]);

      const tables = ['contacts', 'pipelines', 'meetings', 'activities', 'target_plans'];
      for (const tbl of tables) {
        const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${tbl}`);
        assert.equal(
          rows[0].cnt,
          0,
          `[FAIL] Non-PSE user read ${rows[0].cnt} rows from ${tbl} (expected 0)`,
        );
      }
      await client.query('ROLLBACK');
      console.log('  ✓ 7. Non-PSE user reads 0 rows across all PSE tables (RLS verified)');
    } finally {
      client.release();
    }
  }

  // 8. PSE Member can read PSE data via RLS, but cannot write to target_plans
  await expectFailure(
    '8. Member role is blocked by RLS from writing to target_plans',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [MEMBER_ID]);
      await client.query(
        `INSERT INTO target_plans (year, annual_amount) VALUES (2029, 5000000)`,
      );
    },
    /row-level security/i,
  );

  // 9. Locked target plan rejects updates on plan, quarters, and lines even for Admin
  await expectFailure(
    '9a. Locked target_plans row rejects UPDATE via BEFORE trigger',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [ADMIN_ID]);
      await client.query(
        `UPDATE target_plans SET annual_amount = 99999999 WHERE id = $1`,
        [LOCKED_PLAN_ID],
      );
    },
    /target plan is locked/i,
  );

  await expectFailure(
    '9b. Locked target_quarters row rejects UPDATE via BEFORE trigger',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [ADMIN_ID]);
      await client.query(
        `UPDATE target_quarters SET amount = 999999 WHERE id = $1`,
        [LOCKED_QUARTER_ID],
      );
    },
    /target plan is locked/i,
  );

  // 10. Moving pipeline to Lost without lost_reason is rejected by trigger
  await expectFailure(
    '10. Moving pipeline to Lost stage without lost_reason is rejected',
    async (client) => {
      const { rows: lostStage } = await client.query(
        `SELECT id FROM pipeline_stages WHERE kind = 'lost' LIMIT 1`,
      );
      await client.query(
        `UPDATE pipelines SET stage_id = $1, lost_reason = NULL WHERE id = '30000000-0000-0000-0000-000000000002'`,
        [lostStage[0].id],
      );
    },
    /lost_reason is required/i,
  );

  console.log('\nAll Phase 2 PostgreSQL Invariant & RLS tests passed!');
  await pool.end();
}

runTests().catch((err) => {
  console.error('\nDB Test Suite Failed:', err);
  process.exit(1);
});
