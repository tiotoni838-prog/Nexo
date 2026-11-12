# Nexo FPS

Battle Royale original, competitivo y accesible. Este repositorio contiene la
**especificación de ingeniería** (`NEXO_FRONTIER_MEGA_SPEC.part*`, 100.000 fichas de
trabajo) y el **vertical slice jugable** en `game/`.

## Qué hay implementado (v1.4.0, verificado)

- **Simulación autoritativa compartida** (`game/src/shared/`): movimiento con colisiones,
  **12 armas** con rarezas y daño inspirado en balística real (incluido **lanzacohetes
  explosivo** con daño por área), granadas, airdrops legendarios, loot,
  inventario, zona dinámica en 5 fases con daño creciente, victoria último-en-pie,
  espectador clicable y resultados.
- **3 mapas** (`game/src/shared/map.ts`): Nexo Urbano, Desierto Solar y Volcán Ceniza,
  cada uno con 8 puntos de interés propios, densidad de cobertura y paleta visual
  distinta. Selección con `NEXO_MAP=<id>` en el servidor; el cliente muestra el nombre
  del mapa y renderiza con su paleta.
- **Anti-hacker server-side** (`game/src/shared/antiCheat.ts`): detección de speedhack,
  teletransporte ilegal y posición fuera del mundo con strikes, expulsión automática y
  decaimiento; el cliente nunca decide daño, inventario ni resultados.
- **Doble moneda**: **NX** se gana jugando (kills + posición final, `computeMatchNxEarned`)
  y **USD** es la moneda de pago. La tienda tiene artículos de ambas monedas, todos
  cosméticos (sin pay-to-win).
- **Sistema de actualizaciones** (`game/src/shared/version.ts` + `/api/version`): el
  cliente compara su versión con la del servidor y muestra un banner "Actualizar" que
  recarga con la nueva build.
- **Logo y branding** (`game/client/logo.svg`): logo SVG original con degradado Nexo,
  favicon y menú con fondo animado.
- **Servidor de partida autoritativo** (`game/src/server/`): tick 30 Hz, snapshots 15 Hz,
  validación de mensajes, límites anti-abuso, versionado de protocolo, bots de
  entrenamiento, endpoint `/health`. El cliente nunca decide daño, inventario ni resultados.
- **Cliente web de alta resolución** (`game/client/` + `game/src/client/`): canvas con
  escalado por `devicePixelRatio` (hasta 3×), partículas con glow, sombras, viñeta,
  screen shake, tracers luminosos, SFX sintetizados originales (WebAudio, sin assets),
  teclado/ratón remapeable, controles táctiles, HUD completo, español/inglés, alto
  contraste y escalado de texto.
- **Modo "mi dispositivo es el servidor"** (requisito del propietario): el anfitrión
  ejecuta la MISMA simulación autoritativa en su dispositivo y los invitados se conectan
  por WebRTC con STUN (`game/src/client/p2p.ts`). Incluye además servidor dedicado Node.
- **Personajes con cuerpo y habilidades** (nivel 3): 6 personajes (Aurora, Sombra,
  Titán, Halcón, Vita, Vulcano) con 1 habilidad activa + pasivas estilo los grandes
  del género pero 100% originales: **Muro de Cuarzo** (cobertura desplegable que
  bloquea balas y granadas), Sprint Sombra, Piel de Titán, Recarga Táctica, Pulso
  Sanador y Sobrecarga. Movimiento avanzado: **deslizarse** (impulso con cooldown)
  y **cuerpo a tierra** (menos velocidad, perfil más pequeño). En el cliente web los
  jugadores se dibujan como **humanoides articulados** (torso, cabeza, brazos,
  piernas con ciclo de caminata, arma en manos) con **alas cosméticas** opcionales.
- **Proyecto Godot 4.3 real** (`godot/`): cliente 3D con personajes humanoides con
  cuerpo completo, mapa con edificios y árboles, zona dinámica y lógica pura
  determinista portada a GDScript, verificada headless (29/29 checks).
- **Tienda PayPal activa solo server-side** (`game/src/paypal/`): catálogo 100% cosmético,
  OAuth client-credentials, create/capture order con idempotencia. Las credenciales se
  leen de variables de entorno (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) — nunca en
  código, cliente, APK ni Git. Copia `game/.env.example` a `game/.env` y rellénalo; el
  servidor lo carga al arrancar.
- **Panel de ganancias del propietario** (`/admin`): página protegida por token
  (`ADMIN_TOKEN`) que consulta la API de transacciones de PayPal y muestra total USD,
  número de operaciones y desglose por artículo. Endpoint JSON: `/api/admin/earnings?days=N`.

## Descargar y jugar (v1.4.0)

En la carpeta [`releases/`](releases/) del repo (o en `/download` del servidor de juego,
con botones por plataforma):

- **[NexoFPS-1.4.0-windows-x64.zip](https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.4.0-windows-x64.zip)** —
  **aplicación nativa de Windows** (Electron 33): descomprime y ejecuta `nexo-fps.exe`.
- **[NexoFPS-1.4.0-linux-x64.zip](https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.4.0-linux-x64.zip)** —
  **aplicación nativa de Linux**: descomprime y ejecuta `./nexo-fps`.
- **NexoFPS-1.4.0-macos** — se genera con `cd game && npm run desktop`
  (`dist-desktop/NexoFPS-darwin-x64` y `-arm64`); no se aloja en Git por superar los
  100 MB por archivo de GitHub.
- **[NexoFPS-1.4.0-web-standalone.zip](https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.4.0-web-standalone.zip)** —
  el juego completo en UN archivo HTML. Descomprime, abre `NexoFPS.html` con doble clic
  y juega contra bots sin internet. Windows / macOS / Linux. También funciona en el
  navegador del **teléfono** (controles táctiles + pantalla completa).
- **[NexoFPS-1.4.0-servidor.zip](https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.4.0-servidor.zip)** —
  servidor dedicado (Node.js 20+) con tienda PayPal y panel de ganancias.

Android (APK) e iOS: el proyecto WebView nativo se empaqueta con Android Studio /
Xcode — instrucciones en `docs/OPERATIONS.md` (no se alojan binarios sin build
verificada de esos IDE).

Para anunciar el juego en **Discord**: guía y embed listos en [`discord/DISCORD.md`](discord/DISCORD.md).

### Descargas por plataforma y avisos al dueño (v1.4.0)
- **Página propia por plataforma**: `/download/windows`, `/download/linux`,
  `/download/macos`, `/download/android`, `/download/ios`, `/download/web` y
  `/download/servidor` — cada dispositivo con su forma de descarga paso a paso.
- **Avisos Telegram al propietario**: ventas PayPal, reportes, canjes y baneos
  llegan al bot de @BotFather (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` en `.env`);
  sin credenciales el servidor funciona igual (no-op silencioso).
- **Blueprint completo del servidor de Discord** (`discord/DISCORD.md`): canales,
  roles, bots de IA, reglas, flujo de tickets/apelaciones y anuncio listo
  (`discord/embed.json`).
- **Lista viva de tareas del dueño** (`docs/TAREAS-DUENO.md`): credenciales que
  faltan, suscripciones de tiendas y decisiones pendientes.

### Gráficos y entorno (v1.3.0)
- **4 presets de calidad** (`game/src/shared/graphics.ts`): Baja (30 FPS), Media,
  Alta y Ultra (90+ FPS) con tope de DPR, densidad de partículas, sombras y objetivo
  de FPS; migración automática de ajustes antiguos.
- **Ciclo día-noche** de 8 minutos con 4 fases (día, atardecer, noche, amanecer):
  el cielo cambia de color y la oscuridad se aplica sobre el mundo.
- **Nubes en movimiento**, **zona roja** con bombardeos cada ~50 s (explosiones con
  daño en área y aviso en pantalla) y muro de zona segura visible.
- **HUD extendido**: **brújula** de 8 direcciones, **coordenadas de cuadrícula**
  ("estoy en C4", 8×8), **flechas de dirección de daño** y bordes rojos al recibir
  daño; **chat rápido** y killfeed ya existentes.
- **6 rarezas con color** (gris/verde/azul/morado/dorado/rojo) y **modo daltónico**
  (protanopia, deuteranopia, tritanopia) aplicado también a rarezas.
- **Filtros de color**: normal, cálido, frío y blanco y negro; opción **reducir
  efectos** (menos sacudidas y destellos) para accesibilidad.

### Meta-juego (v1.2.0)
- **Monedas**: **Dalos** (se compran con PayPal, 4 paquetes con bono) y **NX** (se ganan
  jugando: kills + posición). Todo cosmético, sin pay-to-win.
- **Pase de Batalla** Temporada 1: 30 niveles, ruta gratis + premium (950 Dalos),
  recompensas automáticas al subir de nivel.
- **Ruleta**: 1 giro gratis cada 24 h, giros extra con Dalos, probabilidades visibles.
- **Armario**: equipa skins, estelas, banners y gestos conseguidos.
- **Evolutivas**: maestría por personaje con títulos (Novato → Leyenda).
- **Cuentas** (`NEXO_DATA_DIR` en el servidor): registro/login con correo y contraseña
  (scrypt + sesiones de 30 días), **verificación en dos pasos TOTP**, baneos, reportes,
  perfil y estadísticas persistentes.
- **Social**: amigos, clanes con moneda de clan, tabla de clasificación por campo
  (bajas, victorias, partidas, Top 5, puntos RR) y sistema de reportes.
- **Misiones**: 3 diarias rotativas + 4 semanales con reclamo de recompensas;
  **logros** con progreso acumulado; **login diario** con ciclo de 7 días (premio
  grande el día 7).
- **Rangos clasificatorios**: Bronce → Plata → Oro → Platino → Diamante → Nexo,
  con puntos RR por kills, posición y victoria (modo Clasificatorio).
- **10 modos de juego**: Solo, Dúo, Escuadrón, Clasificatorio, **Rápido** (zona 2.2×),
  **Solo Pistolas** (lista blanca real de armas), Infectados, TDM, **Práctica** (zona
  0.5×) y Creativo. Los implementados cambian la simulación real; el resto está en el
  ROADMAP y se marca "(pronto)" en el menú.
- **Economía extendida**: **fragmentos** por partida para fabricar objetos por rareza,
  **VIP** (bonus NX + Dalos diarios) y **códigos de canje** con cooldown y usos.
- **Cosméticos ampliados**: skins, estelas, banners, gestos, **sprays, paracaídas,
  marcos de perfil, insignias y mascotas** (9 slots de armario).
- **Ajustes completos**: gráficos (calidad con tope de DPR y partículas, tope de FPS,
  sombras, brillo), sonido (volumen general/música/efectos), juego (modo daltónico,
  indicadores de daño), red (región, ahorro de datos) y controles remapeables.

Para generar el standalone localmente: `cd game && npm run bundle`.

## Ejecutar

```bash
cd game
npm install
npm run build

# Servidor dedicado + cliente web
npm start            # juego en ws://localhost:7777, salud en http://localhost:8080/health
npm run client       # sirve el cliente en http://localhost:8080

# Pruebas
npm test

# Proyecto Godot 4 (verificación headless de lógica 3D)
godot --headless --path ../godot --script res://tests/logic_tests.gd
```

En el menú del juego: **Entrenamiento** (partida local con bots, sin red), **Crear
partida** (tu dispositivo hace de servidor P2P) o **Unirse** (WebSocket o P2P).

## Documentación

- [docs/RESEARCH.md](docs/RESEARCH.md) — investigación de referentes del género.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura y decisiones.
- [docs/ADR-0001-motor-y-transporte.md](docs/ADR-0001-motor-y-transporte.md)
- [docs/TRACEABILITY.md](docs/TRACEABILITY.md) — matriz requisitos ↔ código ↔ pruebas.
- [docs/SECURITY.md](docs/SECURITY.md) — seguridad, privacidad, secretos, PayPal.
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — operación, límites y limitaciones honestas.
- [docs/TAREAS-DUENO.md](docs/TAREAS-DUENO.md) — credenciales y tareas pendientes del propietario.
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases siguientes según la spec maestra.

## Estado honesto

Esto es un **vertical slice**, no el juego comercial completo: hay builds nativas de
escritorio (Windows/Linux/macOS vía Electron), pero APK/iOS firmados, matchmaking
global, voz y moderación avanzada quedan para las fases 4–6 de la spec maestra. No se
afirma rendimiento sin medir; no se declara compatibilidad de plataforma sin build y
pruebas reales.
