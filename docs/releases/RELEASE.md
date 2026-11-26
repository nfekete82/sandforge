# Sandforge: Bastion Wars – Veröffentlichung 1.8.0

Der geprüfte Spielstand ist der Merge-Commit `8533cf00d4207cd9b7045a8e534142a69ebb90d3` aus [PR #497](https://github.com/nfekete82/sandforge/pull/497). Die [CI auf main](https://github.com/nfekete82/sandforge/actions/runs/45768425191) ist erfolgreich. Paket und Lockdatei stehen auf 1.8.0.

## Tag und GitHub Release

Im sauberen Release-Worktree mit privater Git-Identität ausführen. Bestehende Tags nicht verschieben.

```sh
git fetch origin main --tags
git merge-base --is-ancestor 8533cf00d4207cd9b7045a8e534142a69ebb90d3 origin/main
git show 8533cf00:package.json | head -12
git tag --list v1.8.0
git ls-remote --tags origin refs/tags/v1.8.0
```

Nur wenn der Commit in main liegt, die Version stimmt und kein Tag vorhanden ist:

```sh
git tag -a v1.8.0 8533cf00 -m 'Sandforge: Bastion Wars 1.8.0'
git push origin refs/tags/v1.8.0
gh release create v1.8.0 --verify-tag --draft \
  --title 'Sandforge: Bastion Wars 1.8.0' \
  --notes-file docs/releases/v1.8.0-de.md
```

Die Release-Notizen stammen aus dem aktuellen Dokumentationsstand. Vor Veröffentlichung den GitHub-Entwurf prüfen. Alternativ das Release in der GitHub-Weboberfläche erstellen. Kein Force-Push und kein automatisches Uberspace-Deployment.

## Lokal spielen

Node.js 20 oder neuer; CI verwendet Node 22.

```sh
npm ci
npm run dev
```

http://127.0.0.1:8095/ – alternativ `docker compose up --build -d`. Die Standardoberfläche ist WebGL. Der Webhosting-Upload auf Uberspace bleibt bis zur gesonderten Abnahme gesperrt.

## Optionales Browserpaket

Auf einem sauberen Checkout des freigegebenen Tags:

```sh
npm ci
npm run build
cp THIRD_PARTY_NOTICES.md dist/THIRD_PARTY_NOTICES.md
mkdir -p release-artifacts
ditto -c -k --keepParent dist release-artifacts/sandforge-v1.8.0.zip
shasum -a 256 release-artifacts/sandforge-v1.8.0.zip
```

Das Archiv über einen HTTP-Server starten. Vor einer öffentlichen Weitergabe sind die Rechte der enthaltenen Assets und die Lizenz des Projekts zu prüfen; siehe [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md). Die öffentliche Sichtbarkeit des Repositorys ist keine allgemeine Lizenzfreigabe.

[Historischer Release-Entwurf 1.9.0 (24.10.2026)](v1.9.0-de.md) · [Release-Abnahme 1.8](../../RELEASE-1.8-STATUS.md).
