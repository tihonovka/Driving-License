# ℹ️ I DRIVE.
### Hungarian KRESZ Repesztés Simulator
**Literally me. Literally driving. Literally failing the right-hand rule.**

![Ryan Gosling vezet a Drive (2011) című filmben](https://images.cinefil.com/movies/550784.webp)

> *"I drive."*
>
> **Ryan Gosling, valószínűleg miután sikerült a KRESZ-vizsgája.**

---

## ℹ️ Kicsoda vagyok????

Ez egy könnyű, gyors, statikus **magyar KRESZ-gyakorló weboldal**, amely GitHub Pages-en is működik.

Az oldal kezelőfelülete angol, mert nemzetközi színvonalon szeretnénk elbukni a magyar KRESZ-vizsgát.

A kérdések és válaszok természetesen magyarul vannak, hogy a vizsgán ne érjen meglepetés.

---

## ℹ️ Kurva sok kérdés van(majd lesz)

Jelenleg **X darab KRESZ-kérdés** várja, hogy megrepeszd az agyad.

Minden kérdéshez tartozik:

- 📝 Magyar nyelvű kérdés
- 🔢 Több válaszlehetőség
- ✅ Egy helyes megfejtés
- 📖 Magyarázat, hogy miért éppen az a helyes válasz
- 🚦 Egyes feladatoknál közlekedési táblák és saját ábrák
- 💀 Potenciális mentális összeomlás, ha ötödször is elrontod az elsőbbségadást

A kérdésbank az eredeti tanulási jegyzetekből készült, további KRESZ-információk pedig a [hatályos magyar KRESZ jogszabályszövegéből](https://net.jogtar.hu/jogszabaly?docid=97500001.kpm) származnak.

> **FUN FACT:** A BMW-ben nyitható a tető, gábor szerint nem

---

## 🔐 LCRYPT397

### AES-256-GCM Encryption

Itt a válaszokat nem osztogatjuk úgy, mint a szórólapokat a nyiltnapon.

A projekt **AES-256-GCM titkosítást** használ két különálló, titkosított adatállománnyal.

| Fájl | Mit rejt? |
|---|---|
| `quiz-questions.enc.json` | Kérdések és válaszlehetőségek |
| `answer-bank.enc.json` | Helyes válaszok indexei |

A visszafejtéshez szükséges kulcsok:

- `QUESTION_KEY`
- `ANSWER_KEY`

Ezek kizárólag a **Cloudflare Worker titkos környezeti változóiban** élnek.

Nem kerülnek GitHubra, nem kerülnek a böngészőbe, és nem kapja meg őket Gábor sem, hiába kérdezi meg hatszor.

A Worker visszafejti a megjelenítendő kérdéseket, ellenőrzi a beküldött választ, majd visszaküldi:

`{ "correct": true }`

vagy

`{ "correct": false }`

**Ennyi, picur.** Nem küldi vissza a helyes válasz indexét.

---

## ℹ️ Login Database

### Authentication System

Mielőtt beszállnál gabi mellé a volánhoz, be kell jelentkezned.

A felhasználói rendszer **Cloudflare D1 adatbázison** működik.

| Funkció | Technológia |
|---|---|
| Felhasználónevek | Cloudflare D1 |
| Jelszóvédelem | PBKDF2-SHA-256 |
| Munkamenetek | Véletlenszerű bearer tokenek |
| Tokenek tárolása a szerveren | Hash-elve a D1-ben |
| Böngészős tárolás | Session Storage |
| Munkamenet lejárata | 7 nap |
| Regisztráció | Titkos regisztrációs kód |

A jelszavakat a rendszer **nem tárolja olvasható szövegként**.

Új fiókot pedig csak a `REGISTRATION_CODE` birtokában lehet létrehozni.

> **ACCESS DENIED:** Gábor megpróbált megrepeszteni a kenyérpirító jelszavával.

---

## ℹ️ Kernel Level Protection (NIncs semmi csak jol hangzik)

### Anti-Cheating System

Minden kérdés ellenőrzéséhez egy véletlenszerű, egyszer használatos token szükséges.

Ez a token a konkrét kérdéshez és az adott tesztkör azonosítójához kapcsolódik.

**A szabályok:**

1. Egy kérdésre tesztkörönként csak egy ellenőrzés jár.
2. Új tesztkör esetén új ellenőrzési lehetőséget kapsz.
3. Témaváltáskor szintén új tesztkör indul.
4. Nincs percenkénti kéréskorlát.
5. Nincs IP-cím alapú napi tiltás.

Nem kell attól félned, hogy a rendszer azért tilt le, mert túl intenzíven tanulsz.

**DE!** A böngészőben megjelenített kérdéseket és az API-hívásokat egy bejelentkezett felhasználó továbbra is megvizsgálhatja.

A frontendből a helyes válasz ellenőrzésének működését sem lehet tökéletesen elrejteni.

A DevTools-ablak lefagyasztása nem biztonság, hanem egy technológiai hasgörcs.

---

## ℹ️ Admin Endpoint

### Owner-Only Answer Access

Létezik egy külön adminisztrátori végpont:

`POST /api/admin/answers`

A végpont kizárólag érvényes `ADMIN_KEY` használatával adja vissza a helyes válaszok indexeit.

A hozzáféréshez szükséges fejléc:

`Authorization: Bearer <ADMIN_KEY>`

Hibás vagy hiányzó kulcs esetén:

**HTTP 401 UNAUTHORIZED**

Magyarul: **TAKARODJ VISSZA A KRESZ-KÖNYVHÖZ.**

Az `ADMIN_KEY` kizárólag Cloudflare Worker secret lehet. A frontendben és a GitHub-repositoryban semmi keresnivalója.

---

## ℹ️ THE ROAD SIGN COLLECTION

Nem lenne igazi KRESZ-teszt néhány tábla nélkül, amitől az ember elfelejti, merre van az előre.

A projekt saját készítésű, helyben tárolt **SVG közlekedési ábrákat** használ.

Az eredeti [kreszteszt.net táblakatalógusban](https://kreszteszt.net/tablak/) négy általános SVG ikon található, az egyedi közlekedési táblák illusztrációi pedig JPEG-formátumúak.

Ezért a rendszer saját SVG-ábrákat alkalmaz azokhoz a kérdésekhez, amelyekhez szükségesek.

**Előnyök:**

- Éles, méretezhető ábrák
- Gyors megjelenítés
- Helyben tárolt grafika
- Nincs szükség külső képkérésekre az ábrák megjelenítéséhez

> Gábor meglátott egy STOP táblát, és megkérdezte, hogy ez a Spotify Premium új logója-e.

---

## ℹ️ THE TECHNOLOGY UNDER THE HOOD

| Technológia | Feladat |
|---|---|
| HTML / CSS / JavaScript | A weboldal |
| GitHub Pages | Statikus frontend |
| Cloudflare Workers | Szerveroldali API |
| Cloudflare D1 | Felhasználók és munkamenetek |
| AES-256-GCM | Kérdés- és válaszadatok titkosítása |
| PBKDF2-SHA-256 | Jelszavak védelme |
| SVG | Közlekedési ábrák |

Nincs bonyolult frontend bullshit.

Nincs hárommillió felesleges JavaScript-csomag.

---

## ℹ️ TESTED, NOT GABOR APPROVED

Az automatizált tesztek ellenőrzik:

- ✅ A helyes válaszok felismerését
- ✅ A hibás válaszok elutasítását
- ✅ A módosított vagy hamisított adatok elutasítását
- ✅ A bemeneti adatok ellenőrzését
- ✅ A kérések eredetének validálását

Mert ha egyetlen rossz válasz képes lenne feltörni az egész rendszert, akkor inkább Gáborra bíznánk a vezetést.

És ezt senki sem szeretné.

---

## ℹ️ TRIPPING POINT

**The city is yours. The road is yours. The right of way probably isn't.**

Ez a projekt azoknak készült, akik szeretnék megtanulni a magyar közlekedési szabályokat anélkül, hogy harminc különböző weboldalon keresnék ugyanazt a kérdést. És Englert Ervin kedvére!

És ha már mindent tudsz, irány a valódi forgalom, természetesen oktatóval és a megfelelő jogosultságokkal.

### ℹ️ I DRIVE.

**You study.**

**Gábor repesztve.**

**Ryan Gosling approves. (Nem hivatalosan, asszem.)**

---

**© 2026 I DRIVE | Hungarian Driving Theory Practice**

*Kép: Drive (2011), [Cinéfil](https://www.cinefil.com/film/drive-2011). A filmjelenet jogai az eredeti jogosultakat illetik.*
