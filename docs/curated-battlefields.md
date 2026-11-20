# Drei feste Sandforge-Schlachtfelder

Sandforge hat im WebGL-Hauptmenü unter **Neues Spiel → Schlachtfeld** drei
kuratierte, eingefrorene Karten. Inspiration sind klassische
Command-&-Conquer-Mechaniken – keine kopierte Karten-Geometrie.

| ID | Name | Bastionen | Biom | Gelände | Strategische Übung |
| --- | --- | ---: | --- | --- | --- |
| staubkrone | **Staubkrone** | 8 | Wüste | offene Oasen-Arena | schnelle Expansion und Flanken |
| frostpforte | **Frostpforte** | 12 | Schnee | ein zentraler Felsdurchbruch | Verteidigen, Belagern, Nachschub |
| schlangenfeste | **Schlangenfeste** | 16 | Dschungel | verschlungener Kamm, drei Übergänge | kontrollierter Flankenwechsel |

Jedes Preset fixiert `seed`, Kartengröße/`mapVersion`, Profil, Biom und
**generatorVersion 5**. Die Namen sind stabile IDs, damit die KI-A/B-Tests
dieselbe Welt erhalten. Die normale Zufallskarte bleibt als vierter Menüpunkt.

## Gespeicherte Partien

Generator v5 wird im Spielstand gespeichert und bei `Simulation.load()`
wiederhergestellt. V1–V4-Maps bleiben in ihrer Geometrie unverändert.
Das Preset-Label ist nur sichtbar, wenn der laufende Spielzustand exakt
mit den Preset-Parametern übereinstimmt. Das Biom/Label wird kosmetisch
wie zuvor außerhalb der autoritativen Save-Struktur abgelegt.

## Warum der neue Generator?

Ein als offen markierter Canyon-Pass konnte unter Generator v4
physisch eine diagonale Steigung von über 30 % aufweisen. Das überstieg
die erlaubte Steigung der Fahrzeuge. Für die drei **neuen** fixierten
Karten reduziert v5 nur die Höhenunterschiede in den existierenden
Passkorridoren. A*-Suche, Fahrerzeug-Slope-Limits, Kollision und
Fog-of-War bleiben echte Autorität; kein Fahrzeug wird teleportiert.

## KI-Training als reproduzierbarer Wettbewerb

`npm run benchmark:curated` testet jede Karte für jeweils 480
Spielsekunden gegen **guarded**, **contesting**, **bastion-rush**.
Der Benchmark führt die alte und die koordinierte KI-Variante bei exakt
gleichem Startzustand gegeneinander aus. Als Messgrößen werden erfasst:
echte Siege/Niederlagen, HQ-Schaden, Bastion-Kontrolle, Fahrzeugstau,
fehlende Wege und tatsächlich abgefeuerte Schüsse.

Der GitHub-Actions-Workflow
`sandforge-curated-ai-training-20261120.yml` startet die drei Karten
parallel und legt pro Karte die Rohdaten und die von
`score-sandforge-curated-training.mjs` berechnete Scorecard als
GitHub-Artefakte ab.

**Wichtig:** Das ist ein kontrollierter Simulations-/Optimierungsparcours,
kein neuronales Training oder stilles Lernen im Hintergrund. KI-Regeln
werden nur nach Vergleich der Scorecards geändert und anschließend auf
allen drei Karten erneut getestet. So vermeiden wir das Überoptimieren
auf eine einzelne Canyon-Karte.
