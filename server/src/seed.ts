import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash('Demo123!', 12);
    const tenant = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('Nordstern Logistik GmbH', 'nordstern')
       ON CONFLICT (slug) DO UPDATE SET name = excluded.name RETURNING id`,
    );
    const tenantId = tenant.rows[0]!.id;
    const user = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, 'Anna Hoffmann', 'admin@demo.de', $2, 'OWNER')
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = excluded.password_hash
       RETURNING id`,
      [tenantId, passwordHash],
    );
    const userId = user.rows[0]!.id;

    const hanseResult = await client.query<{ id: string }>(
      `INSERT INTO contacts (tenant_id, type, company, contact_person, email, city)
       VALUES ($1, 'CUSTOMER', 'HanseWerk Solutions AG', 'Tobias Krüger', 't.krueger@hansewerk.de', 'Hamburg')
       RETURNING id`,
      [tenantId],
    );
    const rheinlandResult = await client.query<{ id: string }>(
      `INSERT INTO contacts (tenant_id, type, company, contact_person, email, city)
       VALUES ($1, 'CUSTOMER', 'Rheinland Handel GmbH', 'Miriam Beck', 'm.beck@rheinland.de', 'Köln')
       RETURNING id`,
      [tenantId],
    );
    const cloudResult = await client.query<{ id: string }>(
      `INSERT INTO contacts (tenant_id, type, company, contact_person, email, city)
       VALUES ($1, 'SUPPLIER', 'CloudCore Systems SE', 'Jan Winter', 'jan.winter@cloudcore.io', 'Berlin')
       RETURNING id`,
      [tenantId],
    );
    const hanse = hanseResult.rows[0]!.id;
    const rheinland = rheinlandResult.rows[0]!.id;
    const cloud = cloudResult.rows[0]!.id;

    const contract = await client.query<{ id: string }>(
      `INSERT INTO contracts
       (tenant_id, contact_id, owner_id, contract_number, title, category, status,
        start_date, end_date, auto_renewal, renewal_months, value, billing_cycle)
       VALUES ($1,$2,$3,'V-2026-001','Rahmenvertrag Transport Nord','Logistik','ACTIVE',
        '2026-01-01','2027-12-31',true,12,148000,'ANNUAL') RETURNING id`,
      [tenantId, hanse, userId],
    );
    await client.query(
      `INSERT INTO contracts
       (tenant_id, contact_id, owner_id, contract_number, title, category, status,
        start_date, end_date, value, billing_cycle)
       VALUES
       ($1,$2,$3,'V-2026-002','Lager- und Fulfillmentvertrag','Logistik','ACTIVE','2026-03-01','2027-02-28',84000,'ANNUAL'),
       ($1,$4,$3,'V-2025-018','Cloud-Infrastruktur Enterprise','IT','EXPIRING','2025-10-01','2026-10-15',36000,'ANNUAL')`,
      [tenantId, rheinland, userId, cloud],
    );
    await client.query(
      `INSERT INTO claims
       (tenant_id, contact_id, contract_id, claim_number, invoice_number, subject, status,
        issue_date, due_date, amount, paid_amount, dunning_level)
       VALUES
       ($1,$2,$3,'F-2026-0042','RE-260842','Transportleistungen August','OVERDUE','2026-08-01','2026-08-31',18450,0,1),
       ($1,$4,NULL,'F-2026-0043','RE-260843','Fulfillment August','PARTIAL','2026-08-05','2026-09-04',12900,5000,0),
       ($1,$2,$3,'F-2026-0044','RE-260844','Sondertransport Bremen','OPEN','2026-08-20','2026-09-19',6750,0,0)`,
      [tenantId, hanse, contract.rows[0]!.id, rheinland],
    );
    await client.query(
      `INSERT INTO tasks (tenant_id, assignee_id, contract_id, title, due_date, priority)
       VALUES
       ($1,$2,$3,'Verlängerungskonditionen vorbereiten','2026-09-18','HIGH'),
       ($1,$2,NULL,'Offene Posten mit Buchhaltung abstimmen','2026-09-12','URGENT')`,
      [tenantId, userId, contract.rows[0]!.id],
    );
    await client.query('COMMIT');
    console.log('Demo-Daten erstellt: nordstern / admin@demo.de / Demo123!');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
