#!/usr/bin/env bash
# Publica la app en GitHub Pages: compila y sube la carpeta dist/ a la rama gh-pages.
# Uso: bash scripts/publicar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
REMOTO=$(git remote get-url origin)
NOMBRE=$(git config user.name)
CORREO=$(git config user.email)
TMP=$(mktemp -d)
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll" # GitHub Pages sirve los archivos tal cual
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$NOMBRE" -c user.email="$CORREO" commit -q -m "Publicación $(date +%d-%m-%Y)"
git push -q --force "$REMOTO" gh-pages
echo "Publicado en la rama gh-pages"
