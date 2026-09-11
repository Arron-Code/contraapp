import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://ericargo:ericargo@localhost:5432/ericargo',
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error', error);
});

export async function query<T>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T & pg.QueryResultRow>(text, values);
  return result.rows;
}
