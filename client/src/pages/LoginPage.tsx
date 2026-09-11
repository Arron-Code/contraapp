import { ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === 'login') {
        await login(String(data.get('tenant')), String(data.get('email')), String(data.get('password')));
      } else {
        await register({
          company: String(data.get('company')),
          tenant: String(data.get('tenant')),
          name: String(data.get('name')),
          email: String(data.get('email')),
          password: String(data.get('password')),
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand"><span>e</span><strong>eriCargo</strong></div>
        <div className="auth-copy">
          <div className="auth-pill"><Sparkles size={15} /> Klarheit für Ihr Geschäft</div>
          <h1>Verträge im Griff.<br /><em>Liquidität im Blick.</em></h1>
          <p>Die zentrale Plattform für professionelles Vertrags- und Forderungsmanagement – sicher, übersichtlich und mandantenfähig.</p>
          <ul>
            <li><FileCheck2 /><div><strong>Fristen automatisch überwachen</strong><span>Kündigungen und Verlängerungen rechtzeitig erkennen.</span></div></li>
            <li><CheckCircle2 /><div><strong>Offene Posten schneller klären</strong><span>Zahlungen und Mahnstufen transparent steuern.</span></div></li>
            <li><ShieldCheck /><div><strong>Sicher getrennte Mandanten</strong><span>Rollenbasierter Zugriff und lückenloses Audit-Protokoll.</span></div></li>
          </ul>
        </div>
        <div className="auth-quote">„Endlich wissen wir jederzeit, welcher Vertrag und welche Forderung Aufmerksamkeit braucht.“</div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">Willkommen bei eriCargo</span>
          <h2>{mode === 'login' ? 'Schön, Sie wiederzusehen.' : 'Workspace erstellen'}</h2>
          <p>{mode === 'login' ? 'Melden Sie sich in Ihrem Workspace an.' : 'Starten Sie mit Ihrem eigenen, sicheren Mandanten.'}</p>
          {mode === 'register' && (
            <div className="form-row">
              <label>Unternehmen<input name="company" required placeholder="Beispiel GmbH" /></label>
              <label>Ihr Name<input name="name" required placeholder="Vor- und Nachname" /></label>
            </div>
          )}
          <label>Mandanten-Kürzel<input name="tenant" required defaultValue={mode === 'login' ? 'nordstern' : ''} placeholder="mein-unternehmen" /></label>
          <label>E-Mail-Adresse<input name="email" type="email" required defaultValue={mode === 'login' ? 'admin@demo.de' : ''} placeholder="name@unternehmen.de" /></label>
          <label>Passwort<input name="password" type="password" required minLength={8} defaultValue={mode === 'login' ? 'Demo123!' : ''} /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? 'Bitte warten…' : mode === 'login' ? 'Sicher anmelden' : 'Workspace erstellen'} <ArrowRight size={18} />
          </button>
          <div className="auth-switch">
            {mode === 'login' ? 'Noch kein Workspace?' : 'Bereits registriert?'}
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Jetzt erstellen' : 'Zur Anmeldung'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
