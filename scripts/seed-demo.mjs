import crypto from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
});

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_USERS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'admin@pse.org',
    password: 'Password123!',
    full_name: 'Arif Rahman (Admin)',
    role: 'admin',
    is_pse: true,
    is_active: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    email: 'safina@pse.org',
    password: 'Password123!',
    full_name: 'Safina Begum',
    role: 'target_manager',
    is_pse: true,
    is_active: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    email: 'rahim@pse.org',
    password: 'Password123!',
    full_name: 'Rahim Chowdhury',
    role: 'member',
    is_pse: true,
    is_active: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    email: 'karim@pse.org',
    password: 'Password123!',
    full_name: 'Karim Ahmed',
    role: 'member',
    is_pse: true,
    is_active: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    email: 'nadia@pse.org',
    password: 'Password123!',
    full_name: 'Nadia Islam',
    role: 'member',
    is_pse: true,
    is_active: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000099',
    email: 'external@otherdept.org',
    password: 'Password123!',
    full_name: 'External Department User',
    role: 'member',
    is_pse: false,
    is_active: true,
  },
];

async function seedDemo() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Demo Users
    for (const u of DEMO_USERS) {
      await client.query(
        `INSERT INTO profiles (id, email, password_hash, full_name, role, team_id, is_pse, is_active)
         VALUES ($1, $2, $3, $4, $5::app_role, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             team_id = EXCLUDED.team_id,
             is_pse = EXCLUDED.is_pse,
             is_active = EXCLUDED.is_active`,
        [
          u.id,
          u.email,
          hashPassword(u.password),
          u.full_name,
          u.role,
          u.is_pse ? TEAM_ID : null,
          u.is_pse,
          u.is_active,
        ],
      );
    }

    // Fetch reference IDs
    const { rows: stages } = await client.query('SELECT id, name, kind FROM pipeline_stages');
    const stageMap = Object.fromEntries(stages.map((s) => [s.name, s.id]));

    const { rows: categories } = await client.query(
      'SELECT id, name FROM contribution_categories',
    );
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const { rows: verticals } = await client.query('SELECT id, name FROM verticals');
    const vertMap = Object.fromEntries(verticals.map((v) => [v.name, v.id]));

    // 2. Seed Demo Contacts (Companies + Individuals) with Channels inside deferred transaction
    const company1Id = '20000000-0000-0000-0000-000000000001';
    const company2Id = '20000000-0000-0000-0000-000000000002';
    const indiv1Id = '20000000-0000-0000-0000-000000000003';
    const indiv2Id = '20000000-0000-0000-0000-000000000004';

    await client.query(
      `INSERT INTO contacts (id, type, name, website, industry, notes, status, owner_id)
       VALUES
         ($1, 'company', 'Meghna Industrial Group (Demo)', 'https://meghna-demo.example.com', 'Manufacturing', 'CSR partner since 2024. Proposal folder: https://drive.google.com/drive/folders/demo-meghna', 'active', '10000000-0000-0000-0000-000000000003'),
         ($2, 'company', 'Bengal Financial Services (Demo)', 'https://bengalfin-demo.example.com', 'Banking & Finance', 'Annual sponsorship prospect.', 'active', '10000000-0000-0000-0000-000000000004')
       ON CONFLICT (id) DO NOTHING`,
      [company1Id, company2Id],
    );

    await client.query(
      `INSERT INTO contacts (id, type, name, organization_id, designation, notes, status, owner_id)
       VALUES
         ($1, 'individual', 'Tariq Hasan (Demo)', $3, 'Head of CSR', 'Primary point of contact for Meghna CSR grants.', 'active', '10000000-0000-0000-0000-000000000003'),
         ($2, 'individual', 'Farhana Kabir (Demo)', NULL, 'Philanthropist', 'Individual high-net-worth donor.', 'active', '10000000-0000-0000-0000-000000000005')
       ON CONFLICT (id) DO NOTHING`,
      [indiv1Id, indiv2Id, company1Id],
    );

    const demoChannels = [
      [company1Id, 'email', 'csr@meghna-demo.example.com', 'csr@meghna-demo.example.com', true],
      [company1Id, 'phone', '+8801711000001', '+8801711000001', false],
      [company2Id, 'email', 'partnerships@bengalfin-demo.example.com', 'partnerships@bengalfin-demo.example.com', true],
      [indiv1Id, 'email', 'tariq.hasan@meghna-demo.example.com', 'tariq.hasan@meghna-demo.example.com', true],
      [indiv1Id, 'phone', '+8801711000002', '+8801711000002', false],
      [indiv2Id, 'email', 'farhana.kabir@demo-donor.example.com', 'farhana.kabir@demo-donor.example.com', true],
    ];

    for (const [cid, kind, val, norm, primary] of demoChannels) {
      await client.query(
        `INSERT INTO contact_channels (contact_id, kind, value, value_normalized, is_primary)
         VALUES ($1, $2::channel_kind, $3, $4, $5)
         ON CONFLICT (kind, value_normalized) DO NOTHING`,
        [cid, kind, val, norm, primary],
      );
    }

    // 3. Seed Demo Pipelines & Receipts
    const pipe1Id = '30000000-0000-0000-0000-000000000001';
    const pipe2Id = '30000000-0000-0000-0000-000000000002';

    await client.query(
      `INSERT INTO pipelines (
         id, deal_name, focal_person_id, contribution_type, category_id, party_type,
         contact_id, poc_contact_id, stage_id, expected_amount, currency, amount_base,
         payment_interval, expected_close, country, description, notes, created_by
       )
       VALUES
         ($1, 'Meghna DSP Annual Grant 2026 (Demo)', '10000000-0000-0000-0000-000000000003', 'cash', $3, 'company',
          $5, $6, $7, 3000000.00, 'BDT', 3000000.00, 'quarterly', '2026-06-30', 'Bangladesh',
          'Corporate DSP sponsorship for 2026.', 'MOU link: https://drive.google.com/file/d/demo-mou', '10000000-0000-0000-0000-000000000003'),
         ($2, 'Farhana Kabir SAC Contribution (Demo)', '10000000-0000-0000-0000-000000000005', 'cash', $4, 'individual',
          $8, NULL, $9, 10000.00, 'USD', 1200000.00, 'one_time', '2026-11-15', 'Bangladesh',
          'Individual SAC pledge.', 'Pledge email logged.', '10000000-0000-0000-0000-000000000005')
       ON CONFLICT (id) DO NOTHING`,
      [
        pipe1Id,
        pipe2Id,
        catMap['DSP'],
        catMap['SAC'],
        company1Id,
        indiv1Id,
        stageMap['Won'],
        indiv2Id,
        stageMap['Submitted'],
      ],
    );

    await client.query(
      `INSERT INTO pipeline_receipts (id, pipeline_id, amount, currency, amount_base, received_on, note, created_by)
       VALUES (
         '40000000-0000-0000-0000-000000000001',
         $1,
         1500000.00,
         'BDT',
         1500000.00,
         '2026-10-15',
         'First installment received via bank transfer (Demo)',
         '10000000-0000-0000-0000-000000000003'
       )
       ON CONFLICT (id) DO NOTHING`,
      [pipe1Id],
    );

    // 4. Seed Demo Meeting & Activity
    const meeting1Id = '50000000-0000-0000-0000-000000000001';
    await client.query(
      `INSERT INTO meetings (id, contact_id, pipeline_id, scheduled_at, status, description, owner_id)
       VALUES ($1, $2, $3, '2026-10-20T10:00:00Z', 'done', 'Quarterly review meeting with Meghna CSR team.', '10000000-0000-0000-0000-000000000003')
       ON CONFLICT (id) DO NOTHING`,
      [meeting1Id, indiv1Id, pipe1Id],
    );

    await client.query(
      `INSERT INTO activities (id, type, class, title, owner_id, contact_id, pipeline_id, meeting_id, status, occurred_at, notes)
       VALUES (
         '60000000-0000-0000-0000-000000000001',
         'servicing',
         'stewardship',
         'Sent Q3 impact report to Meghna CSR (Demo)',
         '10000000-0000-0000-0000-000000000003',
         $1,
         $2,
         $3,
         'done',
         '2026-10-21T14:00:00Z',
         'Report link: https://drive.google.com/file/d/demo-impact-report'
       )
       ON CONFLICT (id) DO NOTHING`,
      [indiv1Id, pipe1Id, meeting1Id],
    );

    // 5. Seed Locked 2026 Target Plan (12,000,000 BDT annual = 3,000,000 per quarter across 3 members & 3 verticals)
    const planId = '70000000-0000-0000-0000-000000000001';
    const { rows: existingPlan } = await client.query(
      'SELECT id FROM target_plans WHERE id = $1',
      [planId],
    );

    if (existingPlan.length === 0) {
      await client.query(
        `INSERT INTO target_plans (id, year, team_id, annual_amount)
         VALUES ($1, 2026, $2, 12000000.00)`,
        [planId, TEAM_ID],
      );

      const memberIds = [
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000005',
      ];

      for (let q = 1; q <= 4; q++) {
        const qId = `70000000-0000-0000-0000-00000000010${q}`;
        await client.query(
          `INSERT INTO target_quarters (id, plan_id, quarter, amount)
           VALUES ($1, $2, $3, 3000000.00)`,
          [qId, planId, q],
        );

        // Each of the 3 members gets 1,000,000 BDT per quarter split 50% DSP, 30% VBD, 20% Project
        for (const uid of memberIds) {
          await client.query(
            `INSERT INTO target_lines (quarter_id, user_id, vertical_id, percent, amount)
             VALUES
               ($1, $2, $3, 50.000, 500000.00),
               ($1, $2, $4, 30.000, 300000.00),
               ($1, $2, $5, 20.000, 200000.00)`,
            [qId, uid, vertMap['DSP'], vertMap['VBD'], vertMap['Project']],
          );
        }
      }

      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [
        '10000000-0000-0000-0000-000000000002', // Safina (target_manager)
      ]);
      await client.query('SELECT publish_target_plan($1)', [planId]);
    }

    await client.query('COMMIT');
    console.log('Demo users and demo dataset seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemo().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
