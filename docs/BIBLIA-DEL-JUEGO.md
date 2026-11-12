# Nexo FPS — Biblia del juego (documento maestro)

Índice completo y ordenado de todo el diseño. Cada área indica **estado actual**
(implementado y verificado / parcial / ROADMAP) y dónde vive en el código.
Versión del documento: **1.5.0**.

---

## 1. Cuenta y seguridad — ✅ implementado
- Registro/login con correo (scrypt + sesiones 30 días), **2FA TOTP**, baneos,
  reportes, perfil y estadísticas: `game/src/server/accounts.ts`.
- Avisos al propietario por **Telegram** (ventas, reportes, canjes): `game/src/server/telegram.ts`.
- Anti-hacker server-side (speedhack, teletransporte, fuera del mundo): `game/src/shared/antiCheat.ts`.
- ROADMAP: login Google/Apple/Facebook, alertas de dispositivo nuevo, cierre remoto.

## 2. Lobby y menús — ✅ implementado (web + meta-panel)
- Personaje seleccionable (6 con habilidades), selector de modo y mapa, ajustes
  completos (gráficos/sonido/juego/red/controles), pantalla de login.
- Meta-panel de 5 pestañas: tienda, pase, ruleta, armario, evolutivas + misiones,
  logros, social, códigos.
- ROADMAP: poses de lobby, banners rotativos, fondo por temporada.

## 3. Modos de juego — ✅ 8 implementados de 14
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

## 4. Mapa y zona segura — ✅ implementado
- 3 mapas (Nexo Urbano, Desierto Solar, Volcán Ceniza) con POIs propios.
- Zona en 5 fases con daño creciente, **zona roja con bombardeos** cada ~50 s,
  **ciclo día-noche** de 8 min, nubes, cuadrícula A1–H8 y brújula.
- ROADMAP: clima (lluvia/niebla), zonas secretas con llave, estructuras destruibles.

## 5. Armas, equipo y objetos — ✅ implementado
- 24 armas con rareza (6 colores) y daño inspirado en balística real; lanzacohetes
  explosivo; granadas; airdrops; chaleco/casco; botiquines/escudos; munición.
- ROADMAP: accesorios (miras, silenciador, cargadores), molotov/flash, minas.

## 6. Personajes, roles y mascotas — ✅ implementado
- 9 personajes originales con activa + pasivas (`characters.ts`); slide y prone.
- **Mascotas** (`pets.ts`): 6 con bonos pasivos pequeños (curación, velocidad,
  botín, munición), nivel por partidas (máx. 30), se compran con NX (gratis jugando).
- ROADMAP: definitivas (ultimates), evolución visual de mascotas, emotes sincronizados.

## 7. Vehículos — ✅ implementado (terrestres + acuáticos)
- Moto, buggy, todoterreno, blindado y bote (`vehicles.ts`): velocidad, vida,
  asientos, **atropello escalado por velocidad**, explosión con daño en área,
  choques contra obstáculos que dañan el vehículo, subida/bajada con **E**.
- Aparecen en anillo por mapa + botes en los bordes; el blindado solo en Volcán Ceniza.
- ROADMAP: pasajeros que disparan, combustible, aéreos (planeador, helicóptero),
  skins de vehículo.

## 8. Economía — ✅ implementado
- **Dalos** (PayPal, 4 paquetes) + **NX** (se ganan jugando) + fragmentos + VIP.
- Tienda 100% cosmética; todo lo que da ventaja se consigue gratis.
- ROADMAP: moneda de evento, mercado de intercambio, regalos entre amigos.

## 9. Progreso — ✅ implementado
- Pase de batalla T1 (30 niveles, gratis + premium), misiones diarias/semanales,
  logros, login diario 7 días, rangos Bronce→Nexo con RR, evolutivas por personaje.
- **Ruleta con pity** (`roulette.ts`): épico garantizado en ≤10 giros sin épico,
  legendario en ≤50; contadores visibles y probabilidades publicadas.
- ROADMAP: temporadas con reinicio suave, cine de temporada, niveles clave de cuenta.

## 10. Social — 🔶 parcial
- Amigos, clanes con moneda de clan, leaderboard, reportes: `accounts.ts`.
- Chat rápido en partida; killfeed; espectador clicable.
- ROADMAP: chat de voz, escuadras persistentes, torneos, repeticiones.

## 11. Gráficos, sonido y ajustes — ✅ implementado
- 4 presets de calidad (Baja 30 → Ultra 90+), daltónico (3 tipos), filtros de color,
  reducir efectos, idioma es/en, controles remapeables, volúmenes separados.
- SFX sintetizados (WebAudio) sin assets; HUD completo con flechas de daño.

## 12. Soporte y comunidad — 🔶 parcial
- Blueprint completo del servidor de Discord con IA: `discord/DISCORD.md`.
- Anuncio con embed listo: `discord/embed.json`. Avisos al dueño: Telegram.
- ROADMAP: bot de Discord (verificación/canje/perfil), tickets con IA + humano.

---

## Reglas de oro (balance y justicia)
1. **Sin pay-to-win**: solo cosméticos y comodidades; las mascotas tienen bonos
   pequeños y se compran con NX que se gana jugando.
2. **Servidor autoritativo**: el cliente nunca decide daño, inventario ni resultado.
3. **Transparencia**: probabilidades de la ruleta publicadas + pity garantizado.
4. **La IA nunca banea sola**: recomienda; un humano confirma (Telegram/Discord).
5. Parches de balance con notas públicas cada 2–4 semanas.

## Hoja de ruta de lanzamiento
- **Día 1**: 1 mapa + modos rápidos (✅ ya cubierto), 24 armas (✅), 9 personajes (✅),
  pase + tienda + ruleta (✅), misiones (✅), amigos/reportes (✅).
- **Mes 1–3**: dúo/escuadrón reales, infectados, TDM, clima, accesorios de armas,
  bot de Discord, temporadas.
- **Año 1**: modo creativo con editor, torneos, colaboraciones, más idiomas.

## Métricas a vigilar (panel /admin y Telegram)
Jugadores diarios/mensuales · retención D1/D7/D30 · duración de partidas ·
ingresos y conversión · reportes y sanciones · tickets y tiempos de respuesta.
