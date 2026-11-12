#!/bin/sh
# Construye la APK nativa de Nexo FPS (WebView + juego standalone).
# Requiere: JDK 17 (JAVA_HOME), SDK de Android con build-tools;34.0.0 y
# platforms;android-34. Uso:
#   JAVA_HOME=/ruta/jdk17 ANDROID_SDK=/ruta/sdk sh scripts/build-android.sh
set -e

SDK="${ANDROID_SDK:-/tmp/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/android"
OUT="$A/build"
VERSION="$(node -p "require('$ROOT/package.json').version")"
APK="NexoFPS-$VERSION-android.apk"

command -v java >/dev/null || { echo "ERROR: java no está en PATH (instala JDK 17 y exporta JAVA_HOME)"; exit 1; }
[ -x "$BT/aapt2" ] || { echo "ERROR: falta $BT/aapt2 (sdkmanager 'build-tools;34.0.0')"; exit 1; }
[ -f "$PLATFORM" ] || { echo "ERROR: falta $PLATFORM (sdkmanager 'platforms;android-34')"; exit 1; }
[ -f "$ROOT/dist/nexofps-standalone.html" ] || { echo "ERROR: ejecuta antes 'npm run bundle'"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex" "$A/assets"
cp "$ROOT/dist/nexofps-standalone.html" "$A/assets/nexofps.html"

echo "[nexo] compilando recursos…"
"$BT/aapt2" compile --dir "$A/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLATFORM" \
  --manifest "$A/AndroidManifest.xml" -A "$A/assets" \
  --auto-add-overlay "$OUT/res.zip"

echo "[nexo] compilando Java…"
javac --release 11 -classpath "$PLATFORM" -d "$OUT/classes" "$A"/src/com/nexofps/app/*.java

echo "[nexo] dexing…"
"$BT/d8" --release --lib "$PLATFORM" --min-api 21 \
  --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/app.apk"
(cd "$OUT/dex" && zip -qj "$OUT/app.apk" classes.dex)

echo "[nexo] alineando y firmando…"
"$BT/zipalign" -f 4 "$OUT/app.apk" "$OUT/aligned.apk"
KS="$A/debug.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias nexo -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass nexofps-key -keypass nexofps-key \
    -dname "CN=Nexo FPS,O=Nexo,C=ES"
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:nexofps-key --key-pass pass:nexofps-key \
  --out "$ROOT/dist/$APK" "$OUT/aligned.apk"
"$BT/apksigner" verify "$ROOT/dist/$APK"

echo "[nexo] APK lista: game/dist/$APK"
