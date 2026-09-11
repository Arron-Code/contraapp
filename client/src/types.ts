export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'ACCOUNTING' | 'VIEWER';
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  category: string;
  status: string;
  startDate: string;
  endDate: string | null;
  cancellationPeriodDays: number;
  autoRenewal: boolean;
  value: string;
  currency: string;
  billingCycle: string;
  company: string | null;
  contactId: string | null;
  owner: string;
}

export interface Claim {
  id: string;
  claimNumber: string;
  invoiceNumber: string | null;
  subject: string;
  status: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  paidAmount: string;
  currency: string;
  dunningLevel: number;
  company: string | null;
  contactId: string | null;
}

export interface Contact {
  id: string;
  type: string;
  company: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  priority: string;
  completed: boolean;
  assignee: string;
}
