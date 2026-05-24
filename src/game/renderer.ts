// src/game/renderer.ts
import { GameState, Player } from './types';
import { ROOM_WALLS, ROOMS } from './collision';

import crewA from '@/assets/char-crew-a.png';
import crewB from '@/assets/char-crew-b.png';
import protA from '@/assets/char-protector-a.png';
import protB from '@/assets/char-protector-b.png';
import traitorA from '@/assets/char-traitor-a.png';
import traitorB from '@/assets/char-traitor-b.png';

const SPRITES: Record<string, HTMLImageElement> = {};

function loadSprite(key: string, src: string) {
  const img = new Image();
  img.src = src;
  SPRITES[key] = img;
}

loadSprite('crew_a', crewA);
loadSprite('crew_b', crewB);
loadSprite('protector_a', protA);
loadSprite('protector_b', protB);
loadSprite('traitor_a', traitorA);
loadSprite('traitor_b', traitorB);

let animTime = 0;

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  const human = state.players[0];
  const camX = Math.max(0, Math.min(state.mapWidth - canvasW, human.x - canvasW / 2));
  const camY = Math.max(0, Math.min(state.mapHeight - canvasH, human.y - canvasH / 2));

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.translate(-camX, -camY);

  animTime = performance.now();

  // ==================== MAIN DRAWING ====================
  drawMarsSurface(ctx, state.mapWidth, state.mapHeight);   // ← Orange Soil
  drawJailRoom(ctx);
  drawTaskStations(ctx, state);
  drawDoors(ctx, state);

  // Players
  state.players.filter(p => !p.alive).forEach(p => drawDeadPlayer(ctx, p));
  state.players.filter(p => p.alive).forEach(p => drawPlayer(ctx, p, human));

  ctx.restore();

  // Fog of War
  drawVisionFog(ctx, human, camX, camY, canvasW, canvasH);

  drawHUD(ctx, state, canvasW, canvasH);
}

/* ==================== ORANGE SOIL + BROWN ROCKS ==================== */
function drawMarsSurface(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1a120d';
  ctx.fillRect(0, 0, w, h);

  // Orange Mars Soil
  const grad = ctx.createRadialGradient(w/2, h/2 - 150, 500, w/2, h/2 + 250, Math.max(w, h));
  grad.addColorStop(0, '#ff9f4d');
  grad.addColorStop(0.5, '#e36b2c');
  grad.addColorStop(1, '#9c3f1a');
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1.0;

  // Brown Rocks
  ctx.fillStyle = 'rgba(139, 85, 45, 0.9)';
  for (let i = 0; i < 550; i++) {
    const x = (i * 4567) % w;
    const y = (i * 98765) % h;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Small pebbles
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 950; i++) {
    const x = (i * 12347) % w;
    const y = (i * 76543) % h;
    ctx.fillRect(x, y, 1.4 + (i % 3), 1.4 + (i % 3));
  }
}

// ==================== KEEP YOUR ORIGINAL FUNCTIONS BELOW ====================
// Paste all your old functions here (drawPlayer, drawHUD, drawJailRoom, drawTaskStations, drawDoors, drawDeadPlayer, etc.)

// Example placeholder (add your original ones):
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, human: Player) {
  // Your original player drawing code here
  ctx.fillStyle = p.role === 'imposter' ? '#e03030' : p.role === 'protector' ? '#3dba6f' : '#4a90d9';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  // Your HUD code
}

function drawVisionFog(ctx: CanvasRenderingContext2D, human: Player, camX: number, camY: number, w: number, h: number) {
  const radius = human.role === 'imposter' ? 135 : human.role === 'protector' ? 195 : 255;
  const grad = ctx.createRadialGradient(human.x - camX, human.y - camY, radius * 0.5, human.x - camX, human.y - camY, radius * 1.4);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.93)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export { renderGame };
