export type Lang = 'es' | 'en';

type Dict = Record<string, { es: string; en: string }>;

export const STRINGS: Dict = {
  title: { es: 'NEXO: FRONTIER', en: 'NEXO: FRONTIER' },
  subtitle: {
    es: 'Battle Royale original — vertical slice',
    en: 'Original Battle Royale — vertical slice',
  },
  playSolo: { es: 'Entrenamiento (con bots)', en: 'Training (with bots)' },
  hostOnline: { es: 'Crear partida (mi dispositivo es el servidor)', en: 'Host match (my device is the server)' },
  joinOnline: { es: 'Unirse con WebSocket', en: 'Join via WebSocket' },
  joinP2p: { es: 'Unirse P2P al anfitrión', en: 'Join P2P host' },
  name: { es: 'Nombre', en: 'Name' },
  address: { es: 'Dirección del servidor', en: 'Server address' },
  connect: { es: 'Conectar', en: 'Connect' },
  settings: { es: 'Ajustes', en: 'Settings' },
  sensitivity: { es: 'Sensibilidad', en: 'Sensitivity' },
  textScale: { es: 'Tamaño de texto', en: 'Text size' },
  highContrast: { es: 'Alto contraste', en: 'High contrast' },
  subtitles: { es: 'Subtítulos de audio', en: 'Audio subtitles' },
  language: { es: 'Idioma', en: 'Language' },
  keybinds: { es: 'Controles', en: 'Controls' },
  forward: { es: 'Avanzar', en: 'Forward' },
  back: { es: 'Retroceder', en: 'Back' },
  left: { es: 'Izquierda', en: 'Left' },
  right: { es: 'Derecha', en: 'Right' },
  reload: { es: 'Recargar', en: 'Reload' },
  pickup: { es: 'Recoger', en: 'Pick up' },
  heal: { es: 'Botiquín', en: 'Medkit' },
  shieldItem: { es: 'Celda de escudo', en: 'Shield cell' },
  swap: { es: 'Cambiar arma', en: 'Swap weapon' },
  waitingPlayers: { es: 'Esperando jugadores…', en: 'Waiting for players…' },
  chooseDrop: { es: 'Elige tu punto de aterrizaje en el mapa', en: 'Choose your landing spot on the map' },
  alive: { es: 'Vivos', en: 'Alive' },
  kills: { es: 'Bajas', en: 'Kills' },
  victory: { es: '¡VICTORIA!', en: 'VICTORY!' },
  defeat: { es: 'Eliminado', en: 'Eliminated' },
  placement: { es: 'Puesto', en: 'Placement' },
  backToMenu: { es: 'Volver al menú', en: 'Back to menu' },
  spectator: { es: 'Modo espectador', en: 'Spectator mode' },
  killFeed: { es: 'Registro de bajas', en: 'Kill feed' },
  zoneShrinking: { es: '¡La zona se está cerrando!', en: 'The zone is closing!' },
  zoneClosingSoon: { es: 'La zona se cierra pronto', en: 'Zone closes soon' },
  outsideZone: { es: '¡FUERA DE LA ZONA! Vuelve al círculo', en: 'OUTSIDE THE ZONE! Return to the circle' },
  disconnected: { es: 'Desconectado del servidor', en: 'Disconnected from server' },
  versionMismatch: { es: 'Versión incompatible con el servidor', en: 'Incompatible version with server' },
  store: { es: 'Tienda (solo cosméticos)', en: 'Store (cosmetics only)' },
  reloadKey: { es: 'Tecla recargar', en: 'Reload key' },
  pressKey: { es: 'Pulsa una tecla…', en: 'Press a key…' },
  hostCode: { es: 'Código de anfitrión (cópialo y pásalo a tus amigos)', en: 'Host code (copy and share with friends)' },
  pasteCode: { es: 'Pega aquí el código del anfitrión', en: 'Paste the host code here' },
  answerCode: { es: 'Código de respuesta (devuélveselo al anfitrión)', en: 'Answer code (send it back to the host)' },
  createOffer: { es: 'Generar invitación', en: 'Generate invite' },
  acceptAnswer: { es: 'Aceptar respuesta', en: 'Accept answer' },
  copy: { es: 'Copiar', en: 'Copy' },
  p2pHelp: {
    es: 'El anfitrión genera una invitación; el invitado la pega y devuelve una respuesta. La partida corre en el dispositivo del anfitrión.',
    en: 'The host generates an invite; the guest pastes it and returns an answer. The match runs on the host device.',
  },
};

export const t = (key: keyof typeof STRINGS | string, lang: Lang): string => {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang];
};
