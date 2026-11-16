# Sandforge — Texturstandard für neue 3D-Assets

Ziel: **Keine flachen Standardmaterialien auf sichtbaren, texturierbaren Oberflächen**. Low-Poly-Geometrie bleibt als effiziente Silhouette; die Details kommen aus den Materialien.

## Mindestanforderungen

1. Für jedes **sichtbare** Asset-Material ein UV-gemapptes Base-Color-/Albedo-Bild verwenden, nicht nur eine diffuse Materialfarbe. Ausnahmen: unsichtbare Hilfsgeometrie, rein emissive Lichter und bewusst flächig gestaltete UI-Overlays.
2. Zu jedem Base-Color-Bild eine **Normal Map** für feine Stoff-, Holz-, Beton- oder Metallstruktur und eine **Roughness Map** für matte/glänzende Zonen anlegen. Metallische Oberflächen erhalten einen technisch sinnvollen Metalness-Wert oder eine Metalness-Map.
3. Texturmaßstab nach realen Bauteilen festlegen und an normalem RTS-Zoom testen. Keine Holzmaserung an Betonpfeilern und keine riesigen Fasern auf Sandsäcken.
4. Bestehende, korrekt eingebettete PBR-Materialien aus GLB **nicht** mit zusätzlichen world-space Camouflage-Shadern übermalen. Neue Materialien müssen auch während einer bewegten Bauvorschau stabil bleiben.
5. Für mehrere Instanzen dieselben Maps wiederverwenden; möglichst 256–1024 Pixel, mipmapped, komprimieren und GPU-Speicher beachten. Sichtbare Props brauchen nicht pro Mesh eigene 1K-Texturen.
6. Tests sichern ab, dass alle sichtbaren Prop-Meshes UVs, Normalen und echte Albedo-/Normal-/Roughness-Maps verwenden. Zusätzlich im Spiel prüfen: Oberflächendetail, Schatten, Materialkontrast und Performance.

## Aktuelle Umsetzung

Die Kaserne nutzt für die drei ersetzten Prop-Familien das Modul `scripts/webgl-barracks-prop-materials.js`. Dieses erzeugt **deterministische 256×256-Bildtexturen als THREE.DataTexture** (keine reinen Farbtints): neun wiederverwendete PBR-Materialrollen mit Albedo-, Normal- und Roughness-Daten.

- Sandsäcke: gewebtes sandfarbenes Leinen, leicht dunklere Säcke, Nahtgarn
- Kisten: olivgrüne Lackierung, Deckel, Holzmaserung und abgenutzter Beschlagstahl
- Schüssel: gebürsteter Reflexionskörper, dunkler Mast, heller Metallrand

Die übrige Kaserne behält ihre bereits in der finalen GLB eingebetteten PBR-Materialien. Bei alten Kaserne-GLBs ohne die erwarteten Prop-Namen bleibt der neue Pass ein No-op.

**Qualitätsstufe:** Die generierten Maps sind eine robuste, reproduzierbare Grundtexturierung. Für Fotorealismus können sie später durch künstlerisch erzeugte/gebakene 1K-PBR-Atlanten ersetzt werden – unter Beibehaltung derselben Materialrollen und Tests.
