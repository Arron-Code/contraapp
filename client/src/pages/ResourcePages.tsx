import {
  Archive, Building2, Check, Download, File, Filter, History, Mail,
  MoreHorizontal, Plus, Search, Settings2, Upload, UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, download } from '../api';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { Claim, Contact, Contract, TaskItem } from '../types';

const money = (value: string | number, currency = 'EUR') => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(Number(value));
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('de-DE').format(new Date(value))
  : 'Unbefristet';

function useResource<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api<T[]>(path).then(setItems).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [path]);
  useEffect(load, [load]);
  return { items, loading, error, load };
}

function PageToolbar({ action, onAction }: { action: string; onAction?: () => void }) {
  return (
    <div className="resource-toolbar">
      <div className="inline-search"><Search size={17} /><input placeholder="In dieser Ansicht suchen..." /></div>
      <button className="filter-button"><Filter size={17} /> Filter</button>
      <button className="primary-button" onClick={onAction}><Plus size={18} />{action}</button>
    </div>
  );
}

function ResourceState({ loading, error, children }: { loading: boolean; error: string; children: ReactNode }) {
  if (loading) return <div className="resource-loading">Daten werden geladen…</div>;
  if (error) return <div className="empty-state"><h3>Daten nicht verfügbar</h3><p>{error}</p></div>;
  return children;
}

export function ContractsPage() {
  const { items, loading, error, load } = useResource<Contract>('/contracts');
  const contacts = useResource<Contact>('/contacts');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/contracts', { method: 'POST', body: JSON.stringify({
        contactId: form.get('contactId') || null,
        contractNumber: form.get('contractNumber'),
        title: form.get('title'),
        category: form.get('category'),
        status: form.get('status'),
        startDate: form.get('startDate'),
        endDate: form.get('endDate') || null,
        cancellationPeriodDays: Number(form.get('cancellationPeriodDays')),
        autoRenewal: form.get('autoRenewal') === 'on',
        value: Number(form.get('value')),
        currency: 'EUR',
        billingCycle: form.get('billingCycle'),
      }) });
      setOpen(false); load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.'); }
  }

  return (
    <>
      <PageToolbar action="Vertrag anlegen" onAction={() => setOpen(true)} />
      <section className="summary-strip">
        <div><span>Gesamt</span><strong>{items.length} Verträge</strong></div>
        <div><span>Aktiv</span><strong>{items.filter((item) => item.status === 'ACTIVE').length}</strong></div>
        <div><span>Auslaufend</span><strong>{items.filter((item) => item.status === 'EXPIRING').length}</strong></div>
        <div><span>Vertragswert</span><strong>{money(items.reduce((sum, item) => sum + Number(item.value), 0))}</strong></div>
      </section>
      <ResourceState loading={loading} error={error}>
        <section className="panel table-panel"><div className="table-scroll"><table>
          <thead><tr><th>Vertrag</th><th>Vertragspartner</th><th>Kategorie</th><th>Laufzeit</th><th>Wert</th><th>Status</th><th /></tr></thead>
          <tbody>{items.map((contract) => (
            <tr key={contract.id}>
              <td><strong>{contract.title}</strong><small className="code">{contract.contractNumber}</small></td>
              <td>{contract.company ?? '–'}</td><td>{contract.category}</td>
              <td>{date(contract.startDate)} – {date(contract.endDate)}</td>
              <td><strong>{money(contract.value, contract.currency)}</strong><small>{contract.billingCycle}</small></td>
              <td><StatusBadge status={contract.status} /></td><td><button className="icon-button"><MoreHorizontal /></button></td>
            </tr>
          ))}</tbody>
        </table></div></section>
      </ResourceState>
      {open && <Modal title="Vertrag anlegen" onClose={() => setOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-row"><label>Vertragsnummer<input name="contractNumber" required placeholder="V-2026-..." /></label><label>Status<select name="status"><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktiv</option><option value="EXPIRING">Läuft aus</option></select></label></div>
          <label>Bezeichnung<input name="title" required placeholder="z. B. Rahmenvertrag Transport" /></label>
          <div className="form-row"><label>Vertragspartner<select name="contactId"><option value="">Kein Kontakt</option>{contacts.items.map((item) => <option value={item.id} key={item.id}>{item.company}</option>)}</select></label><label>Kategorie<input name="category" required placeholder="Logistik, IT, Miete..." /></label></div>
          <div className="form-row"><label>Beginn<input name="startDate" type="date" required /></label><label>Ende<input name="endDate" type="date" /></label></div>
          <div className="form-row"><label>Vertragswert<input name="value" type="number" min="0" step="0.01" required /></label><label>Abrechnung<select name="billingCycle"><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ANNUAL">Jährlich</option><option value="ONE_TIME">Einmalig</option></select></label></div>
          <div className="form-row"><label>Kündigungsfrist (Tage)<input name="cancellationPeriodDays" type="number" defaultValue="90" min="0" /></label><label className="checkbox-label"><input name="autoRenewal" type="checkbox" /> Automatische Verlängerung</label></div>
          {formError && <div className="form-error">{formError}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Abbrechen</button><button className="primary-button">Vertrag speichern</button></div>
        </form>
      </Modal>}
    </>
  );
}

export function ClaimsPage() {
  const { items, loading, error, load } = useResource<Claim>('/claims');
  const contacts = useResource<Contact>('/contacts');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const outstanding = items.reduce((sum, item) => sum + Number(item.amount) - Number(item.paidAmount), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/claims', { method: 'POST', body: JSON.stringify({
        contactId: form.get('contactId') || null,
        claimNumber: form.get('claimNumber'),
        invoiceNumber: form.get('invoiceNumber') || null,
        subject: form.get('subject'),
        status: 'OPEN',
        issueDate: form.get('issueDate'),
        dueDate: form.get('dueDate'),
        amount: Number(form.get('amount')),
        currency: 'EUR',
      }) });
      setOpen(false); load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.'); }
  }

  return (
    <>
      <PageToolbar action="Forderung anlegen" onAction={() => setOpen(true)} />
      <section className="summary-strip">
        <div><span>Offener Gesamtbetrag</span><strong>{money(outstanding)}</strong></div>
        <div><span>Überfällig</span><strong className="danger-text">{money(items.filter((item) => ['OVERDUE', 'IN_DUNNING'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount) - Number(item.paidAmount), 0))}</strong></div>
        <div><span>Im Mahnlauf</span><strong>{items.filter((item) => item.status === 'IN_DUNNING').length}</strong></div>
        <div><span>Bezahlt</span><strong>{items.filter((item) => item.status === 'PAID').length}</strong></div>
      </section>
      <ResourceState loading={loading} error={error}>
        <section className="panel table-panel"><div className="table-scroll"><table>
          <thead><tr><th>Forderung</th><th>Debitor</th><th>Fällig</th><th>Betrag</th><th>Offen</th><th>Mahnstufe</th><th>Status</th><th /></tr></thead>
          <tbody>{items.map((claim) => (
            <tr key={claim.id}><td><strong>{claim.subject}</strong><small className="code">{claim.claimNumber} · {claim.invoiceNumber}</small></td><td>{claim.company ?? '–'}</td><td>{date(claim.dueDate)}</td><td>{money(claim.amount)}</td><td><strong>{money(Number(claim.amount) - Number(claim.paidAmount))}</strong></td><td>{claim.dunningLevel || '–'}</td><td><StatusBadge status={claim.status} /></td><td><button className="icon-button"><MoreHorizontal /></button></td></tr>
          ))}</tbody>
        </table></div></section>
      </ResourceState>
      {open && <Modal title="Forderung anlegen" onClose={() => setOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-row"><label>Forderungsnummer<input name="claimNumber" required placeholder="F-2026-..." /></label><label>Rechnungsnummer<input name="invoiceNumber" placeholder="RE-..." /></label></div>
          <label>Betreff<input name="subject" required placeholder="Leistung / Lieferzeitraum" /></label>
          <label>Debitor<select name="contactId"><option value="">Kein Kontakt</option>{contacts.items.map((item) => <option value={item.id} key={item.id}>{item.company}</option>)}</select></label>
          <div className="form-row"><label>Rechnungsdatum<input name="issueDate" type="date" required /></label><label>Fälligkeit<input name="dueDate" type="date" required /></label></div>
          <label>Betrag (EUR)<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          {formError && <div className="form-error">{formError}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Abbrechen</button><button className="primary-button">Forderung speichern</button></div>
        </form>
      </Modal>}
    </>
  );
}

export function ContactsPage() {
  const { items, loading, error, load } = useResource<Contact>('/contacts');
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api('/contacts', { method: 'POST', body: JSON.stringify({
      type: form.get('type'), company: form.get('company'), contactPerson: form.get('contactPerson'),
      email: form.get('email'), phone: form.get('phone'), city: form.get('city'), country: 'Deutschland',
    }) });
    setOpen(false); load();
  }
  return <>
    <PageToolbar action="Kontakt anlegen" onAction={() => setOpen(true)} />
    <ResourceState loading={loading} error={error}>
      <div className="contact-grid">{items.map((contact) => <article className="contact-card" key={contact.id}>
        <div className="contact-card-top"><div className="company-avatar">{contact.company.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><StatusBadge status={contact.type} /></div>
        <h3>{contact.company}</h3><p>{contact.contactPerson || 'Kein Ansprechpartner'}</p>
        <div className="contact-details">{contact.email && <span><Mail size={15} />{contact.email}</span>}<span><Building2 size={15} />{contact.city || '–'}, {contact.country}</span></div>
        <button className="secondary-button full">Details öffnen</button>
      </article>)}</div>
    </ResourceState>
    {open && <Modal title="Kontakt anlegen" onClose={() => setOpen(false)}><form className="modal-form" onSubmit={submit}>
      <div className="form-row"><label>Typ<select name="type"><option value="CUSTOMER">Kunde</option><option value="SUPPLIER">Lieferant</option><option value="PARTNER">Partner</option><option value="OTHER">Sonstige</option></select></label><label>Unternehmen<input name="company" required /></label></div>
      <label>Ansprechpartner<input name="contactPerson" /></label>
      <div className="form-row"><label>E-Mail<input name="email" type="email" /></label><label>Telefon<input name="phone" /></label></div>
      <label>Ort<input name="city" /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Abbrechen</button><button className="primary-button">Kontakt speichern</button></div>
    </form></Modal>}
  </>;
}

export function TasksPage() {
  const { items, loading, error, load } = useResource<TaskItem>('/tasks');
  const [open, setOpen] = useState(false);
  async function toggle(id: string) { await api(`/tasks/${id}/toggle`, { method: 'PATCH' }); load(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await api('/tasks', { method: 'POST', body: JSON.stringify({ title: form.get('title'), description: form.get('description'), dueDate: form.get('dueDate'), priority: form.get('priority') }) });
    setOpen(false); load();
  }
  return <>
    <PageToolbar action="Aufgabe anlegen" onAction={() => setOpen(true)} />
    <ResourceState loading={loading} error={error}><section className="task-board">
      {['Offen', 'Erledigt'].map((column) => <div className="task-column" key={column}><div className="task-column-title"><h3>{column}</h3><span>{items.filter((item) => item.completed === (column === 'Erledigt')).length}</span></div>
        {items.filter((item) => item.completed === (column === 'Erledigt')).map((item) => <article className="task-card" key={item.id}>
          <button className={item.completed ? 'task-check checked' : 'task-check'} onClick={() => toggle(item.id)}>{item.completed && <Check size={15} />}</button>
          <div><StatusBadge status={item.priority} /><h4>{item.title}</h4><p>{item.description}</p><small>{date(item.dueDate)} · {item.assignee}</small></div>
        </article>)}
      </div>)}
    </section></ResourceState>
    {open && <Modal title="Aufgabe anlegen" onClose={() => setOpen(false)}><form className="modal-form" onSubmit={submit}>
      <label>Titel<input name="title" required /></label><label>Beschreibung<textarea name="description" rows={3} /></label>
      <div className="form-row"><label>Fällig am<input name="dueDate" type="date" required /></label><label>Priorität<select name="priority"><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option><option value="LOW">Niedrig</option></select></label></div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Abbrechen</button><button className="primary-button">Aufgabe speichern</button></div>
    </form></Modal>}
  </>;
}

interface DocumentItem { id: string; name: string; category: string; fileUrl: string; mimeType: string; sizeBytes: number; createdAt: string; contract: string | null; claim: string | null }
export function DocumentsPage() {
  const { items, loading, error, load } = useResource<DocumentItem>('/documents');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/documents', { method: 'POST', body: form });
      setOpen(false); load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Upload fehlgeschlagen.'); }
  }
  return <>
    <PageToolbar action="Dokument hochladen" onAction={() => setOpen(true)} />
    <div className="drop-zone"><Upload size={28} /><strong>Dateien zentral und sicher ablegen</strong><span>PDF, Word, Excel oder Bilder bis 20 MB</span><button className="secondary-button" onClick={() => setOpen(true)}>Datei auswählen</button></div>
    <ResourceState loading={loading} error={error}><section className="panel table-panel"><div className="table-scroll"><table>
      <thead><tr><th>Dokument</th><th>Kategorie</th><th>Zuordnung</th><th>Hochgeladen</th><th>Größe</th><th /></tr></thead>
      <tbody>{items.length ? items.map((item) => <tr key={item.id}><td><div className="file-name"><File size={20} /><strong>{item.name}</strong></div></td><td>{item.category}</td><td>{item.contract || item.claim || '–'}</td><td>{date(item.createdAt)}</td><td>{Math.round(item.sizeBytes / 1024)} KB</td><td><button className="icon-button" onClick={() => download(`/documents/${item.id}/download`, item.name)}><Download /></button></td></tr>) : <tr><td colSpan={6}><div className="empty-inline"><Archive /><strong>Noch keine Dokumente</strong><span>Legen Sie den ersten Beleg zu einem Vertrag oder einer Forderung ab.</span></div></td></tr>}</tbody>
    </table></div></section></ResourceState>
    {open && <Modal title="Dokument hochladen" onClose={() => setOpen(false)}><form className="modal-form" onSubmit={submit}>
      <label>Datei<input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /></label>
      <label>Kategorie<select name="category"><option value="CONTRACT">Vertrag</option><option value="INVOICE">Rechnung</option><option value="DUNNING">Mahnung</option><option value="CORRESPONDENCE">Korrespondenz</option><option value="OTHER">Sonstiges</option></select></label>
      {formError && <div className="form-error">{formError}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Abbrechen</button><button className="primary-button">Hochladen</button></div>
    </form></Modal>}
  </>;
}

interface TeamUser { id: string; name: string; email: string; role: string; active: boolean }
interface AuditEvent { id: string; action: string; entityType: string; createdAt: string; user: string }
export function TeamPage() {
  const users = useResource<TeamUser>('/users');
  const events = useResource<AuditEvent>('/audit');
  return <>
    <PageToolbar action="Mitglied einladen" />
    <section className="settings-grid">
      <article className="panel settings-panel"><div className="panel-header"><div><span className="eyebrow">Berechtigungen</span><h2>Teammitglieder</h2></div><UserPlus /></div>
        {users.items.map((user) => <div className="team-row" key={user.id}><div className="user-avatar">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{user.name}</strong><span>{user.email}</span></div><StatusBadge status={user.role} /></div>)}
      </article>
      <article className="panel settings-panel"><div className="panel-header"><div><span className="eyebrow">Nachvollziehbarkeit</span><h2>Letzte Änderungen</h2></div><History /></div>
        {events.items.map((event) => <div className="audit-row" key={event.id}><span className="audit-dot" /><div><strong>{event.user} · {event.action}</strong><span>{event.entityType} · {new Date(event.createdAt).toLocaleString('de-DE')}</span></div></div>)}
      </article>
    </section>
  </>;
}

export function SettingsPage() {
  return <section className="settings-grid">
    <article className="panel settings-panel"><div className="settings-icon"><Building2 /></div><h2>Mandant</h2><p>Unternehmensdaten, Adresse, Steuernummer und Standardwährung verwalten.</p><button className="secondary-button"><Settings2 size={17} />Unternehmensprofil</button></article>
    <article className="panel settings-panel"><div className="settings-icon"><File /></div><h2>Nummernkreise</h2><p>Formate für Vertrags-, Forderungs- und Rechnungsnummern festlegen.</p><button className="secondary-button"><Settings2 size={17} />Nummernkreise</button></article>
    <article className="panel settings-panel"><div className="settings-icon"><Mail /></div><h2>Benachrichtigungen</h2><p>E-Mail-Erinnerungen für Fristen, Fälligkeiten und Mahnstufen konfigurieren.</p><button className="secondary-button"><Settings2 size={17} />Regeln bearbeiten</button></article>
  </section>;
}
