import clsx from 'clsx';

const labels: Record<string, string> = {
  ACTIVE: 'Aktiv',
  DRAFT: 'Entwurf',
  EXPIRING: 'Läuft aus',
  ENDED: 'Beendet',
  CANCELLED: 'Storniert',
  OPEN: 'Offen',
  PARTIAL: 'Teilbezahlt',
  OVERDUE: 'Überfällig',
  IN_DUNNING: 'In Mahnung',
  PAID: 'Bezahlt',
  LOW: 'Niedrig',
  MEDIUM: 'Mittel',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('status-badge', `status-${status.toLowerCase()}`)}>
      <span className="status-dot" />
      {labels[status] ?? status}
    </span>
  );
}
