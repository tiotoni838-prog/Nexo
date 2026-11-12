import { PROTOCOL_VERSION } from './constants.js';
import type { Rarity } from './constants.js';
import type { WeaponId, ConsumableId } from './weapons.js';
import type { GameMap } from './map.js';
import type { ZoneState } from './zone.js';

export interface HelloMsg {
  t: 'hello';
  protocol: number;
  name: string;
  lang?: 'es' | 'en';
}

export interface InputMsg {
  t: 'input';
  seq: number;
  mx: number;
  my: number;
  aim: number;
  fire: boolean;
}

export interface ActionMsg {
  t: 'action';
  kind: 'pickup' | 'reload' | 'use' | 'swap' | 'dropWeapon' | 'throwGrenade';
  slot?: number;
  consumable?: ConsumableId;
}

export interface DropChoiceMsg {
  t: 'drop';
  x: number;
  y: number;
}

export interface PingMsg {
  t: 'ping';
  time: number;
}

export type ClientMsg = HelloMsg | InputMsg | ActionMsg | DropChoiceMsg | PingMsg;

export interface NetPlayer {
  id: number;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  aim: number;
  hp: number;
  shield: number;
  alive: boolean;
  kills: number;
  weaponId: WeaponId | null;
  rarity: Rarity | null;
  firing: boolean;
  reloading: boolean;
  landing: boolean;
}

export interface NetGrenade {
  id: number;
  x: number;
  y: number;
}

export interface NetBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
}

export interface NetItem {
  id: number;
  x: number;
  y: number;
  kind: string;
  weaponId?: WeaponId;
  consumableId?: ConsumableId;
  rarity: Rarity;
  amount?: number;
}

export interface SnapshotMsg {
  t: 'snapshot';
  tick: number;
  timeMs: number;
  phase: 'lobby' | 'drop' | 'play' | 'over';
  zoneTimerMs: number;
  zoneMode: ZoneState['mode'];
  zonePhase: number;
  zone: { cx: number; cy: number; r: number; tcx: number; tcy: number; tr: number };
  alive: number;
  players: NetPlayer[];
  bullets: NetBullet[];
  grenades: NetGrenade[];
  items: NetItem[];
  you: { hp: number; shield: number; ammo: number; mag: number; botiquines: number; escudos: number; grenades: number; activeSlot: number; weapons: Array<{ weaponId: WeaponId; rarity: Rarity; ammoInMag: number } | null>; reloading: boolean } | null;
}

export interface WelcomeMsg {
  t: 'welcome';
  protocol: number;
  yourId: number;
  mapSeed: number;
  map: GameMap;
  mode: 'solo-bots' | 'online';
  tickHz: number;
}

export interface PhaseMsg {
  t: 'phase';
  phase: 'lobby' | 'drop' | 'play' | 'over';
  dropEndsAtMs?: number;
  winnerId?: number | null;
  winnerName?: string;
}

export interface EventMsg {
  t: 'event';
  kind: 'kill' | 'shot' | 'hit' | 'pickup' | 'zone' | 'explosion' | 'airdrop';
  killerId?: number;
  killerName?: string;
  victimId?: number;
  victimName?: number | string;
  weaponId?: WeaponId;
  x?: number;
  y?: number;
  playerId?: number;
  itemName?: string;
  placement?: number;
}

export interface ResultMsg {
  t: 'result';
  placement: number;
  totalPlayers: number;
  kills: number;
  winnerId: number | null;
  winnerName: string;
}

export interface PongMsg {
  t: 'pong';
  time: number;
}

export interface ErrorMsg {
  t: 'error';
  code: string;
  msg: string;
}

export type ServerMsg =
  | WelcomeMsg
  | PhaseMsg
  | SnapshotMsg
  | EventMsg
  | ResultMsg
  | PongMsg
  | ErrorMsg;

export const isProtocolCompatible = (clientProtocol: number): boolean =>
  clientProtocol === PROTOCOL_VERSION;
