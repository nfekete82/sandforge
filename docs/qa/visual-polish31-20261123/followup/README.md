# Frame-Spikes und gezielte Nachbesserung

Dieser Nachtrag ergänzt den ursprünglichen Commit `8512c9e8` im Draft-PR #484.
GLB-Dateien, KI, Simulation, Gameplay, HUD und Kartenregeln bleiben unverändert.
Der ursprüngliche [Drei-Karten-Vergleich](../README.md) bleibt als Messung dieses
Ausgangscommits erhalten; die nachfolgenden Werte stammen aus längeren,
separaten Läufen und dürfen nicht direkt als Verbesserung gegenüber den
kürzeren ursprünglichen 1%-Low-Werten interpretiert werden.

## Ursache der schlechten Frames

Zuerst wurden auf Desert Strike vier Läufe mit 600 Frames / zehn Spielsekunden
in der Reihenfolge main → `8512c9e8` → `8512c9e8` → main gemessen. Der größte
Ausreißer liegt in beiden Versionen bei Frame 181: Der vorangehende echte
Simulationstick braucht etwa 42–45 ms. Animation/Synchronisierung braucht in
diesem Frame rund 2 ms, der Partikelpass rund 0,1 ms. Die normalen Partikel-
Updates liegen auch mit mehreren hundert aktiven Partikeln weit darunter.
[Zusammenfassung](main-vs-submitted-summary.json), [Rohdaten](main-vs-submitted-frames.json).

Die finale Zuordnung erfasst zusätzlich die bereits vorhandenen read-only
KI-, Sicht- und Pfadsuchzähler. Auf beiden betroffenen Karten wurden jeweils
vier Läufe in der Reihenfolge `8512c9e8` → optimiert → optimiert → `8512c9e8`
ausgeführt. Alle acht Läufe zeigen ihren größten Ausreißer bei rund
**3,05 Spielsekunden**. In der finalen Fassung:

| Karte | RAF-Ausreißer | Simulation im vorherigen Frame | Darin KI-Planung | Grafik-Sync | Partikel-Update |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desert Strike | 56,0–56,2 ms | 42,2–42,5 ms | 41,9–42,1 ms | etwa 2,2 ms | etwa 0,1 ms |
| Broken Empire | 72,7 ms | 58,4–59,7 ms | 58,1–59,5 ms | etwa 2,1 ms | 0,1–0,2 ms |

Der große Hänger entsteht überwiegend in der bestehenden KI-Planung,
auch im hochgeladenen Ausgangscommit. Die KI wurde entsprechend der
Vorgabe nicht geändert. Ihre Timings können Sicht-/Pfadarbeit einschließen;
sie sind **innerhalb** der Simulationszeit gemessen und dürfen nicht dazu
addiert werden. Ein RAF-Abstand wird mit der Arbeit des **vorherigen** Frames
verglichen. Langaufgaben und Heap-Werte werden nur im QA-Runner beobachtet.
Speicherabfälle sind kein eigenständiger Nachweis für GC als Ursache.

Die frühere große Streuung der gemessenen Render-Arbeitszeit wird in den
längeren wechselnd angeordneten Läufen nicht als dauerhafte, vergleichbar
starke Zusatzlast reproduziert. Das ist keine vollständige GPU- oder
Treiber-Ursachenanalyse. Zwei Wiederholungen je Variante erlauben keine
belastbare Aussage über eine kleine Verbesserung der 1%-Lows.

## Umgesetzte Optimierungen und Bildkorrektur

- Turm-/Laufausrichtung erfolgt einmal nach dem AnimationMixer. Der zuvor
  zusätzlich ausgeführte und anschließend überschriebene Vorab-Pass entfällt.
- Jedes Fahrzeug verwendet dasselbe Eingabeobjekt für seine Pose weiter.
  Die Deckkraft-Uploadbereiche der Partikel und Druckimpulse werden ebenfalls
  wiederverwendet. Diese Grafikpfade erzeugen dafür keine temporären Objekte
  mehr pro Frame. Die Instanz-Deckkraft bleibt vor dem Alpha-Test wirksam.
- Die nächste Geländeabtastung eines fahrenden Konvois wird nach Einheiten-ID
  auf zwei Simulationsticks verteilt. Unveränderte geparkte Fahrzeuge und
  Lite brauchen weiterhin keine wiederholten Stützpunkt-Abfragen; Wartungs-
  und Produktionsplattformen überspringen die vier Abfragen vollständig.
- Der Bildvergleich zeigte auffällig helle, gleichmäßig deckende Explosions-
  Torusringe. Dieselbe vorhandene Geometrie erhält einen warmen Sandton,
  Grunddeckkraft 0,25 statt 0,63 und eine individuelle quadratische
  Ausblendkurve. Das zusätzliche Instanzfeld belegt maximal 192 Byte in
  voller Qualität; Draw Calls, Dreiecke und Partikelzahlen steigen nicht.
  Flammen, Mündungsfeuer, vorhandene Lichtblitze und das PBR der Modelle
  bleiben erhalten. Der Druckimpuls wirkt dadurch weniger wie ein heller
  Kreis auf dem Boden. Das bleibt Teil des dritten VFX-Schwerpunkts.

[Vorher: hochgeladener Commit](desert-strike-submitted.png) /
[nachher: dezenter Druckimpuls](desert-strike-optimized.png), jeweils gleicher
Gefechtstick, Kamera und normaler RTS-Zoom. Die aktuellen Bilder wurden auf
Desert Strike und Broken Empire geprüft; der vorhandene militärische
Wüstenstil und die Teamfarben bleiben erhalten.

## Finale längere Vergleichsmessung

Chrome headless / ANGLE Metal / Apple M5 Max, 1440 × 900, DPR 1, Zoom 0,59,
`post=0`, `adaptive=0`, keine parallel laufenden Tests. Je Variante und Karte
zwei Läufe mit 600 Frames; nach 31 ausgeschlossenen Startframes gehen 569
Frameabstände pro Lauf in die Statistik ein. Die 1%-Lows beruhen damit auf
sechs statt drei langsamen Frames je Lauf. Die Tabelle zeigt den Median der
beiden jeweiligen Ergebnisse, keine zusammengefasste neue FPS-Messung.

| Karte | FPS `8512c9e8` → optimiert | 1%-Low `8512c9e8` → optimiert | Arbeit/Frame `8512c9e8` → optimiert |
| --- | ---: | ---: | ---: |
| Desert Strike | 59,79 → 59,79 | 38,25 → 38,01 | 10,328 → 10,205 ms |
| Broken Empire | 59,69 → 59,69 | 35,41 → 35,21 | 9,823 → 9,747 ms |

Die 1%-Lows sind numerisch weiterhin leicht schlechter (rund 0,6 %), keine
nachgewiesene Verbesserung. Die kleinen Änderungen werden als begrenzte
Arbeits-/Allokationsoptimierung ausgegeben, nicht als Behebung des großen
Hängers. Der PR bleibt ein **Draft**, die allgemeine Performancefreigabe offen.
Es wurde kein Merge und kein Auto-Merge ausgelöst.

Für alle Wiederholungen jeder Karte sind Kamera, Simulationsergebnis,
Schussereignisse und geladene echte Modelle gleich. Pro Replay entstehen
150 bzw. 177 echte Schussereignisse. Draw Calls, Dreiecke und GPU-Ressourcen
bleiben je Karte identisch: Desert Strike im Mittel 6.102,24 Calls /
1.631.648,08 Dreiecke, Broken Empire 6.383,91 / 4.514.404,06; einschließlich
Schatten und im Replay eintretender Verluste. Keine Page-/Shader-/WebGL-Fehler.

[Auswertung einschließlich einzelner Ausreißer](submitted-vs-optimized-summary.json),
[Rohdaten aller acht Läufe](submitted-vs-optimized-frames.json).

## Tests und unveränderte Bereiche

- TypeScript-/WebGL-Build inklusive Modulgraph bestanden.
- 24 gezielte Node-Prüfungen bestanden; die neue Regression prüft verteilte
  Stützpunktabfragen und deren vollständiges Auslassen auf Serviceflächen.
- Bestehender Combat-VFX-Test und erweiterte echte Browserregression: 2/2.
  Sie bestätigen einmalige Turmausrichtung, stabile Identität der Pose-Eingabe
  und des Uploadbereichs, exakte Rückkehr des 0,10-Modellmeter-Rückstoßes,
  unveränderten Spielstand und eingefrorene Pause. Die Druckimpuls-Deckkraft
  sinkt von 0,633 auf 0,240 bei unverändertem Grundmaterialwert 0,25.
- Erneuter `post=1`-Smoke mit der finalen Druckimpuls-Darstellung bestanden:
  Post aktiv, kein Fallback, keine Shader-/WebGL-Fehler. [Ergebnis](post-smoke.json).
- Gesamtsuite: **2.533 Tests, 2.319 bestanden, 211 fehlgeschlagen, drei übersprungen**.
  **Die 211 Fehler sind bekannte Altlasten von `origin/main`.** Die fehlschlagenden
  Testnamen sind exakt dieselben; keine neuen fehlschlagenden Tests.
  [Gegenüberstellung](test-results.json), [gezielte Tests](targeted-tests.txt),
  [Browsertests](browser-tests.txt).
- Kein Diff in `src/` und keine GLB-Änderungen. Der ursprüngliche Checkout mit
  seinen 13 lokalen Asset-Änderungen bleibt unberührt.

## Wiederholen

Nach dem normalen Build und Start des Servers auf Port 8113:

```sh
POLISH31_PROFILE=1 POLISH31_MAPS=desert-strike,broken-empire \
  POLISH31_FRAMES=600 POLISH31_VARIANTS=submitted,after,after,submitted \
  POLISH31_OUTPUT=/private/tmp/sandforge-polish31-spikes \
  node scripts/qa-visual-polish31.mjs
node scripts/report-visual-polish31-spikes.mjs \
  /private/tmp/sandforge-polish31-spikes/report.json \
  /private/tmp/sandforge-polish31-spikes/summary.json
```

`submitted` lädt die fünf Renderer-Dateien und beide neuen Helfermodule aus
`8512c9e8`; `after` verwendet die aktuell gebauten Module. `before` lädt die
ursprünglichen fünf Renderer-Module von `POLISH31_BASE_REF` / `origin/main`.
Das Profiling ergänzt keine Instrumentierung in normalen Spielsessions.


## 23.11.2026 – Hardwarefreigabe nach Integration von `main`

Der bereits freigegebene A*-Performance-Fix aus #485 ist über #486 in diesen **Grafik-Draft-Branch** aufgenommen worden, ohne `main` durch Grafikänderungen zu ersetzen. Für die endgültige Bewertung muss die neue GPU-Messung gegen den aktuellen `main` erfolgen.

**Unterschied der zwei Prüfarten:**

- **GitHub Actions / Linux-Chromium mit Software-Rendering:** Auf 800 × 500 beziehungsweise 960 × 600 und ohne künstliche RAF-Wartezeit; 600 explizite Simulations-/Rendering-Frames (Canary: 60) sowie GLB-/Shader-/Save-Parität. Der QA-Report kennzeichnet diese Läufe als `softwareRendererBench` und unterdrückt FPS und 1%-Low-Werte. Er darf **nicht** als Aussage zur Apple-M5-Max-GPU verwendet werden.
- **Lokaler echter Mac-GPU-Vergleich:** 1440 × 900, DPR 1 und natürliche `requestAnimationFrame`-Taktung (`POLISH31_SOFTWARE_QA=0`). Nur daraus werden FPS/1%-Lows mit derselben Szene, Kamera und identischen Eingabedaten berichtet. Diese Messung muss nach der Synchronisierung erneut ausgeführt werden; ältere Zahlen sind historische Angaben.

Wiederholbare GPU-Abnahme auf dem Mac mit dem bereits ausgecheckten Grafik-Branch:

```sh
npm ci
npm ci --prefix tests/browser
npm run build
PORT=8133 npm run preview
# In einem zweiten Terminal, bei laufendem Preview:
POLISH31_URL=http://127.0.0.1:8133 \
POLISH31_BASE_REF=origin/main \
POLISH31_CHANNEL=chrome \
POLISH31_VIEWPORT=1440x900 \
POLISH31_SOFTWARE_QA=0 \
POLISH31_FRAMES=600 \
POLISH31_VARIANTS=before,after,after,before \
POLISH31_PROFILE=1 \
POLISH31_OUTPUT=artifacts/visual31/mac-native \
node scripts/qa-visual-polish31.mjs
node scripts/report-visual-polish31-spikes.mjs \
 artifacts/visual31/mac-native/report.json \
 artifacts/visual31/mac-native/frame-summary.json
node scripts/compare-visual-polish31-acceptance.mjs \
 artifacts/visual31/mac-native/report.json \
 artifacts/visual31/mac-native/acceptance.json
```

Für einen zusätzlichen Mac-GPU-Konvoi-Test dieselben Befehle mit
`POLISH31_MAPS=broken-empire POLISH31_STRESS=1` und eigenem `POLISH31_OUTPUT`-Pfad ausführen.

Die vorangegangene Messung dokumentiert kein statistisch gesichertes Plus bei den 1%-Lows. **Dieser Anhang ist eine Reproduktionsanleitung, keine behauptete neue GPU-Freigabe.** PR #484 bleibt Draft, bis die Prüfung auf dem aktualisierten Branch abgeschlossen und bewertet ist.
