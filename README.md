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
- Årsbudget med engångs- eller årliga sparmål och automatiska månadsposter
- Jämförelse mellan lån och direktbetalning
- Aktiva annuitetslån och lån med rak amortering, inklusive avgifter och restskuld
- Automatiska lånebetalningar, ränteändringar och extra amortering
- Registrering av befintliga lån från aktuell restskuld
- Delad Playground för isolerade testbudgetar som kan kopieras till en ny riktig månad
- JSON-export och JSON-import

Gemensamma utgifter delas 50/50 i personliga summeringar. Hushållssiffran är den officiella siffran för oförklarad förbrukning.

Automatiskt årssparande räknas om mot det kvarvarande målet och visas som en
obligatorisk utgift i öppna månader. En sådan post kan tas bort som en override
för just den månaden; återstående belopp fördelas då över senare sparmånader.
Betalda och låsta månader ändras aldrig automatiskt.

Lånejämförelsen visar lånets faktiska betalningar före eventuellt ränteavdrag.
Ett aktiverat lån skapar planerade utgifter i de budgetmånader som finns och
fortsätter automatiskt när nya månader skapas. Ränteändringar gäller från vald
månad och räknar endast om framtida obetalda poster. En extra amortering kortar
som standard löptiden när den markeras betald.

Långsiktiga mål kan använda en flexibel målplan. Tillfälliga månadsbelopp anges
med start- och slutmånad; därefter räknas den automatiska takten om så att
målbeloppet fortfarande nås vid milstolpen. Ett öppet steg som börjar efter
milstolpen kan fortsätta sparandet utan slutdatum.

Playground-scenarier är fristående ögonblicksbilder. Betalstatus och Swish-data
kopieras inte, och automatiska lån- och årssparandeposter är låsta i testet. När
ett scenario görs till en ny riktig månad genereras dessa poster på nytt från de
aktuella planerna.

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
