# Änderungsprotokoll

## 1.8.0

- WebGL validiert Start, Kampagnen, Regelprofile, HUD und Spielstände mit Chromium. Classic Canvas und Atlas bleiben als separat aufrufbare Archive verfügbar.
- Standardbuild und Docker verpacken die finalen PBR-Modelle von HQ und Kaserne für beide Fraktionen aus Git.
- Kosten bereits bezahlter Produktionsaufträge und historische Einheitenstatistiken bleiben beim Speichern und Laden erhalten. Die Stabilisierung korrigiert außerdem die WebGL-Sammelpunktsteuerung und das Ausblenden von Zielmarkierungen in der taktischen Pause.
- Der Eigentümer hat die drei deutschen Stimmtypen anhand der Vergleichsproben freigegeben. Alle 47 Clips sind aktiv.

- Neun aktive Einheitentypen mit eigenen Rollen: Sanitäter, Bauarbeiter, verstärkte schwere Infanterie sowie Fahrzeuge und Luftunterstützung.
- Artillerie zum Raketenwerfer mit 680 M Reichweite, 830 M Sicht, sichtbaren Flugkörpern und Flächenschaden umgebaut.
- Transporthelikopter durch ein eigenes Mi-8/17-inspiriertes PBR-Modell für beide Teams ersetzt: fünfblättriger Hauptrotor, unabhängiger Heckrotor, 16 Richtungen und acht Spritephasen. Kampfhelikopter aus dem aktiven Kader entfernt; alte Einheiten und bezahlte Aufträge werden migriert. Zehn Transportplätze bleiben erhalten.
- Raketenwerfer mit originaler Panzer-Tarntextur in Oliv, Braun und Sand, 2K-Lackdetails, flächenbezogenen UVs und zusätzlicher Patina überarbeitet; Teamfarben und Spielwerte erhalten.
- Raketenwerfer durch einen detaillierten 6×6-Lkw mit Sechsfachwerfer nach HIMARS-Referenz ersetzt: PBR-Teammodelle, animierte Räder, Drehkranz und teleskopierende Hubzylinder. Sechs echte Mündungen für Geschosse und Startblitze; Spielwerte und Saveformat unverändert.
- Landeanflug an den Bremsabstand angepasst und durchgehende Rotor-/Propellerphase beim Wechsel zwischen Stillstand und Flug gesichert.
- Kompakter Geschützturm mit 600 M Reichweite, 750 M Sicht, eigenständig drehbarem Kopf, zwei registrierten Mündungen und blockierten Schusslinien hinter Felsen.
- Gezielter Gebäudeaufbau und Reparaturen durch echte Arbeiter; Sanitäter mit begrenzter verteilter Heilung, Selbstversorgung und Position hinter der Front.
- Gemischte, bezahlte KI-Armeen mit Sammeln, Aufklärung, Verteidigung, Belagerung, Flanken und Versorgung.
- Neue Kampagnen mit 16 Bastionen und je zwei Startsektoren pro Fraktion. Karten und Spielstände der beiden älteren 30-Bastionen-Versionen bleiben kompatibel.
- Sidebar als eigene CSS-Grid-Spalte; Kamera, Randscrollen, Auswahl, Bauplatzierung, Zoom und Retina an den tatsächlichen Canvas-Ausschnitt angepasst.
- Dreiersalven, Mündungsfeuer, kurze Tracer, Waffengeräusche und sichtbare Heilungs-/Bau-/Reparaturaktivität.
- 47 lokale Funkmeldungen mit Gruppenbegrenzung, Priorität, Wiederholungsschutz und eigener Lautstärke. Drei neue deutsche VoiceDesign-Stimmen A/B/C nach Hörfreigabe für alle 47 Clips aktiviert; die bisherige Bank bleibt gesichert.
- Vom Nutzer überarbeitete Bastion mit vorhandenen Oberflächen, Radar-, Leuchtfeuer- und Sweep-Animationen übernommen; Fraktionsfassungen und registrierte Canvas-Ebenen erstellt.
- README, deutsche Release Notes, Asset-/Lizenznachweise und reproduzierbare Audioaudits ergänzt. Sechs veraltete Browser-Testannahmen auf aktuelle Modelle, Salven, Balance und Spielfeldbreite aktualisiert; Gameplaywerte beim abschließenden Qualitätsdurchgang erhalten.

Ältere Änderungen werden nicht nachträglich aus Commit-Titeln als veröffentlichte Versionen rekonstruiert. Lokal und auf `origin` wurden am 24.10.2026 keine Tags und über GitHub keine Releases gefunden.
