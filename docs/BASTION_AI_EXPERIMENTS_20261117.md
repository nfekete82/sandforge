# Sandforge – Bastion-first KI: empirische Versuche (17.11.2026)

## Ziel und Versuchsaufbau

Die KI soll **zuerst Bastionen einnehmen und halten**, danach gegnerische Gebäude/Einheiten vernichten. Die Änderungen dürfen keine kostenlosen Einheiten, Credits, allwissenden Fog-Zugriff oder veränderte Schadenswerte einführen.

Gepaartes A/B auf identischem Simulator/Spielregeln/Katalog, identischer Karte/Seed, identischen Startressourcen, gleichem gewöhnlich bezahlten BLUE-Gegner, 20 Simulationsschritte/Sekunde. `--opponent guarded` bleibt der bisherige stationäre Verteidiger; `--opponent contesting` baut/rekrutiert über normale APIs und versucht selbst, Bastionen einzunehmen. Eine Partie endet bei Sieg/Niederlage vor dem Zeitlimit; **Timeout ist kein Sieg**.

Gemessen werden u. a. *Bastion-Kontrollzeit* (Integral der eigenen Bastionsanzahl über die tatsächliche Partiedauer), *Bastionen im Zeitmittel pro Partie* (Bastion-Kontrollzeit / wirkliche Partiedauer), Anzahl am Ende, Verluste, Eroberungen, Rückeroberungen, produktive Zeiten und Siege. Der zeitgemittelte Wert wird je Paar gebildet; die rohe Kontrollzeit darf nicht ohne die unterschiedlich lange Partiedauer interpretiert werden.

## Versuch A – Zwei separate feste Frontwachen statt einer

- Hypothese: ein zweiter regulär bezahlter Wachposten erhöht Bastionskontrolle.
- 8 gepaarte Partien, 10 Minuten Limit, Karten 4/23, Seeds 2026–2029, `guarded`.
- Bastionen im Zeitmittel **3,87 → 3,87**, Endbesitz **4,88 → 4,88**, Siege **5/8 → 5/8**, Frontbewachung **24,33 % → 23,28 %**.
- **Keine nachweisbare Verbesserung; Codeänderung rückgängig gemacht.**
- Lauf: https://github.com/nfekete82/sandforge/actions/runs/44133859147

## Versuch B – Frühe Eroberung mit zwei zusätzlichen bezahlten Kämpfern

- Hypothese: während Aufbauphase kann eine eigene Zweiergruppe zusätzliche neutrale Bastionen besetzen, ohne die Hauptgruppe zu schwächen.
- Je 4 gepaarte Partien, Karten 4/23, Seeds 2026–2027, 10 Minuten, zwei separate Gegnerstile.
- `guarded`: Bastionen im Zeitmittel **4,17 → 4,17**, identische Kontrolle/Verluste/Siege.
- `contesting`: Bastionen im Zeitmittel **3,15 → 3,13**; Endbesitz **3,75 → 4,00**, eigene Verluste **6,75 → 6,00**. Der höhere Endbesitz überkompensiert die schlechtere Kontrollzeit nicht.
- **Kein robuster Kontrollzeitgewinn; KI-Frühraid zurückgenommen.** Der rein experimentelle, regulär bezahlte BLUE-Gegner bleibt für realistischere Tests erhalten.
- Lauf: https://github.com/nfekete82/sandforge/actions/runs/44136277652

## Versuch C – Lokale Bastionsverteidigung statt weit entfernter Hauptarmee abzuziehen

- Ursache: Vorher berief `TacticalAI.localDefense` sämtliche verfügbaren Kampfeinheiten zu einem sichtbaren, einzelnen Gegner bei einer eigenen Bastion, selbst wenn die eigentliche Armee weit entfernt andere Bastionen angriff.
- Neue Regel: bei **isoliertem Bastionsalarm** ausschließlich tatsächliche, bezahlte Truppen im Umkreis von 900 Einheiten heranziehen; Mitglieder der laufenden Hauptangriffsgruppe nur bis 460 Entfernung. Sanitäter ebenfalls lokal. **Echte Basis-/Kommandozentralen-Einbrüche bleiben Vollnotfälle** und dürfen die gesamte verfügbare Verteidigung mobilisieren.
- 4 gepaarte Partien gegen `contesting`, Karte 4/23 und Seeds 2026/2027, je max. 10 Minuten:
  - Bastionen im Zeitmittel **3,15 → 3,48** (+0,33).
  - Bastionen am Ende **3,75 → 4,75** (+1,00).
  - Bruttoeroberungen **5,75 → 6,50**.
  - Eigene Verluste **6,75 → 5,50**.
  - Organisierte Angriffsmissionen **9,75 → 11,00**.
  - Siege **1/4 → 2/4**.
  - Rohe Bastion-Kontrollsekunden **1554,04 → 1501,84**, weil Partien bei Siegen früher enden können; **nicht** als absoluter Zeitgewinn ausgeben.
  - Frontbewachung **31,93 % → 29,98 %**: die Verbesserung stammt nicht von mehr stationären Wachen.
- **Vorläufiger, messbarer Fortschritt; Code behalten**, neue CI-Regressionsprüfungen für wirkliche Verteidigungsbefehle, keinen Hauptgruppen-Abzug und echte HQ-Notfallreaktion.
- Lauf: https://github.com/nfekete82/sandforge/actions/runs/44138296092

## Technische Prüfungen und Grenzen

- Unabhängige Headless TypeScript + 64/64 KI- und Kampfregressionen zuletzt erfolgreich: https://github.com/nfekete82/sandforge/actions/runs/44138005282
- Die lokale Variante ist keine bewiesene Winrate-Steigerung über alle Kartentypen: nur vier Paare, geskripteter Gegner. Karte 23/Seed 2026 sank im Zeitmittel **1,89 → 1,75**.
- Ein breiteres Experiment über Karten 4,23,24 und vier Seeds pro Karte (24 Gefechte) ist in `.github/workflows/sandforge-bastion-local-defense-validation.yml` als GitHub-Workflow definiert. Ein Resultat ist **noch nicht bestätigt**.
- Das allgemeine PBR-Build-Workflow bleibt wegen vier großer, ausschließlich auf dem User-Mac liegender Kaserne/HQ-GLBs blockiert; diese Blockade hat nichts mit dem Headless-KI-Code zu tun.
- `develop` und `main` sind **nicht** durch diese Integration verändert; PR #325 ist weiterhin Draft.

## Nachweis

- KI-Logik: `src/reborn/tactical-ai.ts`.
- Experimente und Gegner: `scripts/ai-test-arena.mjs`, `scripts/benchmark-reborn-ai.mjs`, `scripts/benchmark-ai-opponent.mjs`, `scripts/ai-bastion-control-report.mjs`.
- Neu belegte Regressionsfälle: `tests/reborn-bastion-expansion-20261117.test.mjs`.
