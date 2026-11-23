# Visual Polish 3.1 — 23. November 2026

Kleines Update der vorhandenen Three.js-Darstellung, mit genau drei Schwerpunkten.
Branch `codex/visual-polish-3-1`, Basis `origin/main` / `ee0685a2`.
Der ursprüngliche Checkout auf `37ffcd3a`, seine lokalen Commits und seine
13 geänderten Gebäude-GLBs bleiben unberührt. Der PR enthält keine GLB-Dateien.

## Analyse und Auswahl

Geprüft wurden die tatsächlich vorhandenen GLB-JSON-Chunks, PBR-Maps,
Knoten und Clips sowie die aktive WebGL-Lade-/Animationspipeline:

| Bereich | Vorhandener Stand | Entscheidung |
| --- | --- | --- |
| Panzer | 409 Meshes, keine Clips, getrennte `Tank_Turret`-/`Tank_Gun`-Knoten | Vorhandene Starrkörperhierarchie bewegen; keine Ersatzgeometrie |
| Humvee | 482 Meshes, `Humvee_Wheels` mit vier Radkanälen | Radclip erhalten; Hülle weicher drehen und Gelände berücksichtigen |
| Raketenartillerie | 33 Meshes, `Wheels_Roll` und `Launcher_Operation` | Vorhandene Clips und Raketenmündungen erhalten |
| Infanterie/Pioniere/Sanitäter/Schwere | Je fünf Clips: Idle, Run_Gun, Idle_Shoot, HitReact, Death; zusätzliche Human-Stance-/Werkzeugdarstellung | Bereits funktionierende Animationen erhalten |
| Helikopter/Bomber | Rotor-/Propellerclips; echte Start-/Service- und Flugpfade | Erhalten; kein Flugphysik- oder Rotorersatz |
| Gebäude | Finale lokale HQ-/Kasernen-PBRs im Build; deterministische Fabrik, Flugfeld, Generator, Bastion; separate Tore/Radare | Vorhandene Fassadenverschattung auch für Original-PBR nutzen, vollständige PBRs vor Übermalung schützen |
| Ruinen/Wracks/Landschaft | Vorhandene GLBs, Wreck-Lifecycle, instanzierte Landschaft/LOD | Keine zusätzlichen Geometrien, Landschaftsregeln oder Asset-Neuentwicklung |
| Licht/Schatten/AO | Vorhandene Sonne mit 2048er Schattenkarte, Kontaktflächen, optionale Visual-3.0-AO/Bloom-Pipeline | Licht, Belichtung, Reflexionen und Post-Vorgaben erhalten |
| Rauch/Staub/Explosionen | Bereits begrenzte instanzierte Pools, kurze Blitze, Funken, Explosionslichter und Fahrstaub | Individuelle Deckkraft innerhalb derselben Pools ergänzen |

Die drei günstigsten sichtbaren Schwächen: Hüllenrotation springt zwischen
20-Hz-Snapshots und bleibt auf Rampen waagerecht; Original-PBR-Gebäude umgehen
den vorhandenen Tiefenpass, während der alte Farbpass vollständige PBRs
überdecken kann; Partikel haben nur gemeinsame Materialdeckkraft und enden
vor allem durch sichtbares Schrumpfen. Das umfangreiche Fahrzeug-Batching
wäre ein wesentlich größerer Asset-Eingriff und gehört nicht zu diesem Update.

## Die drei Änderungen

1. **Mechanische Fahrzeugdarstellung.** Kürzester Winkelweg mit zeitbasierter
   Glättung, unabhängige Turmausrichtung und Ausrichtung am echten Gelände.
   Vier Stützpunkte werden höchstens zehnmal pro Spielsekunde abgefragt;
   stehende oder unsichtbare Fahrzeuge brauchen keine wiederholten Abfragen,
   Lite überspringt die zusätzlichen Terrainabfragen vollständig. Ein kleiner
   federnder Anteil reagiert auf tatsächliche Bewegung, Bremsen und Kurven;
   der Panzer bewegt sich weniger als der Humvee. Wartungs-/Produktionsflächen
   bleiben eben. Ein echter Kanonenschuss bewegt nur den vorhandenen Lauf:
   maximal 0,10 Modellmeter, 25 ms Anstoß und langsamer Rücklauf innerhalb
   200 ms. MG-Schüsse lösen keinen Kanonenrückstoß aus. Der frühere generische
   Versatz der gesamten Fahrzeughülle entfällt. Beim Kanonenschuss wird die
   sichtbare Turmrichtung auf den tatsächlichen Schusswinkel ausgerichtet.
2. **Gebäudetiefe und PBR-Erhalt.** Die bestehende dezente Fassadenverschattung
   gilt auch für fertig geladene Original-PBR-Gebäude. Sie beeinflusst nur die
   reflektierte Beleuchtung; UVs, Albedo, Normal, ORM/AO und Teamfarben bleiben
   erhalten. Eigene Shader-Hooks und Programmschlüssel überleben Materialklone;
   bestehende eigene PBR-Materialien werden wiederverwendet. Vollständig
   texturierte Materialien werden vom alten Triplanar-Farbpass ausgenommen,
   auch in bewegten Bauvorschauen. Unvollständige alte Fassaden erhalten auch
   die fehlende UV-Albedo aus dem vorhandenen gemeinsamen Textursatz.
3. **Weicher ausdünnende Gefechtseffekte.** Jeder vorhandene Partikel bekommt
   eine begrenzte Instanz-Deckkraft. Rauch/Staub werden kurz eingeblendet und
   weich ausgeblendet; Blitze beginnen sofort. Anzahl, Lebensdauer, Texturen,
   Rasterflächen und Draw Calls bleiben im bisherigen Budget. Eine zunächst
   ausprobierte Vergrößerung auslaufender Rauchflächen wurde verworfen.
   Die zusätzlichen Deckkraftdaten benötigen etwa 5 KiB bei vollen Pools.
   Das vorhandene adaptive Partikelbudget und `post=1` bleiben wirksam.
   Der Diagnosezähler berücksichtigt jetzt auch bereits vorhandenen Fahrstaub.

Keine Änderungen an Simulation, KI, Geschwindigkeit, Trefferberechnung,
Wirtschaft, Navigation, Kollisionsgeometrie, Kartenregeln oder HUD.
Keine neuen sichtbaren 3D-Assets oder Render-Passes. Bestehende unvollständige
Altmaterialien außerhalb des eng begrenzten Fassadenpasses werden nicht als
vollständig überarbeitet ausgegeben.

## Identischer Browservergleich

Chrome headless, ANGLE Metal / **Apple M5 Max**, 1440 × 900, DPR 1,
normaler RTS-Zoom **0,59**, identische Kamera und Tagesbeleuchtung,
`adaptive=0`, `post=0`. Je Karte zwölf eigene echte Fahrzeug-GLBs, vier gegnerische
Panzer, HQ, Kaserne und Fabrik. 45 Aufwärmframes, danach 300 Frames mit
**100 echten Simulationsticks / fünf Spielsekunden**. Die UI bleibt absichtlich
im Pausenmodus; der Test führt die Simulation kontrolliert mit `game.step(.05)`
aus und animiert/renderert dazwischen per `requestAnimationFrame`.

Die Ausgangsversion lädt die fünf betroffenen Renderer-Module direkt aus
`origin/main`; beide Versionen verwenden dieselben gebauten GLBs, die gleichen
kompilierten Gameplay-Dateien und dieselbe GPU. Der Runner prüft identische
Simulationsergebnisse, Kamera, Seeds und geladene Fahrzeugmodelle. Auf den drei
Karten entstehen 84 / 94 / 74 echte Schussereignisse. Fahrzeugposition, Hüllen-
und Renderwinkel sowie Laufposition werden während des Replays aufgezeichnet.

| Karte | FPS vorher → nachher | 1%-Low vorher → nachher | Mittlere Framezeit Δ | p95 vorher → nachher |
| --- | ---: | ---: | ---: | ---: |
| Desert Strike | 59,56 → 59,03 | 29,01 → 27,12 | +0,89 % | 17,0 → 21,2 ms |
| Broken Empire | 53,63 → 52,67 | 20,92 → 16,84 | +1,81 % | 24,6 → 25,4 ms |
| Burning Horizon | 57,65 → 57,85 | 12,35 → 12,50 | −0,34 % | 18,5 → 18,0 ms |

| Karte | Draw Calls/Frame, beide | Dreiecke/Frame, beide | GPU-Geometrien, beide | GPU-Texturen, beide |
| --- | ---: | ---: | ---: | ---: |
| Desert Strike | 6.460,03 | 1.729.911,45 | 2.017 | 346 |
| Broken Empire | 6.665,47 | 4.612.687,74 | 2.005 | 362 |
| Burning Horizon | 6.157,21 | 3.297.541,51 | 1.990 | 343 |

Draw Calls und Dreiecke sind Mittelwerte einschließlich Schatten und im
Replay auftretender Verluste/Effekte. JS-Heap-Endpunkte vorher/nachher:
Desert Strike 363,0/355,2 MiB, Broken Empire 364,4/362,7 MiB,
Burning Horizon 335,8/331,3 MiB. Die GPU-Ressourcenzahlen sind gleich;
die kurzen Heap-Snapshots sind kein Langzeit-Leaknachweis.

**Das mittlere Framezeitbudget wird in diesem Kurzlauf eingehalten. Eine
allgemeine Performancefreigabe folgt daraus nicht.** Auf zwei Karten fallen
die 1%-Lows schlechter aus. Desert Strikes gemessene CPU-/Treiber-Arbeitszeit
steigt von 12,10 auf 15,12 ms, obwohl die mittlere Ausgabe bei rund 60 FPS
bleibt; auf den anderen Karten fällt sie leicht. Shader-/Treiber- und
Scheduling-Einflüsse sind in einem einzelnen geordneten A/B-Paar nicht
isoliert. Frühere parallele Explorationsläufe schwankten erheblich und werden
nicht als Endergebnis verwendet. Der PR bleibt deshalb ein **Entwurf**, ohne
Auto-Merge oder Behauptung stabiler 60 FPS auf anderer Hardware.

Die normal gezoomten Bilder aller drei Karten wurden geprüft: militärische
Silhouetten, Fassadentexturen und blaue Teammarkierungen bleiben lesbar;
keine neue Bloom-/Kontrastschicht und keine dauerhaften zusätzlichen Wolken.
Die Gebäudedifferenz ist bewusst dezent; die Fahrzeug- und Partikeländerungen
zeigen sich vor allem während der Bewegung. Das dokumentierte Gefecht mit
16 Fahrzeugen ist kein Nachweis für lange Großschlachten oder beschädigte
Gebäude in allen möglichen Zuständen.

- [Desert Strike vorher](desert-strike-before-rts.png) / [nachher](desert-strike-after-rts.png), [Gefecht vorher](desert-strike-before-combat.png) / [nachher](desert-strike-after-combat.png)
- [Broken Empire vorher](broken-empire-before-rts.png) / [nachher](broken-empire-after-rts.png), [Gefecht vorher](broken-empire-before-combat.png) / [nachher](broken-empire-after-combat.png)
- [Burning Horizon vorher](burning-horizon-before-rts.png) / [nachher](burning-horizon-after-rts.png), [Gefecht vorher](burning-horizon-before-combat.png) / [nachher](burning-horizon-after-combat.png)
- [Panzer auf echter befahrbarer Steigung, RTS-Zoom](tank-on-slope-rts.png)
- [Kurzer Mitschnitt des echten Gefechtsreplays](desert-strike-after-animation.webm)
- [Messwerte mit zeitlichem Animationsverlauf und Simulationszuständen](measurements.json)

## Technische Validierung

- `npm run build`: TypeScript und kompletter WebGL-Build bestanden; Startup-
  Modulgraph geprüft. Keine versionierten GLB-Änderungen durch den Build.
- 23 gezielte Node-Prüfungen bestanden: 17 neue Regressionen, drei vorhandene
  Radbewegungsprüfungen und drei vorhandene Fassadenshaderprüfungen.
- Neue echte Browserregression plus vorhandener Combat-VFX-Test: **2/2 bestanden**.
  Hanglage 0,24045 rad Pitch / 0,01872 rad Roll; ein 0,20-rad-Zielwechsel wird
  im ersten 60-Hz-Frame mit 0,04681 rad begonnen. Kanonenhub 0,10 Modellmeter,
  Rückkehrfehler null, Hülle unverändert; Pause friert Pose und Lauf exakt ein.
  Der Spielstand bleibt beim reinen Grafikupdate unverändert. Rauchdeckkraft
  fällt von 1 auf 0,135; der Pool endet leer. Keine Page-/Shader-/WebGL-Fehler.
- Separater `post=1`-Smoke: vorhandenes Visual 3.0 aktiv, kein Fallback/Shaderfehler,
  gleiche Simulation und Geometrie-/Draw-Call-Werte in beiden Versionen.
  Dieser kurze, parallel zu funktionalen Tests erstellte Lauf wird **nicht**
  für eine zusätzliche Performanceaussage verwendet; siehe [post-smoke.json](post-smoke.json).
- Die komplette vorhandene Node-Suite ist bereits auf unverändertem `origin/main`
  nicht grün: 211 Fehler. Der Gegenlauf hat dieselben 211 fehlschlagenden
  Testnamen wie der Grafikbranch; Details in [test-results.json](test-results.json).
  Endgültiger Branch: 2.532 Tests, 2.318 bestanden, 211 fehlgeschlagen,
  drei übersprungen. Ausgangsbranch: 2.515 Tests, 2.301 bestanden, dieselben
  211 Fehler und drei übersprungene Tests.
- Drei ältere Browserfehler wurden mit den unveränderten Ausgangsmodulen
  reproduziert: zu kurze erwartete Leichenlebensdauer; entfernter
  `[data-action="cancel"]`-Selektor; veraltete Erwartung zur zunächst sichtbaren
  Gebäudekataloggruppe. Sie werden nicht durch HUD-/Gameplayänderungen kaschiert.
  [Gegenprüfung](baseline-browser-tests.txt), [abschließende Grafiktests](browser-tests.txt).

## Wiederholen

```sh
npm run build
PORT=8113 node scripts/serve.mjs
# In einem zweiten Terminal, ohne parallele CPU-/GPU-Last:
POLISH31_URL=http://127.0.0.1:8113 node scripts/qa-visual-polish31.mjs
# Funktionale Zusatzprüfung für das vorhandene optionale Postprocessing:
POLISH31_POST=1 POLISH31_MAP=desert-strike POLISH31_FRAMES=120 \
  POLISH31_OUTPUT=/private/tmp/sandforge-polish31-post-qa node scripts/qa-visual-polish31.mjs
SANDFORGE_BASE_URL=http://127.0.0.1:8113 tests/browser/node_modules/.bin/playwright test \
  --config=tests/browser/playwright.config.mjs tests/browser/webgl-visual-polish31.spec.mjs \
  tests/browser/webgl-combat-vfx.spec.mjs
```

`POLISH31_BASE_REF` wählt eine andere Ausgangsrevision. Der gespeicherte
Vergleich verwendet `ee0685a2`. Ein separater funktionaler Lauf mit
`POLISH31_VIDEO=1` zeichnet die echten Frames als WebM auf; dessen Messwerte
sind wegen der Aufzeichnung nicht mit dem Performancevergleich gleichzusetzen.
