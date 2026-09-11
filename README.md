# eriCargo Contract Suite

Mandantenfähige Webanwendung für Vertrags- und Forderungsmanagement mit React,
Express und Neon PostgreSQL.

## Funktionen

- Dashboard mit Vertragsvolumen, offenen/überfälligen Forderungen, Cashflow und Fristen
- Vertragsverwaltung mit Laufzeiten, Kündigungsfristen und automatischer Verlängerung
- Forderungen, Teilzahlungen, Zahlungseingänge und mehrstufiges Mahnwesen
- Kunden, Lieferanten, Partner und Ansprechpartner
- Aufgaben, Fristen, Prioritäten und Verantwortliche
- Geschützter Dokument-Upload und -Download
- Mandantentrennung, Rollenmodell und Audit-Protokoll
- Globale Suche und responsive Benutzeroberfläche

## Lokal starten

Voraussetzungen: Node.js 22+ und npm. Die Anwendung verwendet eine gehostete
Neon-PostgreSQL-Datenbank.

```powershell
npm install
npm run db:seed
```

API und Frontend in zwei Terminals starten:

```powershell
npm run dev
npm run dev:client
```

Frontend: `http://localhost:5173`
API: `http://localhost:4000/api`

Demo-Zugang:

- Mandant: `nordstern`
- E-Mail: `admin@demo.de`
- Passwort: `Demo123!`

Die Neon-Verbindung wird lokal in `server\.env` über `DATABASE_URL`
konfiguriert. Die Datei ist von Git ausgeschlossen. Das vollständige Schema
liegt zusätzlich unter `server\db\schema.sql`.

## Rollen

| Rolle | Zugriff |
|---|---|
| Owner | Vollzugriff einschließlich Benutzer und Audit |
| Admin | Verwaltung, Benutzer und Audit |
| Manager | Verträge, Forderungen, Kontakte und Aufgaben |
| Accounting | Forderungen, Zahlungen und Mahnwesen |
| Viewer | Lesender Zugriff |

Für den Produktivbetrieb müssen insbesondere `JWT_SECRET`, Datenbankzugänge,
CORS-Origin und TLS sicher konfiguriert werden.
