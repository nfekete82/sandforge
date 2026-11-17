# Sandforge – KI- und Waffen-Balance (17.11.2026)

## Befund

Die geringe KI-Truppenzahl lag nicht nur an vorsichtigem Angriffsverhalten:

- Für den modernen Director galt ein wirtschaftsabhängiges Ziel von oft nur **18–22 Einheiten**, bereits inklusive Pionier, Sanitäter und Transportern. Der globale Spielmotor erlaubt 48.
- Produktionsobergrenzen bei **8 Infanterie, 3–4 Heavy, 1 Rover, 2 Tanks** machten mehrere Fabrik-/Kasernenwarteschlangen ungenutzt.
- Selbst nach höherer Obergrenze sank der Heavy-/Tank-/Artillerie-Score früh unter null und unterband weiteren Nachschub.
- Die moderne Heimatwache reservierte früh 2–5 Kämpfer, hielt offensives Vorrücken bis teilweise 65 s auf und blockierte moderne Nebenangriffe bis 180 s.

## Umgesetzter neuer KI-Stand

- Director-Armeeziel: **24–42 bezahlte Einheiten** abhängig von tatsächlichem Einkommen; Engine-Hardcap bleibt 48.
- Erhöhte Quoten: **12 Infanteristen, 5–6 Heavy, 2 Humvees, 4–6 Panzer, 2–4 Artillerie**, abhängig von realem Einkommen und bekannten Feindstellungen.
- Produktionsbewertung so korrigiert, dass die neuen Quoten auch tatsächlich angefordert werden.
- Öffnungs-/Stabilisierungsphase der modernen Verteidigungsdoktrin auf **125 s** verkürzt. Erster sicherer Angriff ab **50 s** möglich; spätere mobile Nebenangriffe früher.
- Kein kostenloses Spawnen, kein CPU-only Geldbonus, keine Aufhebung von Fog-of-War, kein Entfernen von echten Rückzugs-, Reparatur- oder Belagerungsregeln.

## Waffen-Audit

Alle Werte aus `src/reborn/catalog.ts`, `config.ts`, `simulation.ts` und `unit-accuracy.ts`.

| Angriff → Ziel | Treffer-Schaden | Roh-DPS | Erwartete DPS bei 25 % WebGL-Fehlschüssen |
| --- | ---: | ---: | ---: |
| Standardinfanterie → Infanterie | 17 | 20.0 | 15.0 |
| Schwere Infanterie → Infanterie | **90** | 78.3 | 58.7 |
| Schwere Infanterie → Panzer | 24 | 20.9 | 15.7 |
| Humvee → Infanterie | 13 | 19.1 | 14.3 |
| Panzer-Dach-MG → Infanterie | 18 | 32.7 | 24.5 |
| Panzer-Hauptwaffe → Panzer | 155 | 66.0 | 49.5 |
| Raketenwerfer-Soldat → Infanterie (direkt) | **14.5** | 3.5 | 2.7 |
| Raketenwerfer-Soldat → Panzer | 145 | 35.4 | 26.5 |
| Raketenwerfer-Soldat → Transportheli | 174 | 42.4 | 31.8 |
| Fahrzeugraketenwerfer → Gebäude | 120 | 31.6 | 23.7 |
| Geschützturm → Infanterie | 24 | 30.0 | 22.5 |

Die erwarteten DPS sind **vereinfachte, stationäre Mittelwerte** aus Schaden/Cooldown und 25 % Schussfehlern, nicht gemessene Gefechtsresultate. Flugbahn, Zielverfolgung, Mehrfachsalven, Rüstung, Veteranie, Wetter, Höhenbonus, Bewegung und Flächenschaden beeinflussen echte Duelle.

### Zwei behobene Kampf-Ausreißer

1. **Schwere Infanterie**: 120 Basis-Schaden konnte einen 100-LP-Soldaten in einer einzigen Salve töten, während die Heavy selbst 420 LP hat. Gegen Infanterie gelten jetzt 75 % des 120er-Werts (**90 LP**). Gegen Panzerung, Luft und Gebäude bleiben die bisherigen separaten Multiplikatoren unverändert.
2. **Gelenkte Schulterraketen**: Gegen Infanterie wurden 145 × 0.10 bei der Projektilerzeugung und **nochmals × 0.10** beim direkten Einschlag berechnet (nur **1.45 LP**). Der getroffene Soldat erhält jetzt **14.5 LP**; die separate kleine Nachbar-Splash-Reduktion bleibt bestehen. Anti-Fahrzeug-, Luftabwehr- und Gebäude-Schaden unverändert.

## Unveränderte Gegenmaßnahmen

- Artillerie **680 m** Reichweite vs. Geschützturm **600 m**; dafür schwache Panzerung, langsame Bewegung und Wetter-Drift.
- Kampfpanzer feuert gegen Infanterie mit eigenem Dach-MG; seine 155er Hauptwaffe bleibt für schwere Ziele.
- Schulterraketen bleiben sehr schwach gegen Fußsoldaten, aber stark gegen Fahrzeuge und Luft.
- Transportheli dient hauptsächlich dem Infanterietransport; Bomber hat Bomben-Fallzeit und große Ausholkurven.
- Keine Änderung an Kosten, HP, Produktionszeiten oder Sieg-/Eroberungsregeln im Waffen-Patch.

## Prüfung

Tests ergänzt in `tests/reborn-ai-director.test.mjs` und `tests/reborn-combat-balance-20261117.test.mjs`; im Bastion-PBR-Integrationstest eingebunden.

**Noch ausstehend:** unabhängiger Build, komplette Testsuite und mehrjährige/stichprobenartige AI-vs-AI-Simulation verschiedener Kartengrößen und Seeds. Der Quellcode-Audit ist keine statistisch belegte Winrate-Balance. Nach Tests ggf. weiter justieren.
