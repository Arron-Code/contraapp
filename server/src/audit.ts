import { query } from './db.js';

export async function audit(
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await query(
    `INSERT INTO audit_events
      (tenant_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, userId, action, entityType, entityId ?? null, metadata],
  );
}
