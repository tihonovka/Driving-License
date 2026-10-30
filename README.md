# 🦂 I DRIVE.
### Hungarian KRESZ Practice Simulator
**Literally me. Literally driving. Literally failing the right-hand rule.**

![Ryan Gosling vezet a Drive (2011) című filmben](https://images.cinefil.com/movies/550784.webp)

> *"I drive."*
>
> **Ryan Gosling, valószínűleg miután sikerült a KRESZ-vizsgája.**

---

## 🚗 MI A FASZOM EZ?

Üdvözöllek az **I DRIVE** világában, ahol Ryan Gosling vezet, te meg próbálod megfejteni, hogy a jobbkéz-szabály szerint mi a jó büdös franc történik egy kereszteződésben.

Ez egy könnyű, gyors, statikus **magyar KRESZ-gyakorló weboldal**, amely GitHub Pages-en is működik.

Az oldal kezelőfelülete angol, mert nemzetközi színvonalon szeretnénk elbukni a magyar KRESZ-vizsgát.

A kérdések és válaszok természetesen magyarul vannak, hogy a vizsgán ne érjen meglepetés.

**Küldetés:** megszerezni a jogosítványt, mielőtt Gábor megtanulna indexelni.

---

## 🧠 THE GOSLING KNOWLEDGE BASE

Jelenleg **18 darab KRESZ-kérdés** várja, hogy megdolgoztasd az agyad.

Minden kérdéshez tartozik:

- 📝 Magyar nyelvű kérdés
- 🔢 Több válaszlehetőség
- ✅ Egy helyes megfejtés
- 📖 Magyarázat, hogy miért éppen az a helyes válasz
- 🚦 Egyes feladatoknál közlekedési táblák és saját ábrák
- 💀 Potenciális mentális összeomlás, ha ötödször is elrontod az elsőbbségadást

A kérdésbank az eredeti tanulási jegyzetekből készült, további KRESZ-információk pedig a [hatályos magyar KRESZ jogszabályszövegéből](https://net.jogtar.hu/jogszabaly?docid=97500001.kpm) származnak.

> **FUN FACT:** A BMW-ben is van index. Gábor állítólag még kutatja, hol.

---

## 🔐 THE SECRET GOSLING TECHNOLOGY

### AES-256-GCM Encryption

Itt a válaszokat nem osztogatjuk úgy, mint a szórólapokat a Blahán, bazdmeg.

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

**Ennyi, pici.** Nem küldi vissza a helyes válasz indexét.

---

## 🕶️ NO ACCOUNT, NO DRIVE

### Authentication System

Mielőtt beszállnál Gosling mellé a volánhoz, be kell jelentkezned.

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

> **ACCESS DENIED:** Gábor megpróbált belépni a kenyérpirító jelszavával.

---

## 🎯 ONE QUESTION. ONE SHOT.

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

## 👑 THE GOSLING ADMIN CLUB

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

## 🚦 THE ROAD SIGN COLLECTION

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

## 🏎️ THE TECHNOLOGY UNDER THE HOOD

| Technológia | Feladat |
|---|---|
| HTML / CSS / JavaScript | A weboldal |
| GitHub Pages | Statikus frontend |
| Cloudflare Workers | Szerveroldali API |
| Cloudflare D1 | Felhasználók és munkamenetek |
| AES-256-GCM | Kérdés- és válaszadatok titkosítása |
| PBKDF2-SHA-256 | Jelszavak védelme |
| SVG | Közlekedési ábrák |

Nincs bonyolult frontend buildfolyamat.

Nincs hárommillió felesleges JavaScript-csomag.

Csak a vezetés, a KRESZ és az egzisztenciális válság egy egyenrangú útkereszteződésben.

---

## 🧪 TESTED, NOT GABOR APPROVED

Az automatizált tesztek ellenőrzik:

- ✅ A helyes válaszok felismerését
- ✅ A hibás válaszok elutasítását
- ✅ A módosított vagy hamisított adatok elutasítását
- ✅ A bemeneti adatok ellenőrzését
- ✅ A kérések eredetének validálását

Mert ha egyetlen rossz válasz képes lenne feltörni az egész rendszert, akkor inkább Gáborra bíznánk a vezetést.

És ezt senki sem szeretné.

---

## 🌃 FINAL DESTINATION

**The city is yours. The road is yours. The right of way probably isn't.**

Ez a projekt azoknak készült, akik szeretnék megtanulni a magyar közlekedési szabályokat anélkül, hogy harminc különböző weboldalon keresnék ugyanazt a kérdést.

Tanulj. Gyakorolj. Hibázz. Próbáld újra.

És ha már mindent tudsz, irány a valódi forgalom, természetesen oktatóval és a megfelelő jogosultságokkal.

### 🦂 I DRIVE.

**You study.**

**Gábor fails.**

**Ryan Gosling approves. (Nem hivatalosan, bazdmeg.)**

---

*Made for future drivers, professional overthinkers, and people who genuinely believe they're Ryan Gosling.*

**© 2026 I DRIVE | Hungarian Driving Theory Practice**

*Kép: Drive (2011), [Cinéfil](https://www.cinefil.com/film/drive-2011). A filmjelenet jogai az eredeti jogosultakat illetik.*
