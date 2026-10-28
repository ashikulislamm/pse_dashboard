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

/** Runs `fn` in a transaction that always rolls back, and asserts whether it throws. */
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
  console.log('Running PostgreSQL Invariant, Trigger, Function & RLS Tests...\n');

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

  // 11. publish_target_plan is SECURITY DEFINER, so it carries its own role guard
  await expectFailure(
    '11a. Member cannot publish a target plan',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [MEMBER_ID]);
      await client.query('SELECT publish_target_plan($1)', [LOCKED_PLAN_ID]);
    },
    /only an admin or target manager/i,
  );

  await expectFailure(
    '11b. Publishing an already locked plan is rejected',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [ADMIN_ID]);
      await client.query('SELECT publish_target_plan($1)', [LOCKED_PLAN_ID]);
    },
    /already locked/i,
  );

  // 12. Dashboard read-model functions reproduce a hand-computed result (all rolled back)
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [ADMIN_ID]);

      const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
      const num = (v) => Number(v);

      const { id: teamId } = await one(`SELECT id FROM teams ORDER BY name LIMIT 1`);
      const { id: wonStage } = await one(`SELECT id FROM pipeline_stages WHERE kind = 'won' LIMIT 1`);
      const { id: dspCategory, vertical_id: dspVertical } = await one(
        `SELECT c.id, m.vertical_id FROM contribution_categories c
         JOIN category_vertical_map m ON m.category_id = c.id WHERE c.name = 'DSP'`,
      );
      const { id: vbdVertical } = await one(`SELECT id FROM verticals WHERE name = 'VBD'`);

      // Published 2031 plan: Q1..Q4 = 300 each; in Q1 the member splits 60/40 between DSP and VBD.
      const { id: planId } = await one(
        `INSERT INTO target_plans (year, team_id, annual_amount) VALUES (2031, $1, 1200) RETURNING id`,
        [teamId],
      );
      for (let q = 1; q <= 4; q += 1) {
        const { id: quarterId } = await one(
          `INSERT INTO target_quarters (plan_id, quarter, amount) VALUES ($1, $2, 300) RETURNING id`,
          [planId, q],
        );
        if (q === 1) {
          await client.query(
            `INSERT INTO target_lines (quarter_id, user_id, vertical_id, percent, amount)
             VALUES ($1, $2, $3, 60, 180), ($1, $2, $4, 40, 120)`,
            [quarterId, MEMBER_ID, dspVertical, vbdVertical],
          );
        } else {
          await client.query(
            `INSERT INTO target_lines (quarter_id, user_id, vertical_id, percent, amount)
             VALUES ($1, $2, $3, 100, 300)`,
            [quarterId, MEMBER_ID, dspVertical],
          );
        }
      }

      // A second plan stays a draft: it must not count as a target.
      const { id: draftPlanId } = await one(
        `INSERT INTO target_plans (year, team_id, annual_amount) VALUES (2032, $1, 100) RETURNING id`,
        [teamId],
      );
      const { id: draftQuarterId } = await one(
        `INSERT INTO target_quarters (plan_id, quarter, amount) VALUES ($1, 1, 100) RETURNING id`,
        [draftPlanId],
      );
      await client.query(
        `INSERT INTO target_lines (quarter_id, user_id, vertical_id, percent, amount)
         VALUES ($1, $2, $3, 100, 100)`,
        [draftQuarterId, MEMBER_ID, dspVertical],
      );

      await client.query(`SELECT publish_target_plan($1)`, [planId]);

      const { id: pipelineId } = await one(
        `INSERT INTO pipelines (deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, stage_id, expected_amount, currency, amount_base, won_at, created_at)
         VALUES ('Dashboard fixture', $1, 'cash', $2, 'individual', $3, $4, 1000, 'BDT', 1000,
           '2031-02-10', '2031-01-20')
         RETURNING id`,
        [MEMBER_ID, dspCategory, EXISTING_CONTACT_ID, wonStage],
      );
      await client.query(
        `INSERT INTO pipeline_receipts (pipeline_id, amount, currency, amount_base, received_on)
         VALUES ($1, 400, 'BDT', 400, '2031-02-15'), ($1, 700, 'BDT', 700, '2031-05-10')`,
        [pipelineId],
      );

      const sumOf = async (sql, params) =>
        num((await one(`SELECT COALESCE(SUM(v), 0) AS total FROM (${sql}) t(v)`, params)).total);

      // Achievement counts receipts by received date only.
      assert.equal(
        await sumOf(`SELECT achieved FROM fn_achievement('2031-01-01', '2031-03-31', NULL, NULL)`),
        400,
        '[FAIL] 12a. Q1 achievement should be the 400 received in February',
      );
      assert.equal(
        await sumOf(`SELECT achieved FROM fn_achievement('2031-04-01', '2031-06-30', NULL, NULL)`),
        700,
        '[FAIL] 12b. Q2 achievement should be the 700 received in May',
      );

      // Targets: quarter exact, month = quarter / 3, year = sum of quarters, drafts excluded.
      assert.equal(await sumOf(`SELECT target FROM fn_target(2031, 1, NULL, NULL, NULL)`), 300, '[FAIL] 12c. Q1 target');
      assert.equal(await sumOf(`SELECT target FROM fn_target(2031, 2, NULL, NULL, NULL)`), 300, '[FAIL] 12d. Q2 target is unchanged by Q1 over-achievement');
      assert.equal(await sumOf(`SELECT target FROM fn_target(2031, NULL, 2, NULL, NULL)`), 100, '[FAIL] 12e. February target is quarter / 3');
      assert.equal(await sumOf(`SELECT target FROM fn_target(2031, NULL, NULL, NULL, NULL)`), 1200, '[FAIL] 12f. Annual target');
      assert.equal(await sumOf(`SELECT target FROM fn_target(2031, 1, NULL, NULL, $1)`, [vbdVertical]), 120, '[FAIL] 12g. Vertical filter');
      assert.equal(await sumOf(`SELECT target FROM fn_target(2032, 1, NULL, NULL, NULL)`), 0, '[FAIL] 12h. A draft plan is not a target');

      // Vertical filter on achievement: the receipts belong to a DSP deal, so VBD sees none.
      assert.equal(
        await sumOf(`SELECT achieved FROM fn_achievement('2031-01-01', '2031-12-31', NULL, $1)`, [vbdVertical]),
        0,
        '[FAIL] 12i. VBD achievement should be zero',
      );

      // Won-unrealized floors each deal at zero: received 1100 on a 1000 deal leaves nothing outstanding.
      const won = await one(`SELECT * FROM fn_won_unrealized('2031-01-01', '2031-12-31', NULL, NULL)`);
      assert.equal(num(won.won_base), 1000, '[FAIL] 12j. won amount');
      assert.equal(num(won.received_base), 1100, '[FAIL] 12k. received amount');
      assert.equal(num(won.unrealized_base), 0, '[FAIL] 12l. over-received deal has no unrealized amount');

      assert.equal(
        (await one(`SELECT fn_lead_count('2031-01-01', '2031-01-31', NULL, NULL) AS c`)).c,
        1,
        '[FAIL] 12m. lead count',
      );

      const trend = (await client.query(`SELECT month_index, achieved FROM fn_trend(2031, NULL, NULL)`)).rows;
      assert.equal(trend.length, 12, '[FAIL] 12n. trend has twelve months');
      assert.equal(num(trend[1].achieved), 400, '[FAIL] 12o. February trend');
      assert.equal(num(trend[4].achieved), 700, '[FAIL] 12p. May trend');

      // Non-monetary functions always return every status, with zeros.
      const meetingRows = (await client.query(`SELECT status FROM fn_meeting_summary('2031-01-01', '2031-12-31', NULL)`)).rows;
      assert.equal(meetingRows.length, 2, '[FAIL] 12q. meeting summary lists scheduled and done');

      console.log('  ✓ 12. Dashboard functions match the hand-computed 2031 fixture (achievement, targets, pro-rata, drafts, won-unrealized, trend)');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }

  // 13. Company pipeline without poc_contact_id is rejected
  await expectFailure(
    '13. Company pipeline without poc_contact_id is rejected by CHECK constraint',
    async (client) => {
      const { rows: stages } = await client.query(`SELECT id FROM pipeline_stages LIMIT 1`);
      const { rows: cats } = await client.query(`SELECT id FROM contribution_categories LIMIT 1`);
      await client.query(
        `INSERT INTO pipelines (
           deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, poc_contact_id, stage_id, expected_amount, currency, amount_base
         )
         VALUES ('Company Without POC', $1, 'cash', $2, 'company', $3, NULL, $4, 100000, 'BDT', 100000)`,
        [MEMBER_ID, cats[0].id, EXISTING_CONTACT_ID, stages[0].id],
      );
    },
    /check|poc_contact_id/i,
  );

  // 14. Column-level privilege isolation: authenticated role cannot SELECT password_hash from profiles
  await expectFailure(
    '14. Authenticated role is blocked from reading profiles.password_hash (007_security_hardening)',
    async (client) => {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [MEMBER_ID]);
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [MEMBER_ID]);
      await client.query('SELECT id, password_hash FROM profiles LIMIT 1');
    },
    /permission denied/i,
  );

  // 15. Member RLS owner guard: member can read all PSE pipelines, but cannot UPDATE another member's pipeline
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const NADIA_ID = '10000000-0000-0000-0000-000000000005';
      const { rows: stages } = await client.query(`SELECT id FROM pipeline_stages WHERE kind = 'open' LIMIT 1`);
      const { rows: cats } = await client.query(`SELECT id FROM contribution_categories LIMIT 1`);
      const { rows: inserted } = await client.query(
        `INSERT INTO pipelines (
           deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, stage_id, expected_amount, currency, amount_base, created_by
         )
         VALUES ('Nadia Deal', $1, 'cash', $2, 'individual', $3, $4, 50000, 'BDT', 50000, $1)
         RETURNING id`,
        [NADIA_ID, cats[0].id, EXISTING_CONTACT_ID, stages[0].id],
      );
      const nadiaPipeId = inserted[0].id;

      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [MEMBER_ID]);
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [MEMBER_ID]);

      const readRes = await client.query(`SELECT id FROM pipelines WHERE id = $1`, [nadiaPipeId]);
      assert.equal(readRes.rowCount, 1, '[FAIL] 15a. PSE member must be able to read all PSE pipelines');

      const updateRes = await client.query(
        `UPDATE pipelines SET deal_name = 'Hijacked Deal' WHERE id = $1`,
        [nadiaPipeId],
      );
      assert.equal(updateRes.rowCount, 0, '[FAIL] 15b. PSE member must not be able to update another member pipeline');

      console.log('  ✓ 15. Member RLS owner guard: member reads all PSE records but cannot update another member pipeline');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }

  // 16. Stage transition trigger sets won_at, appends pipeline_stage_history, and logs to audit_log
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [MEMBER_ID]);
      const { rows: openStages } = await client.query(`SELECT id FROM pipeline_stages WHERE kind = 'open' LIMIT 1`);
      const { rows: wonStages } = await client.query(`SELECT id FROM pipeline_stages WHERE kind = 'won' LIMIT 1`);
      const { rows: cats } = await client.query(`SELECT id FROM contribution_categories LIMIT 1`);

      const { rows: created } = await client.query(
        `INSERT INTO pipelines (
           deal_name, focal_person_id, contribution_type, category_id, party_type,
           contact_id, stage_id, expected_amount, currency, amount_base, created_by
         )
         VALUES ('Trigger Check Deal', $1, 'cash', $2, 'individual', $3, $4, 75000, 'BDT', 75000, $1)
         RETURNING id, won_at`,
        [MEMBER_ID, cats[0].id, EXISTING_CONTACT_ID, openStages[0].id],
      );
      const pipeId = created[0].id;
      assert.equal(created[0].won_at, null, '[FAIL] 16a. Open pipeline should have won_at = NULL');

      const { rows: updated } = await client.query(
        `UPDATE pipelines SET stage_id = $1 WHERE id = $2 RETURNING won_at`,
        [wonStages[0].id, pipeId],
      );
      assert.notEqual(updated[0].won_at, null, '[FAIL] 16b. Moving to Won stage must auto-populate won_at');

      const { rows: history } = await client.query(
        `SELECT from_stage, to_stage FROM pipeline_stage_history WHERE pipeline_id = $1 ORDER BY id ASC`,
        [pipeId],
      );
      assert.equal(history.length, 2, '[FAIL] 16c. pipeline_stage_history should have initial + transition rows');
      assert.equal(history[0].from_stage, null);
      assert.equal(history[1].to_stage, wonStages[0].id);

      const { rows: audits } = await client.query(
        `SELECT action FROM audit_log WHERE table_name = 'pipelines' AND row_id = $1::text ORDER BY id ASC`,
        [pipeId],
      );
      assert.equal(audits.length, 2, '[FAIL] 16d. audit_log should record INSERT and UPDATE on pipelines');

      console.log('  ✓ 16. Stage triggers auto-set won_at, append pipeline_stage_history, and write audit_log entries');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }

  // 17. Non-monetary dashboard SQL functions exclude cancelled activities and deduplicate engaged contacts
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO activities (type, class, title, owner_id, contact_id, status, occurred_at)
         VALUES
           ('visit', 'independent', 'Completed Visit', $1, $2, 'done', '2033-03-10 10:00:00Z'),
           ('visit', 'independent', 'Cancelled Visit', $1, $2, 'cancelled', '2033-03-11 10:00:00Z')`,
        [MEMBER_ID, EXISTING_CONTACT_ID],
      );
      await client.query(
        `INSERT INTO meetings (contact_id, scheduled_at, status, description, owner_id)
         VALUES ($2, '2033-03-12 14:00:00Z', 'done', 'Follow-up meeting with same contact', $1)`,
        [MEMBER_ID, EXISTING_CONTACT_ID],
      );

      const { rows: actSummary } = await client.query(
        `SELECT activity_count, distinct_contacts
         FROM fn_activity_summary('2033-03-01', '2033-03-31', $1)
         WHERE type = 'visit' AND class = 'independent'`,
        [MEMBER_ID],
      );
      assert.equal(actSummary.length, 1);
      assert.equal(actSummary[0].activity_count, 1, '[FAIL] 17a. Cancelled activity must be excluded');
      assert.equal(actSummary[0].distinct_contacts, 1, '[FAIL] 17b. Distinct contacts on visit');

      const { rows: engaged } = await client.query(
        `SELECT fn_contacts_engaged('2033-03-01', '2033-03-31', $1) AS c`,
        [MEMBER_ID],
      );
      assert.equal(
        engaged[0].c,
        1,
        '[FAIL] 17c. Contact touched by both a meeting and an activity must be counted once',
      );

      console.log('  ✓ 17. Non-monetary functions exclude cancelled activities and deduplicate contacts across meetings & activities');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }

  console.log('\nAll 17 PostgreSQL Invariant, Trigger, Function & RLS tests passed!');
  await pool.end();
}

runTests().catch((err) => {
  console.error('\nDB Test Suite Failed:', err);
  process.exit(1);
});
