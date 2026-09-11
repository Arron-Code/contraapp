import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import type { AuthRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (request: AuthRequest, response) => {
  const tenantId = request.user!.tenantId;
  const [metrics, cashflow, deadlines, recentClaims] = await Promise.all([
    query<{
      activeContracts: number;
      annualValue: string;
      openClaims: string;
      overdueClaims: string;
      overdueCount: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM contracts WHERE tenant_id = $1 AND status = 'ACTIVE') AS "activeContracts",
         (SELECT coalesce(sum(value), 0) FROM contracts WHERE tenant_id = $1 AND status = 'ACTIVE') AS "annualValue",
         (SELECT coalesce(sum(amount - paid_amount), 0) FROM claims WHERE tenant_id = $1 AND status NOT IN ('PAID', 'CANCELLED')) AS "openClaims",
         (SELECT coalesce(sum(amount - paid_amount), 0) FROM claims WHERE tenant_id = $1 AND due_date < current_date AND status NOT IN ('PAID', 'CANCELLED')) AS "overdueClaims",
         (SELECT count(*)::int FROM claims WHERE tenant_id = $1 AND due_date < current_date AND status NOT IN ('PAID', 'CANCELLED')) AS "overdueCount"`,
      [tenantId],
    ),
    query<{ month: string; invoiced: string; paid: string }>(
      `WITH months AS (
         SELECT generate_series(date_trunc('month', current_date) - interval '5 months',
           date_trunc('month', current_date), interval '1 month') AS month
       )
       SELECT to_char(m.month, 'YYYY-MM') AS month,
         coalesce((SELECT sum(c.amount) FROM claims c WHERE c.tenant_id = $1 AND date_trunc('month', c.issue_date) = m.month), 0) AS invoiced,
         coalesce((SELECT sum(p.amount) FROM payments p WHERE p.tenant_id = $1 AND date_trunc('month', p.payment_date) = m.month), 0) AS paid
       FROM months m ORDER BY m.month`,
      [tenantId],
    ),
    query(
      `SELECT 'CONTRACT' AS type, c.id, c.title, c.end_date AS date,
              co.company AS counterpart
       FROM contracts c LEFT JOIN contacts co ON co.id = c.contact_id
       WHERE c.tenant_id = $1 AND c.end_date BETWEEN current_date AND current_date + 90
       UNION ALL
       SELECT 'TASK' AS type, t.id, t.title, t.due_date AS date, u.name AS counterpart
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.tenant_id = $1 AND NOT t.completed AND t.due_date <= current_date + 30
       ORDER BY date LIMIT 8`,
      [tenantId],
    ),
    query(
      `SELECT c.id, c.claim_number, c.subject, c.amount, c.paid_amount,
              c.due_date, c.status, co.company
       FROM claims c LEFT JOIN contacts co ON co.id = c.contact_id
       WHERE c.tenant_id = $1
       ORDER BY c.created_at DESC LIMIT 6`,
      [tenantId],
    ),
  ]);

  response.json({
    metrics: metrics[0],
    cashflow,
    deadlines,
    recentClaims,
  });
});

router.get('/search', async (request: AuthRequest, response) => {
  const term = String(request.query.q ?? '').trim();
  if (term.length < 2) {
    response.json([]);
    return;
  }
  const pattern = `%${term}%`;
  const results = await query(
    `SELECT 'CONTRACT' AS type, id, contract_number AS code, title AS label
     FROM contracts WHERE tenant_id = $1 AND (title ILIKE $2 OR contract_number ILIKE $2)
     UNION ALL
     SELECT 'CLAIM', id, claim_number, subject
     FROM claims WHERE tenant_id = $1 AND (subject ILIKE $2 OR claim_number ILIKE $2)
     UNION ALL
     SELECT 'CONTACT', id, '', company
     FROM contacts WHERE tenant_id = $1 AND company ILIKE $2
     LIMIT 15`,
    [request.user!.tenantId, pattern],
  );
  response.json(results);
});

export default router;
