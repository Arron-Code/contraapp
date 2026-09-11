CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTING', 'VIEWER');
CREATE TYPE contract_status AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'ENDED', 'CANCELLED');
CREATE TYPE claim_status AS ENUM ('OPEN', 'PARTIAL', 'OVERDUE', 'IN_DUNNING', 'PAID', 'CANCELLED');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'VIEWER',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CUSTOMER', 'SUPPLIER', 'PARTNER', 'OTHER')),
  company text NOT NULL,
  contact_person text,
  email text,
  phone text,
  street text,
  postal_code text,
  city text,
  country text NOT NULL DEFAULT 'Deutschland',
  tax_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contract_number text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  status contract_status NOT NULL DEFAULT 'DRAFT',
  start_date date NOT NULL,
  end_date date,
  cancellation_period_days integer NOT NULL DEFAULT 90,
  auto_renewal boolean NOT NULL DEFAULT false,
  renewal_months integer,
  value numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'EUR',
  billing_cycle text NOT NULL DEFAULT 'MONTHLY',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contract_number)
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  claim_number text NOT NULL,
  invoice_number text,
  subject text NOT NULL,
  status claim_status NOT NULL DEFAULT 'OPEN',
  issue_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'EUR',
  dunning_level integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, claim_number)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  method text NOT NULL DEFAULT 'BANK_TRANSFER',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dunning_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  level integer NOT NULL,
  fee numeric(14,2) NOT NULL DEFAULT 0,
  notice_date date NOT NULL,
  new_due_date date NOT NULL,
  sent_via text NOT NULL DEFAULT 'EMAIL',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES claims(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  priority task_priority NOT NULL DEFAULT 'MEDIUM',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES claims(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_tenant_idx ON contacts(tenant_id);
CREATE INDEX contracts_tenant_status_idx ON contracts(tenant_id, status);
CREATE INDEX claims_tenant_status_due_idx ON claims(tenant_id, status, due_date);
CREATE INDEX tasks_tenant_due_idx ON tasks(tenant_id, completed, due_date);
CREATE INDEX audit_tenant_created_idx ON audit_events(tenant_id, created_at DESC);
