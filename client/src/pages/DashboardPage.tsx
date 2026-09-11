import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleDollarSign, FileCheck2, Plus, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardData {
  metrics: {
    activeContracts: number;
    annualValue: string;
    openClaims: string;
    overdueClaims: string;
    overdueCount: number;
  };
  cashflow: Array<{ month: string; invoiced: string; paid: string }>;
  deadlines: Array<{ id: string; type: string; title: string; date: string; counterpart: string }>;
  recentClaims: Array<{
    id: string; claim_number: string; subject: string; amount: string;
    paid_amount: string; due_date: string; status: string; company: string;
  }>;
}

const money = (value: string | number) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat('de-DE').format(new Date(value));

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/dashboard').then(setData).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <div className="empty-state"><h3>Dashboard nicht verfügbar</h3><p>{error}</p></div>;
  if (!data) return <div className="loading-grid"><i /><i /><i /><i /></div>;

  const maxBar = Math.max(...data.cashflow.map((item) => Number(item.invoiced)), 1);
  return (
    <>
      <div className="quick-actions">
        <Link className="primary-button" to="/vertraege"><Plus size={18} />Neuer Vertrag</Link>
        <Link className="secondary-button" to="/forderungen"><Plus size={18} />Neue Forderung</Link>
      </div>
      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-icon green"><FileCheck2 /></div>
          <span>Aktive Verträge</span><strong>{data.metrics.activeContracts}</strong>
          <small><ArrowUpRight /> 3 in den letzten 30 Tagen</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon gold"><TrendingUp /></div>
          <span>Vertragsvolumen</span><strong>{money(data.metrics.annualValue)}</strong>
          <small><ArrowUpRight /> 8,4 % zum Vorjahr</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><CircleDollarSign /></div>
          <span>Offene Forderungen</span><strong>{money(data.metrics.openClaims)}</strong>
          <small className="neutral">Über alle offenen Posten</small>
        </article>
        <article className="metric-card alert">
          <div className="metric-icon red"><CalendarClock /></div>
          <span>Davon überfällig</span><strong>{money(data.metrics.overdueClaims)}</strong>
          <small className="negative"><ArrowDownRight /> {data.metrics.overdueCount} Vorgänge prüfen</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel cashflow-panel">
          <div className="panel-header"><div><span className="eyebrow">Finanzübersicht</span><h2>Fakturierung & Zahlungseingang</h2></div><select><option>Letzte 6 Monate</option></select></div>
          <div className="legend"><span><i className="invoiced" />Fakturiert</span><span><i className="paid" />Bezahlt</span></div>
          <div className="bar-chart">
            {data.cashflow.map((item) => (
              <div className="bar-group" key={item.month}>
                <div className="bars">
                  <i className="bar invoiced" style={{ height: `${Math.max(8, Number(item.invoiced) / maxBar * 100)}%` }} />
                  <i className="bar paid" style={{ height: `${Math.max(5, Number(item.paid) / maxBar * 100)}%` }} />
                </div>
                <span>{new Date(`${item.month}-01`).toLocaleDateString('de-DE', { month: 'short' })}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel deadline-panel">
          <div className="panel-header"><div><span className="eyebrow">Nächste Schritte</span><h2>Anstehende Fristen</h2></div><button className="text-button">Alle anzeigen</button></div>
          <div className="deadline-list">
            {data.deadlines.map((item) => (
              <div className="deadline-item" key={`${item.type}-${item.id}`}>
                <div className="date-tile"><strong>{new Date(item.date).getDate()}</strong><span>{new Date(item.date).toLocaleDateString('de-DE', { month: 'short' })}</span></div>
                <div><strong>{item.title}</strong><span>{item.counterpart || (item.type === 'TASK' ? 'Interne Aufgabe' : 'Ohne Kontakt')}</span></div>
                <span className="days-left">{Math.max(0, Math.ceil((new Date(item.date).getTime() - Date.now()) / 86400000))} Tage</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-header"><div><span className="eyebrow">Zuletzt aktualisiert</span><h2>Aktuelle Forderungen</h2></div><button className="text-button">Alle Forderungen →</button></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Nr.</th><th>Kunde / Betreff</th><th>Fällig</th><th>Betrag</th><th>Offen</th><th>Status</th></tr></thead>
          <tbody>{data.recentClaims.map((claim) => (
            <tr key={claim.id}><td className="code">{claim.claim_number}</td><td><strong>{claim.company}</strong><small>{claim.subject}</small></td><td>{date(claim.due_date)}</td><td>{money(claim.amount)}</td><td><strong>{money(Number(claim.amount) - Number(claim.paid_amount))}</strong></td><td><StatusBadge status={claim.status} /></td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </>
  );
}
