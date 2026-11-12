# Nexo FPS — Biblia del juego (documento maestro)

Índice completo y ordenado de todo el diseño: visión, reglas detalladas y estado
de implementación. Cada área indica **estado actual** (✅ implementado y
verificado / 🔶 parcial / 🔜 ROADMAP) y dónde vive en el código.
Versión del documento: **1.6.0**.

---

## 1. Visión general

- **Género:** Battle Royale de supervivencia y disparos. Los jugadores caen en un
  mapa, buscan equipo y pelean mientras la zona segura se cierra. Gana el último
  en pie.
- **Modos:** solo, dúo, trío (opcional) y escuadrón de 4 + rápidos, clasificatorio,
  especiales y práctica.
- **Plataformas:** Windows, Linux, macOS (nativas), Android APK, iOS, web/teléfono.
- **Modelo de negocio:** gratis, con cosméticos, pase de batalla, ruleta con pity,
  tienda y suscripciones. **Nunca se vende poder directo.**
- **Pilares:** partidas justas (servidor autoritativo), variedad cosmética, soporte
  rápido por Discord con IA, contenido nuevo cada temporada.
- **Las 12 áreas:** cuenta y seguridad · lobby y menús · modos · mapa y zona ·
  armas y equipo · personajes y mascotas · vehículos · economía · progreso ·
  social · gráficos/sonido/ajustes · soporte en Discord.

## 2. Cuenta y seguridad — ✅ implementado (base completa)

- Registro/login con correo (scrypt + sesiones 30 días), **2FA TOTP**, baneos,
  reportes, perfil y estadísticas: `game/src/server/accounts.ts`.
- **Telegram al propietario** (ventas, reportes, canjes): `game/src/server/telegram.ts`.
- Anti-hacker server-side (speedhack, teletransporte, fuera del mundo):
  `game/src/shared/antiCheat.ts`.
- Pantalla de carga con logo, consejos, versión y barra; login de invitado con
  aviso de vincular cuenta.
- ROADMAP 🔜: login Google/Facebook/Apple, alerta de dispositivo nuevo, cierre de
  sesión remoto, código de recuperación, descarga/eliminación de datos.

### Flujo del propietario con Telegram (IA recomienda, humano decide)
1. Creas el bot con **@BotFather** (`/newbot`) → te da `TELEGRAM_BOT_TOKEN`.
2. Escribes algo a tu bot y obtienes tu `TELEGRAM_CHAT_ID`.
3. Pones ambos en `game/.env` → el servidor te avisa de cada venta PayPal,
   reporte, canje y resumen diario. **Tú apruebas baneos y decisiones sensibles.**
4. La IA nunca banea sola: notifica y espera tu confirmación.

## 3. Lobby y menús — ✅ implementado (web + meta-panel)

- Personaje seleccionable, selector de modo y mapa, ajustes completos
  (gráficos/sonido/juego/red/controles), pantalla de login.
- Meta-panel: tienda, pase, ruleta, armario, evolutivas + misiones, logros,
  social, códigos. Puntos rojos en lo nuevo; fullscreen.
- ROADMAP 🔜: poses de lobby, banners rotativos, fondo por temporada, buzón con
  caducidad de 30 días y "reclamar todo".

## 4. Modos de juego — ✅ 8 implementados de 14

| Modo | Estado | Efecto real en la simulación |
|---|---|---|
| Solo | ✅ | clásico |
| Clasificatorio | ✅ | puntos RR (Bronce→Nexo) |
| Rápido | ✅ | zona 2.2× |
| Mini BR | ✅ | zona 3×, partidas ~5 min |
| Solo Pistolas | ✅ | lista blanca pistola/revólver |
| Solo Francotiradores | ✅ | lista blanca francotirador/precisión |
| Armas Gigantes | ✅ | daño ×2 |
| Modo Noche | ✅ | oscuridad permanente |
| Dúo / Escuadrón / Infectados / TDM / Práctica / Creativo | 🔜 ROADMAP | definidos en `gameModes.ts` |

Detalles por modo: duración 3–25 min, 2–100 jugadores, premios de NX/XP/puntos,
disponibilidad fija o rotativa, requisitos de nivel.

## 5. Mapa y zona segura — ✅ implementado (base) · 🔶 zonas de diseño

- 3 mapas (Nexo Urbano, Desierto Solar, Volcán Ceniza) con 8 POIs cada uno.
- **Cada POI tiene nivel de loot (alto/medio/bajo)** que determina los spawns
  (10–14 / 6–9 / 3–5 objetos): `game/src/shared/map.ts`.
- Zona en 5 fases con daño creciente, **zona roja con bombardeos**, ciclo
  día-noche de 8 min, nubes, cuadrícula A1–H8 y brújula.

### Tabla de zonas de referencia (Isla Obsidiana, diseño)

| Zona | Loot | Peligro | Detalles |
|---|---|---|---|
| Base Militar Alfa (norte) | Extremo | Extremo | Hangares, búnker con tarjeta roja, equipo nivel 3 |
| Puerto Central (sur) | Muy alto | Muy alto | Grúas, contenedores, faro |
| Ciudad Neón (este) | Alto | Alto | Rascacielos, metro, techos |
| Fábrica Química (oeste) | Medio-alto | Alto | Tanques explosivos, escopetas |
| Aeropuerto Viejo | Medio-alto | Medio-alto | Torre de control, abierto |
| Pueblo Marino | Medio | Medio | Muelle, botes, aterrizaje tranquilo |
| Aldea del Valle | Medio | Medio | Cruce de caminos |
| Mina Abandonada | Medio | Medio | Túneles oscuros |
| Granjas del Sur | Bajo | Bajo | Principiantes |
| Bosque Denso | Bajo | Bajo | Emboscadas |
| Desierto Rojo | Bajo | Medio | Francotiradores |
| Campamento del Lago | Bajo | Bajo | Muelle y botes |
| Isla Secreta | Legendario | Alto | Laboratorio, tarjeta azul, en bote |

### Fases de la zona (diseño de referencia)

| Fase | Espera | Cierre | Radio final | Daño/s |
|---|---|---|---|---|
| 1 | 3:00 | 2:00 | 2.5 km | 1 |
| 2 | 2:00 | 1:30 | 1.5 km | 2 |
| 3 | 1:30 | 1:00 | 900 m | 3 |
| 4 | 1:00 | 0:50 | 450 m | 5 |
| 5 | 0:50 | 0:40 | 200 m | 8 |
| 6 | 0:30 | 0:30 | 80 m | 12 |
| 7 (final) | 0:20 | 0:20 | 0 m | 20 |

Cada fase elige centro al azar dentro del círculo anterior; línea blanca
(siguiente) y azul (actual); alarma antes de cada cierre.

- ROADMAP 🔜: clima (lluvia/niebla/nieve/arena), zonas secretas con tarjetas,
  meteoritos, variantes invierno/ruinas, mapa mini 2×2 km.

## 6. Fases de la partida y HUD — ✅ implementado (base)

1. **Sala de espera** (lobby con cuenta atrás) → 2. **Salto/caída** (drop con
   paracaídas) → 3. **Inicio** (loot) → 4. **Medio juego** (zona) → 5. **Final** →
   6. **Eliminación** (espectador) → 7. **Victoria/derrota con resumen**.
- HUD: brújula, vivos, bajas, minimapa, killfeed, vida/armadura/escudo, armas y
  munición, flechas de daño, chat rápido, cuadrícula.
- ROADMAP 🔜: revivir compañeros (dúo/escuadrón), baliza de reaparición,
  repeticiones, compartir.

## 7. Armas y estadísticas — ✅ 24 implementadas

Daño al torso por bala (vida base 100). Escala interna top-down ya balanceada;
las tablas del diseño (pistolas 22–55, SMG 15–24, rifles 30–48, escopetas
60–110 cerca, francotiradores 55–130, LMG 26–32) están trasladadas con TTK
objetivo: SMG 0.5–0.7 s, rifle 3–4 balas, escopeta 1–2 disparos cerca,
francotirador de un tiro a la cabeza. `game/src/shared/weapons.ts`.

- **Categorías completas**: 4 pistolas, 4 subfusiles, 5 rifles, 4 escopetas,
  4 francotiradores, 2 ametralladoras, lanzacohetes explosivo.
- Rareza (6 colores, gris→rojo) con multiplicadores de daño; daltónico soportado.
- Granadas (85 de daño en área), airdrops, zona roja.
- ROADMAP 🔜: accesorios (miras 1x–8x, silenciador −70% sonido, cargador
  extendido/rápido, empuñadura), cuerpo a cuerpo (cuchillo/machete/hacha/bate/
  sartén), lanzables (humo, flash, gas, molotov, mina), armas de evento
  (hielo/curación/perforantes), daño por zona del cuerpo (cabeza ×1.5–2.5,
  brazos ×0.8, piernas ×0.7).

## 8. Equipo, curación y munición — ✅ implementado (base)

- Chaleco y casco con niveles (reducción de daño creciente), botiquines,
  escudos, munición por tipo con mochila que amplía capacidad.
- Tabla de diseño de referencia: venda +12/3 s (hasta 75%), botiquín +75/6 s,
  kit médico +100/8 s, bebida +30 y +10% velocidad, escudos +25/+50.
- ROADMAP 🔜: durabilidad de chaleco/casco, mochilas por nivel con espacios,
  objetos de utilidad (dron, radar, baliza de revivir, gancho, escudo portátil).

## 9. Vehículos — ✅ implementado (terrestres + acuáticos)

- Moto, buggy, todoterreno, blindado y bote (`vehicles.ts`): velocidad, vida,
  asientos, **atropello escalado por velocidad**, explosión con daño en área,
  choques que dañan el vehículo, subida/bajada con **E**.
- Aparecen en anillo por mapa + botes en los bordes; blindado solo en Volcán Ceniza.
- Diseño: sirven para escapar de la zona, no para ganar fácil; riesgo por ruido,
  poca protección y explosiones.
- ROADMAP 🔜: pasajeros que disparan, combustible con bidones, aéreos
  (planeador, helicóptero), cuatrimoto, lancha, skins de vehículo.

## 10. Personajes, roles y mascotas — ✅ implementado

- **9 personajes con rol** (`characters.ts`): los 6 roles del diseño cubiertos —
  atacante (Vulcano, Kael), apoyo (Aurora, Vita), explorador (Nova), defensor
  (Titán, Bruno), sigilo (Sombra), francotirador (Halcón). Activa con cooldown +
  pasivas; slide y prone.
- Fichas de diseño con definitiva (ultimate), debilidad y costo están en la
  spec; las definitivas son ROADMAP 🔜.
- **Mascotas** (`pets.ts`): 6 con bonos pasivos pequeños (curación, velocidad,
  botín, munición; +8%/nivel, máx. 30), se compran con NX (gratis jugando).
  Regla de equilibrio: bonos ≤15%, las gratis siempre útiles.
- ROADMAP 🔜: definitivas, evolución visual de mascotas, niveles de personaje
  con fragmentos, sinergias de escuadrón.

## 11. Economía — ✅ implementado (base)

- **Dalos** (se compran con PayPal, 4 paquetes) + **NX** (se ganan jugando) +
  fragmentos + VIP. Tienda 100% cosmética; todo lo que da ventaja se consigue gratis.
- Tablas de diseño de referencia (precios orientativos): paquetes de diamantes
  $0.99–$99.99 con bonus creciente; skins 20–4000; pase premium ~$9.99; pase
  élite ~$19.99; pases semanal/mensual; paquete de bienvenida con doble carga.
- Cómo ganar sin pagar: misiones, eventos, pase gratuito, códigos, logros,
  anuncios opcionales (~300–600 diamantes/mes para un jugador activo).
- Regalos entre amigos con recargo y límites; reembolsos con revisión; control
  de gasto mensual y parental.
- ROADMAP 🔜: moneda de evento caducable, mercado de intercambio, tienda de
  clan, ofertas rotativas con cuenta regresiva, precios regionales.

## 12. Progreso — ✅ implementado (base)

- Pase de batalla (30 niveles, gratis + premium), misiones diarias/semanales,
  logros, login diario 7 días, rangos Bronce→Nexo con RR, evolutivas,
  maestría de personaje/arma.
- **Ruleta con pity** (`roulette.ts`): épico garantizado en ≤10 giros sin épico,
  legendario en ≤50; contadores visibles y probabilidades publicadas
  (transparencia exigida por tiendas y países).
- Sistema de rangos de diseño: Bronce→Leyenda con divisiones, puntos por
  posición + bajas, protección de ascenso, sin pérdida en Bronce, reinicio
  suave por temporada.
- ROADMAP 🔜: temporadas con reinicio suave y cine, niveles clave de cuenta
  (10/20/30 desbloquean modos), prestigio y títulos, misiones de clan.

## 13. Social — 🔶 parcial

- Amigos, clanes con moneda de clan, leaderboard, reportes: `accounts.ts`.
- Chat rápido en partida; killfeed; espectador clicable.
- ROADMAP 🔜: chat de voz, escuadras persistentes con relleno automático,
  torneos con llaves, repeticiones, transmisión, regalos, perfiles con
  privacidad, jugadores recientes.

## 14. Gráficos, sonido y ajustes — ✅ implementado

- 4 presets de calidad (Baja 30 → Ultra 90+), daltónico (3 tipos), filtros de
  color, reducir efectos, idioma es/en, controles remapeables, volúmenes
  separados, sensibilidad.
- SFX sintetizados (WebAudio) sin assets; HUD completo con flechas de daño.
- Diseño de sonido: pasos por superficie, disparo por arma, sonido 3D,
  música de lobby/zona final/victoria, subtítulos con indicadores visuales.
- ROADMAP 🔜: voces de personajes y narrador, modo fotógrafo, trazadoras
  personalizadas, atardeceres dinámicos.

## 15. Soporte y comunidad (Discord con IA) — 🔶 blueprint listo

- Blueprint completo de 12 secciones (bienvenida/verificación, anuncios, canje
  de códigos, soporte con tickets, baneos y apelaciones, cuenta y perfil,
  compras, bugs, comunidad, competitivo, voz, equipo interno):
  `discord/DISCORD.md`. Anuncio con embed: `discord/embed.json`.
- **Reglas de oro del soporte**: la IA nunca decide un baneo permanente sola;
  nunca pedir contraseñas ni datos de pago; verificar identidad antes de
  entregar cuentas; guardar registros de todo; moderadores 24 h.
- ROADMAP 🔜 (requiere `DISCORD_BOT_TOKEN` del propietario): bot de
  verificación `/vincular`, bot de códigos `/canjear`, `/perfil`, `/estado`,
  tickets con prioridades, apelaciones "IA recomienda, humano decide".

---

## Reglas de oro (balance y justicia)

1. **Sin pay-to-win**: solo cosméticos y comodidades; las mascotas tienen bonos
   pequeños y se compran con NX que se gana jugando.
2. **Servidor autoritativo**: el cliente nunca decide daño, inventario ni resultado.
3. **Transparencia**: probabilidades de la ruleta publicadas + pity garantizado.
4. **La IA nunca banea sola**: recomienda; un humano confirma (Telegram/Discord).
5. Parches de balance con notas públicas cada 2–4 semanas; datos de qué gana
   demasiado; escuchar sugerencias del Discord.

## Hoja de ruta de lanzamiento

- **Día 1**: 1 mapa + modos rápidos (✅), 24 armas (✅), 9 personajes (✅),
  pase + tienda + ruleta (✅), misiones (✅), amigos/reportes (✅),
  descargas nativas (✅).
- **Mes 1–3**: dúo/escuadrón reales, infectados, TDM, clima, accesorios de
  armas, bot de Discord, temporadas, torneos.
- **Año 1**: modo creativo con editor y códigos de sala, colaboraciones, más
  idiomas, torneo mundial, programa de creadores.

## Métricas a vigilar (panel /admin y Telegram)

Jugadores diarios/mensuales · retención D1/D7/D30 · duración de partidas y
tiempo de cola · ingresos (ARPU/ARPPU/% pagadores) · reportes y sanciones ·
tickets y tiempos de respuesta · opiniones en tiendas.
