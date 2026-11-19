# Sandforge · Balance-Turnier (8 / 12 / 16 Bastionen)

## Ziel und Regeln

Das Turnier prüft *denselben* Seed, dieselbe KI 3.6 / Battle-Director-Logik und dieselbe Verteidigerstrategie jeweils mit zwei symmetrischen Katalogen. In jedem einzelnen Gefecht gelten für Blau und Rot identische Preise, LP und Kampffähigkeiten. Keine Seite erhält kostenlose Einheiten.

- **Baseline**: Turm 175 Credits, schwere Infanterie 250 Credits, Raketeninfanterie 95 LP, Forschungszentrum 950 Credits.
- **Tuned**: Turm 300 Credits, schwere Infanterie 300 Credits, Raketeninfanterie 110 LP, Forschungszentrum 700 Credits.
- **Maps**: 24 / 25 / 26 = 8 / 12 / 16 Bastionen, **Generator v4** mit verschiedenen Landschaftstypen.
- **Blue defender**: reguläre bezahlte Gegnerökonomie (`guarded`, `contesting`, `bastion-rush`). Red nutzt den vorhandenen Battle Director.
- **Messung**: Gewinne, Niederlagen, *echte Timeouts*, First Contact, tatsächliche Geschosse, längste Kampfpausen, eroberte/verlorene Bastionen, Einkommensvorsprünge, produzierte und zerstörte Einheiten, HQ-Schaden, Node-Simulationstaktzeit.

## Lokal ausführen

Im Sandforge-Projekt:

```bash
npx tsc -p tsconfig.json
node scripts/benchmark-sandforge-balance-tournament.mjs \
  --maps 24,25,26 --seeds 824836862 \
  --opponents guarded --seconds 120 \
  --presets baseline,tuned \
  --output reports/balance-smoke.json \
  --markdown reports/balance-smoke.md
```

Für das vollständige **48-Match-Turnier** (alle vier v4-Landschaftstypen):

```bash
node scripts/benchmark-sandforge-balance-tournament.mjs \
  --maps 24,25,26 \
  --seeds 824836862,20261119,20261120,9999 \
  --opponents guarded,contesting --seconds 300 \
  --presets baseline,tuned \
  --output reports/balance-full.json \
  --markdown reports/balance-full.md
```

Die JSON-Zwischenergebnisse werden nach jedem vollständigen Match persistiert. Ein unterbrochener Bericht ist als `complete: false` markiert und darf nicht als abgeschlossenes Turnier ausgewertet werden.

## GitHub Actions

Workflow `Sandforge 8-12-16 Bastion paired balance tournament`: Push erzeugt das vollständige 48-Match-Turnier mit JSON/Markdown als Artifacts. Über **Run workflow → full = false** kann ein schneller 6-Match-Smoketest gestartet werden.

## Auswertung

Vergleiche zuerst **gepaarte Änderungen** auf identischen Seeds und identischen Gegnern statt absolute Siegraten. Kontrolliere besonders folgende Qualitätsmerkmale:

1. Kosten/Nutzen der Türme: Turm-Spam darf Angriffe nicht durch unendlich günstige Festungen abwürgen; Artillerie bleibt Konter.
2. Schwere Infanterie soll Standardinfanterie schlagen, aber nicht bei geringeren Kosten ganze Trupps ausradieren.
3. Raketeninfanterie soll gegen Fahrzeuge und Luftangriffe effizient sein, nicht in Schützengefechten dominant werden.
4. Forschungszentrum soll mittelfristig erreichbar sein, ohne die frühe Truppenproduktion zu verdrängen.
5. Mehr Action soll sich durch mehr *echte* Kampfereignisse und kürzere Gefechtspausen zeigen, nicht durch kostenlose KI-Verstärkungen.

**Grenzen:** Headless-Simulation ohne echten WebGL-Renderer, also keine FPS-Messung. Fünf Minuten Spielzeit und wenige Seeds können echte Siege selten machen; Timeouts sind keine Siege. Die Simulation beobachtet zwei definierte KI-Strategien und simuliert keine menschlichen Entscheidungen. Für endgültige Balanceentscheidungen zusätzlich menschliche Matches, längere Laufzeiten und mehr Seeds vergleichen.
