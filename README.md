# Budgetkompis

Mobilvänlig fullstack-app för hushållsbudget för exakt två personer. Byggd med Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Auth.js credentials-login och Zod-validering.

## Funktioner

- Registrering, inloggning, utloggning och skyddade app-sidor
- Ett hushåll med exakt två medlemmar i MVP
- Invite-kod och invite-länk för att koppla ihop hushållet
- Budget per månad med låsning, anteckningar och historikfält
- Individuella inkomster och ingående saldon
- Planerade och ej planerade utgifter
- Återkommande utgifter som kan kopieras till nästa månad
- Hushålls- och personsummeringar
- Oförklarad förbrukning mellan månader
- Årsbudget med sparmål, månadstakt och reserverade pengar för större kostnader
- JSON-export och JSON-import

Gemensamma utgifter delas 50/50 i personliga summeringar. Hushållssiffran är den officiella siffran för oförklarad förbrukning.

## Stack

- `next`
- `react`
- `typescript`
- `tailwindcss`
- `prisma`
- `postgresql`
- `next-auth` / Auth.js med credentials-provider
- `zod`
- `vitest`

## Köra lokalt

1. Installera Node.js 22+ och PostgreSQL.
2. Kopiera `.env.example` till `.env.local`.
3. Sätt minst:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/budgetkompis?schema=public"
AUTH_SECRET="en-lång-slumpad-hemlighet"
APP_URL="http://localhost:3000"
```

4. Installera beroenden:

```bash
npm install
```

5. Generera Prisma-klient och skapa tabeller:

```bash
npm run prisma:generate
npm run prisma:push
```

6. Ladda demo-data i utveckling:

```bash
npm run prisma:seed
```

7. Starta appen:

```bash
npm run dev
```

Appen finns sedan på `http://localhost:3000`.

## Demoanvändare efter seed

- `linus@example.com` / `demo12345`
- `alex@example.com` / `demo12345`

## Test

```bash
npm test
```

## Struktur

- `src/app` - routes och sidlayout
- `src/components` - UI-komponenter
- `src/lib` - delade helpers, validering och beräkningar
- `src/server/actions` - server actions
- `src/server/services` - access control och domänlogik
- `prisma` - schema och seed

## Vercel

Appen är byggd för att kunna deployas på Vercel. Sätt samma miljövariabler i Vercel-projektet och använd en PostgreSQL-databas, till exempel Neon eller Supabase/Postgres.
