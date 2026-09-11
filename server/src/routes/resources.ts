import { Router } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { audit } from '../audit.js';
import { allowRoles, requireAuth } from '../auth.js';
import { pool, query } from '../db.js';
import type { AuthRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

const writeRoles = allowRoles('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTING');
const adminRoles = allowRoles('OWNER', 'ADMIN');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ]);
    if (allowed.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Dieser Dateityp wird nicht unterstützt.'));
    }
  },
});

const contactSchema = z.object({
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'PARTNER', 'OTHER']),
  company: z.string().trim().min(2),
  contactPerson: z.string().trim().optional().nullable(),
  email: z.email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().optional().nullable(),
  street: z.string().trim().optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  country: z.string().trim().default('Deutschland'),
  taxId: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

router.get('/contacts', async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT id, type, company, contact_person AS "contactPerson", email, phone,
            street, postal_code AS "postalCode", city, country, tax_id AS "taxId",
            notes, created_at AS "createdAt"
     FROM contacts WHERE tenant_id = $1 ORDER BY company`,
    [request.user!.tenantId],
  ));
});

router.post('/contacts', writeRoles, async (request: AuthRequest, response) => {
  const data = contactSchema.parse(request.body);
  const [contact] = await query<{ id: string }>(
    `INSERT INTO contacts
      (tenant_id, type, company, contact_person, email, phone, street, postal_code, city, country, tax_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [request.user!.tenantId, data.type, data.company, data.contactPerson, data.email,
      data.phone, data.street, data.postalCode, data.city, data.country, data.taxId, data.notes],
  );
  await audit(request.user!.tenantId, request.user!.id, 'CREATE', 'CONTACT', contact!.id);
  response.status(201).json(contact);
});

const contractSchema = z.object({
  contactId: z.uuid().optional().nullable(),
  contractNumber: z.string().trim().min(2),
  title: z.string().trim().min(3),
  category: z.string().trim().min(2),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRING', 'ENDED', 'CANCELLED']),
  startDate: z.iso.date(),
  endDate: z.iso.date().optional().nullable(),
  cancellationPeriodDays: z.number().int().min(0).default(90),
  autoRenewal: z.boolean().default(false),
  renewalMonths: z.number().int().positive().optional().nullable(),
  value: z.number().min(0),
  currency: z.string().length(3).default('EUR'),
  billingCycle: z.string().default('MONTHLY'),
  description: z.string().optional().nullable(),
});

router.get('/contracts', async (request: AuthRequest, response) => {
  const status = request.query.status;
  const values: unknown[] = [request.user!.tenantId];
  let statusFilter = '';
  if (typeof status === 'string' && status) {
    values.push(status);
    statusFilter = ` AND c.status = $${values.length}`;
  }
  response.json(await query(
    `SELECT c.id, c.contract_number AS "contractNumber", c.title, c.category,
            c.status, c.start_date AS "startDate", c.end_date AS "endDate",
            c.cancellation_period_days AS "cancellationPeriodDays",
            c.auto_renewal AS "autoRenewal", c.value, c.currency,
            c.billing_cycle AS "billingCycle", co.company, co.id AS "contactId",
            u.name AS owner
     FROM contracts c
     LEFT JOIN contacts co ON co.id = c.contact_id
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.tenant_id = $1${statusFilter}
     ORDER BY c.end_date NULLS LAST, c.created_at DESC`,
    values,
  ));
});

router.post('/contracts', writeRoles, async (request: AuthRequest, response) => {
  const data = contractSchema.parse(request.body);
  const [contract] = await query<{ id: string }>(
    `INSERT INTO contracts
      (tenant_id, contact_id, owner_id, contract_number, title, category, status,
       start_date, end_date, cancellation_period_days, auto_renewal, renewal_months,
       value, currency, billing_cycle, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [request.user!.tenantId, data.contactId, request.user!.id, data.contractNumber,
      data.title, data.category, data.status, data.startDate, data.endDate,
      data.cancellationPeriodDays, data.autoRenewal, data.renewalMonths, data.value,
      data.currency.toUpperCase(), data.billingCycle, data.description],
  );
  await audit(request.user!.tenantId, request.user!.id, 'CREATE', 'CONTRACT', contract!.id);
  response.status(201).json(contract);
});

const claimSchema = z.object({
  contactId: z.uuid().optional().nullable(),
  contractId: z.uuid().optional().nullable(),
  claimNumber: z.string().trim().min(2),
  invoiceNumber: z.string().trim().optional().nullable(),
  subject: z.string().trim().min(3),
  status: z.enum(['OPEN', 'PARTIAL', 'OVERDUE', 'IN_DUNNING', 'PAID', 'CANCELLED']).default('OPEN'),
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().optional().nullable(),
});

router.get('/claims', async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT c.id, c.claim_number AS "claimNumber", c.invoice_number AS "invoiceNumber",
            c.subject, c.status, c.issue_date AS "issueDate", c.due_date AS "dueDate",
            c.amount, c.paid_amount AS "paidAmount", c.currency,
            c.dunning_level AS "dunningLevel", co.company, co.id AS "contactId"
     FROM claims c LEFT JOIN contacts co ON co.id = c.contact_id
     WHERE c.tenant_id = $1
     ORDER BY (c.status NOT IN ('PAID','CANCELLED')) DESC, c.due_date`,
    [request.user!.tenantId],
  ));
});

router.post('/claims', writeRoles, async (request: AuthRequest, response) => {
  const data = claimSchema.parse(request.body);
  const [claim] = await query<{ id: string }>(
    `INSERT INTO claims
      (tenant_id, contact_id, contract_id, claim_number, invoice_number, subject,
       status, issue_date, due_date, amount, currency, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [request.user!.tenantId, data.contactId, data.contractId, data.claimNumber,
      data.invoiceNumber, data.subject, data.status, data.issueDate, data.dueDate,
      data.amount, data.currency.toUpperCase(), data.notes],
  );
  await audit(request.user!.tenantId, request.user!.id, 'CREATE', 'CLAIM', claim!.id);
  response.status(201).json(claim);
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.iso.date(),
  method: z.string().default('BANK_TRANSFER'),
  reference: z.string().optional().nullable(),
});

router.post('/claims/:id/payments', writeRoles, async (request: AuthRequest, response) => {
  const data = paymentSchema.parse(request.body);
  const claimId = String(request.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimResult = await client.query<{ amount: string; paid_amount: string }>(
      'SELECT amount, paid_amount FROM claims WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [claimId, request.user!.tenantId],
    );
    const claim = claimResult.rows[0];
    if (!claim) {
      await client.query('ROLLBACK');
      response.status(404).json({ message: 'Forderung nicht gefunden.' });
      return;
    }
    const outstanding = Number(claim.amount) - Number(claim.paid_amount);
    if (data.amount > outstanding) {
      await client.query('ROLLBACK');
      response.status(400).json({ message: 'Zahlung ist höher als der offene Betrag.' });
      return;
    }
    await client.query(
      `INSERT INTO payments (tenant_id, claim_id, amount, payment_date, method, reference)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [request.user!.tenantId, claimId, data.amount, data.paymentDate, data.method, data.reference],
    );
    const status = data.amount === outstanding ? 'PAID' : 'PARTIAL';
    await client.query(
      `UPDATE claims SET paid_amount = paid_amount + $1, status = $2, updated_at = now()
       WHERE id = $3 AND tenant_id = $4`,
      [data.amount, status, claimId, request.user!.tenantId],
    );
    await client.query('COMMIT');
    await audit(request.user!.tenantId, request.user!.id, 'PAYMENT', 'CLAIM', claimId, { amount: data.amount });
    response.status(201).json({ message: 'Zahlung wurde verbucht.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

const dunningSchema = z.object({
  fee: z.number().min(0).default(0),
  noticeDate: z.iso.date(),
  newDueDate: z.iso.date(),
  sentVia: z.enum(['EMAIL', 'POST', 'PORTAL']).default('EMAIL'),
  notes: z.string().optional().nullable(),
});

router.post('/claims/:id/dunning', writeRoles, async (request: AuthRequest, response) => {
  const data = dunningSchema.parse(request.body);
  const claimId = String(request.params.id);
  const [claim] = await query<{ dunning_level: number }>(
    'SELECT dunning_level FROM claims WHERE id = $1 AND tenant_id = $2',
    [claimId, request.user!.tenantId],
  );
  if (!claim) {
    response.status(404).json({ message: 'Forderung nicht gefunden.' });
    return;
  }
  const level = claim.dunning_level + 1;
  await query(
    `INSERT INTO dunning_notices
      (tenant_id, claim_id, level, fee, notice_date, new_due_date, sent_via, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [request.user!.tenantId, claimId, level, data.fee, data.noticeDate,
      data.newDueDate, data.sentVia, data.notes],
  );
  await query(
    `UPDATE claims SET status = 'IN_DUNNING', dunning_level = $1, due_date = $2,
       updated_at = now() WHERE id = $3 AND tenant_id = $4`,
    [level, data.newDueDate, claimId, request.user!.tenantId],
  );
  await audit(request.user!.tenantId, request.user!.id, 'DUNNING', 'CLAIM', claimId, { level });
  response.status(201).json({ message: `Mahnstufe ${level} wurde erstellt.` });
});

const taskSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().optional().nullable(),
  dueDate: z.iso.date(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.uuid().optional().nullable(),
  contractId: z.uuid().optional().nullable(),
  claimId: z.uuid().optional().nullable(),
});

router.get('/tasks', async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT t.id, t.title, t.description, t.due_date AS "dueDate", t.priority,
            t.completed, u.name AS assignee, t.contract_id AS "contractId",
            t.claim_id AS "claimId"
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.tenant_id = $1 ORDER BY t.completed, t.due_date`,
    [request.user!.tenantId],
  ));
});

router.post('/tasks', writeRoles, async (request: AuthRequest, response) => {
  const data = taskSchema.parse(request.body);
  const [task] = await query<{ id: string }>(
    `INSERT INTO tasks
      (tenant_id, assignee_id, contract_id, claim_id, title, description, due_date, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [request.user!.tenantId, data.assigneeId ?? request.user!.id, data.contractId,
      data.claimId, data.title, data.description, data.dueDate, data.priority],
  );
  await audit(request.user!.tenantId, request.user!.id, 'CREATE', 'TASK', task!.id);
  response.status(201).json(task);
});

router.patch('/tasks/:id/toggle', writeRoles, async (request: AuthRequest, response) => {
  const [task] = await query(
    `UPDATE tasks SET completed = NOT completed
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [request.params.id, request.user!.tenantId],
  );
  if (!task) {
    response.status(404).json({ message: 'Aufgabe nicht gefunden.' });
    return;
  }
  response.json(task);
});

router.get('/documents', async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT d.id, d.name, d.category, d.file_url AS "fileUrl", d.mime_type AS "mimeType",
            d.size_bytes AS "sizeBytes", d.created_at AS "createdAt",
            c.title AS contract, cl.subject AS claim
     FROM documents d
     LEFT JOIN contracts c ON c.id = d.contract_id
     LEFT JOIN claims cl ON cl.id = d.claim_id
     WHERE d.tenant_id = $1 ORDER BY d.created_at DESC`,
    [request.user!.tenantId],
  ));
});

router.post('/documents', writeRoles, upload.single('file'), async (request: AuthRequest, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'Bitte eine Datei auswählen.' });
    return;
  }
  const category = String(request.body.category || 'OTHER');
  const contractId = request.body.contractId ? String(request.body.contractId) : null;
  const claimId = request.body.claimId ? String(request.body.claimId) : null;
  const tenantDirectory = path.resolve('uploads', request.user!.tenantId);
  await mkdir(tenantDirectory, { recursive: true });
  const extension = path.extname(request.file.originalname).slice(0, 12);
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(path.join(tenantDirectory, storedName), request.file.buffer);
  const [document] = await query<{ id: string }>(
    `INSERT INTO documents
      (tenant_id, contract_id, claim_id, name, category, file_url, mime_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [request.user!.tenantId, contractId, claimId, request.file.originalname, category,
      storedName, request.file.mimetype, request.file.size],
  );
  await audit(request.user!.tenantId, request.user!.id, 'UPLOAD', 'DOCUMENT', document!.id);
  response.status(201).json(document);
});

router.get('/documents/:id/download', async (request: AuthRequest, response) => {
  const [document] = await query<{ name: string; file_url: string }>(
    'SELECT name, file_url FROM documents WHERE id = $1 AND tenant_id = $2',
    [request.params.id, request.user!.tenantId],
  );
  if (!document) {
    response.status(404).json({ message: 'Dokument nicht gefunden.' });
    return;
  }
  const file = path.resolve('uploads', request.user!.tenantId, document.file_url);
  response.download(file, document.name);
});

router.get('/audit', adminRoles, async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
            a.metadata, a.created_at AS "createdAt", u.name AS user
     FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.tenant_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
    [request.user!.tenantId],
  ));
});

router.get('/users', adminRoles, async (request: AuthRequest, response) => {
  response.json(await query(
    `SELECT id, name, email, role, active, created_at AS "createdAt"
     FROM users WHERE tenant_id = $1 ORDER BY name`,
    [request.user!.tenantId],
  ));
});

export default router;
