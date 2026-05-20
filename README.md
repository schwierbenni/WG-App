# FlatMate – WG-Verwaltungsapp

Eine vollständige Web-App zur Verwaltung von WG-Diensten, Finanzen, Kommunikation und Haushaltsorganisation.

## Features

- **Dienstverwaltung**: Automatische Rotation, Swap-Requests, Checklisten
- **Dashboard**: Persönliche Aufgaben, Gesamtübersicht, Kalenderansicht, Statistiken
- **Schwarzes Brett**: Ankündigungen mit Emoji-Reaktionen
- **Einkaufsliste**: Gemeinsame kategorisierte Einkaufsliste
- **Ausgabenverwaltung**: Schuldenausgleich und Ausgabenübersicht
- **Nutzerverwaltung**: Einladungslinks, Rollen (Admin/Mitglied), Profilbilder

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Datenbank**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v5
- **Deployment**: Vercel + Supabase/Railway

## Lokale Einrichtung

### 1. Repository klonen

```bash
git clone <repository-url>
cd wg-app
npm install
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env.local
```

Trage deine Werte in `.env.local` ein:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="dein-geheimes-token"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**AUTH_SECRET generieren:**
```bash
openssl rand -base64 32
```

### 3. Datenbank einrichten

```bash
# Schema auf die Datenbank anwenden
npm run db:push

# Testdaten laden (5 WG-Mitglieder + initiale Dienste)
npm run db:seed
```

### 4. App starten

```bash
npm run dev
```

App läuft unter: http://localhost:3000

### Test-Zugangsdaten (nach Seed)

| Name   | E-Mail              | Passwort    | Rolle    |
|--------|---------------------|-------------|----------|
| Malte  | malte@flatmate.de   | password123 | Admin    |
| Johann | johann@flatmate.de  | password123 | Mitglied |
| Benny  | benny@flatmate.de   | password123 | Mitglied |
| Knossi | knossi@flatmate.de  | password123 | Mitglied |
| Yunus  | yunus@flatmate.de   | password123 | Mitglied |

## Deployment auf Vercel

### 1. Datenbank erstellen (Supabase)

1. Kostenloser Account auf [supabase.com](https://supabase.com)
2. Neues Projekt erstellen
3. **Settings → Database → Connection string** kopieren (URI format mit `?pgbouncer=true`)

### 2. Auf Vercel deployen

```bash
npx vercel --prod
```

Oder via GitHub: Repository auf Vercel verbinden und automatisches Deployment einrichten.

### 3. Umgebungsvariablen in Vercel setzen

Im Vercel Dashboard unter **Settings → Environment Variables**:

```
DATABASE_URL=postgresql://...?pgbouncer=true&connection_limit=1
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://deine-app.vercel.app
NEXT_PUBLIC_APP_URL=https://deine-app.vercel.app
```

> **Wichtig für Supabase + Vercel**: Verwende den Connection String mit `?pgbouncer=true&connection_limit=1` für serverlose Umgebungen.

### 4. Datenbank migrieren

```bash
# Migrationen auf Produktionsdatenbank anwenden
DATABASE_URL="<prod-url>" npm run db:migrate:prod

# Seed-Daten laden (optional)
DATABASE_URL="<prod-url>" npm run db:seed
```

## Datenbankmigrationen

```bash
# Neue Migration erstellen
npm run db:migrate -- --name <migration-name>

# Migrationen in Produktion anwenden
npm run db:migrate:prod

# Schema direkt pushen (Development)
npm run db:push

# Datenbank zurücksetzen und neu seeden
npm run db:reset
```

## Projektstruktur

```
wg-app/
├── app/
│   ├── (auth)/          # Login, Register, Passwort-Reset
│   ├── (dashboard)/     # App-Seiten (Dashboard, Dienste, Kalender, ...)
│   │   └── admin/       # Admin-Bereich
│   └── api/             # API Routes
├── components/
│   ├── ui/              # Basis-UI-Komponenten
│   ├── layout/          # Sidebar, Header
│   ├── dashboard/       # Dashboard-Komponenten
│   └── duties/          # Dienst-Komponenten
├── lib/
│   ├── auth.ts          # NextAuth Konfiguration
│   ├── db.ts            # Prisma Client
│   ├── utils.ts         # Hilfsfunktionen
│   └── validations.ts   # Zod Schemas
├── prisma/
│   ├── schema.prisma    # Datenbankschema
│   └── seed.ts          # Seed-Daten
└── types/               # TypeScript Typen
```

## Sicherheit

- Passwörter mit bcrypt (10 Rounds) gehasht
- JWT-basierte Sessions (HttpOnly Cookies)
- Zod-Validierung aller API-Inputs
- Admin-Aktionen serverseitig überprüft
- Rate-Limiting auf Login-Endpunkt empfohlen (z.B. via Vercel Middleware)

## Lizenz

MIT
