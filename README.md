# Mors kalender

En felles app for familien med:

- **Kalender** for mors timer – lege, tannlege, audiolog, øyelege, sykehus, fysioterapi m.m. – med hvem som følger henne, transport, notater og kommentarer etter timen.
- **Vaktordning** for fire søsken – hvem som har ansvaret hvilken uke, med automatisk turnus og enkel bytting.
- **Deling med lege i familien** – egen rolle som kan lese alt og skrive kommentarer, men ikke endre timer eller vakter.
- **Sanntid** – når én skriver noe inn, oppdateres det hos alle andre med én gang.

Appen er en PWA: den åpnes i nettleseren og legges på hjemskjermen, og oppfører seg da som en vanlig app på iPhone og Android. Ingen App Store nødvendig.

## Sikkerhet

Innholdet er sensitive helseopplysninger, så appen er bygget med flere lag:

| Lag | Hva det gjør |
|---|---|
| **Ende-til-ende-kryptering** | Alt innhold (type time, behandler, sted, notater, kommentarer, vaktmerknader) krypteres på telefonen med AES-256-GCM før det sendes. Nøkkelen avledes fra et *familiepassord* (PBKDF2-SHA256, 600 000 runder) og forlater aldri enheten. Databasen og Supabase ser bare uleselig tekst. |
| **Innlogging** | Engangskode til e-post (ingen passord som kan lekke). |
| **Tilgangskontroll i databasen** | Row Level Security: bare e-postadresser som administrator har lagt inn i `members` får lese eller skrive – uansett hva noen prøver fra utsiden. |
| **Roller** | `admin` (legger til/fjerner personer), `familie` (endrer timer og vakter), `lege` (leser og kommenterer). |
| **Endringslogg** | Hvem som la til, endret eller slettet hva, og når. «Sist endret av» settes av serveren og kan ikke forfalskes. |
| **Manipulasjonsvern** | Kryptert innhold er bundet til sin rad, så det kan ikke flyttes eller byttes om uten at appen oppdager det. |
| **Nettleser** | Streng Content-Security-Policy, ingen tredjepartsskript, service worker cacher aldri data. |

Familiepassordet deles **muntlig eller på papir**. Glemmer alle det, kan innholdet ikke gjenopprettes – det er prisen for at ingen andre kan lese det.

Merk: Selve koden ligger i et offentlig GitHub-repo. Det er trygt – koden inneholder ingen data eller hemmeligheter. Datene ligger kryptert i din egen Supabase-database.

## Prøv uten oppsett

```bash
npm install
npm run dev
```

Åpne `http://localhost:5173/?demo`. I demomodus lagres alt bare i nettleseren, og innloggingskoden er `123456`.

## Oppsett (ca. 15 minutter, gratis)

### 1. Opprett database i Supabase

1. Lag konto på [supabase.com](https://supabase.com) og opprett et nytt prosjekt. Velg region **Stockholm (eu-north-1)** eller **Frankfurt** så dataene holdes i EU/EØS.
2. Gå til **SQL Editor**, lim inn hele innholdet i [`supabase/schema.sql`](supabase/schema.sql) og kjør.
3. Legg inn deg selv som administrator (bytt ut e-post og navn):
   ```sql
   insert into public.members (email, name, role, color)
   values ('din.epost@eksempel.no', 'Ditt navn', 'admin', '#2f5d62');
   ```

### 2. Sett opp innlogging med kode

1. **Authentication → Sign In / Providers → Email**: sørg for at Email er på. Sett *Email OTP Length* til 6.
2. **Authentication → Email Templates → Magic Link**: bytt innholdet til noe som viser koden, f.eks.:
   ```html
   <h2>Innlogging til Mors kalender</h2>
   <p>Koden din er: <strong>{{ .Token }}</strong></p>
   <p>Koden gjelder i en time. Har du ikke bedt om den, kan du se bort fra e-posten.</p>
   ```
   (Kode fungerer bedre enn lenke når appen ligger på hjemskjermen.)
3. **Authentication → URL Configuration**: sett *Site URL* til adressen appen får (se steg 3), f.eks. `https://bernt-maker.github.io/Samhandling-/`.
4. Anbefalt: Supabase sin innebygde e-posttjeneste har lav grense på antall e-poster per time. For stabil drift, sett opp egen SMTP under **Project Settings → Authentication → SMTP** (f.eks. Resend eller Brevo, gratis for små volum).

### 3. Publiser appen (GitHub Pages)

1. I GitHub-repoet: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**, legg til:
   - `VITE_SUPABASE_URL` – fra Supabase → Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` – fra samme sted, *anon / publishable key* (denne er laget for å være offentlig; tilgangen styres av databasereglene).
3. Slå sammen koden til `main`. Appen bygges og publiseres automatisk på `https://<brukernavn>.github.io/Samhandling-/`.

### 4. Første gang

1. Åpne appen, logg inn med e-posten din.
2. Lag **familiepassordet** (minst 12 tegn, gjerne en setning).
3. Gå til **Familie → Legg til** og legg inn søstrene (rolle *Familie*) og niesen (rolle *Lege*).
4. Send dem lenken, og gi dem familiepassordet muntlig.
5. Gå til **Vakter → Lag turnus** for å fordele ukene.

### Installer på telefonen

- **iPhone:** Åpne lenken i Safari → Del-knappen → «Legg til på Hjem-skjerm».
- **Android:** Åpne i Chrome → ⋮ → «Installer app».

## Utvikling

```bash
npm install
cp .env.example .env.local   # fyll inn Supabase-verdiene
npm run dev
npm test                     # enhetstester (kryptering, datoer, turnus)
npm run build
```

Struktur:

```
supabase/schema.sql     tabeller, tilgangsregler, endringslogg, sanntid
src/lib/crypto.ts       ende-til-ende-kryptering
src/lib/backend.ts      Supabase + demo-lagring
src/lib/store.ts        henter, dekrypterer og holder data i sync
src/components/         skjermbildene
```

## Mulige utvidelser

- Push-varsler dagen før en time / når vakten starter
- Bytteforespørsler for vakter («kan noen ta uka mi?»)
- Medisinliste og kontaktinfo til fastlege/hjemmetjeneste
- Bytte familiepassord (re-kryptering av alt innhold)
