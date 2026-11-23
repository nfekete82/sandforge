# Sandforge: 3–4 Spieler – technische Umstellung (23.11.2026)

**Status:** Die bisherige Engine spielt ausschließlich 1 gegen 1.
Dieser Branch enthält lediglich einen deterministischen Spiel-/Team-/Startpunktplaner.
**Das Menü darf 3–4 Spieler nicht freischalten, bevor die folgenden
Spielsysteme die neuen Fraktionen vollständig unterstützen.**

## UI-Vorschlag (nach Engine-Migration)
- Teilnehmer: `2` / `3` / `4`
- Gegner: 1, 2 oder 3 eigenständig strategische KI-Instanzen
- Spielmodus: Jeder gegen jeden (bei 2/3/4 Spielern);
  2 gegen 2 (nur bei 4, 1 Mensch + 1 verbündete KI gegen 2 Gegner-KIs)
- Karten: 8, 12 oder 16 Bastionen. 4-Bastionen-Karten zunächst 1v1
- FFA-Teamfarben: Blau (Mensch), Rot, Gelb, Violett
- Eigene Wirtschaft, Produktion, Kampfgruppen, Technologie und Fog of War
  pro Spieler; keine Gratis-Ressourcen oder unsichtbare Gegnerkenntnisse.

## Stand 23.11.2026 (PR #471)

- **Implementiert:** alle 1v1-/FFA-/2v2-Start-/Teamkonfigurationen;
  vier unabhängige Teilnehmer-Slots mit eigenem Sichtpuffer, Gedächtnis,
  Krediten, Forschung und unabhängigen KI-Uhrzeiten als skalierbare
  Runtime-Grundlage.
- **Implementiert:** teamorientierte Feinderkennung, zulässige
  Ziel- und Eroberungsauswahl, umkämpfte Bastionen mit mehreren
  gegnerischen Teams und gemeinsame Einnahme durch Verbündete.
- **In der EXISTIERENDEN 1v1-Simulation eingebunden:**
  universelle Siegprüfung, unabhängige Fog-/Memory-Allokation und
  teamorientierte Entscheidung, welche reale Einheit einen
  Bastions-Eroberungskreis beanspruchen darf.
- **Noch nicht spielbar:** echte Fraktion-2/-3-Einheiten oder Gebäude.
  Die Simulator-Typen, Produktions- und Kampflogik sowie TacticalAI
  benötigen eine systematische per-Actor-Migration; die WebGL-Auswahl
  bleibt absichtlich bei zwei Teilnehmern.

## Implementierungsreihenfolge

1. **Match-Konfiguration:** `multiplayer-setup.ts` berechnet
   Seed-/MapVersion-stabile vier Start-Ecken, Teams und Controller-Rollen.
   1v1 übernimmt exakt das vorhandene `campaignLayout`. Keine Änderung
   von Spielstand-/Engine-Typen nötig – in diesem PR umgesetzt.
2. **Faction/Simulation:** `Faction`, `Owner`, `credits`,
   `startRegions`, `research`, `hadBuildings`, Waffen/Friendly-Fire,
   Capture- und Produktionslogik auf `2..4` Teilnehmer migrieren;
   nach dem Migration-Gate weder Arrays mit fixen 2 Slots noch
   hartcodierte `owner===0/1`-Gegnervergleiche.
3. **Sicht und Bots:** unabhängige `memories[player]`,
   `explored[player]` und je Spieler ein `TacticalAI` mit eigenem
   `TacticalState`, `aiClock` und Drosselung. Verbündete Einheiten
   nur nach ausdrücklich definierter Team-Sichtregel teilen.
4. **Sieg/Niederlage:** statt `victory/defeat` für die beiden alten
   Seiten auf verbleibende unabhängige Teams prüfen. Ein Team darf
   nicht allein durch das Ausschalten *eines* von drei Gegnern gewinnen.
5. **Serialisierung:** neues optionales `participants`-Feld
   mit einer neuen Save-Version, ältere 1v1-Spielstände exakt weiterhin laden.
   Netz-Multiplayer ist nicht Teil dieses lokalen Mehr-KI-Projekts.
6. **WebGL/HUD/UI:** vier unterscheidbare Teamfarben in Shadern,
   UI-Portraits, Minimap und Sichtbarkeits-/Auswahlfiltern,
   dazu Startdialog, eigene Teamlogik und ein FFA-/2v2-Endscreen.
7. **Performance-/Balance-Gates:** deterministische Seeds,
   3-/4-KI-Ressourcenbudgets, 1x/2x/4x, volle 15–20-minütige
   Spiele, vier Karten und Engstellen; keine globalen Cheats.

## Sicherheits-Gates
- Kein Button, der nur `bots=3` setzt und weiterhin lediglich einen
  Gegner simuliert.
- Keine Gegnerposition aus der für eine andere Fraktion sichtbaren Welt.
- Keine Übernahme von globalen `tactical`-Feldern für weitere Bots.
- Keine stillschweigende Konvertierung alter 1v1-Saves.
- Feature bleibt bis zur echten Mehr-Fraktionen-Engine ein Draft.
