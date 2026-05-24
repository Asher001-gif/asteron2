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

loadSprite('crew', crewA);
loadSprite('protector', protA);
loadSprite('traitor', traitorA);

let animTime = 0;

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number
) {
  const human = state.players[0];
  const camX = Math.max(0, Math.min(state.mapWidth - canvasW, human.x - canvasW / 2));
  const camY = Math.max(0, Math.min(state.mapHeight - canvasH, human.y - canvasH / 2));

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.translate(-camX, -camY);

  animTime = performance.now();

  drawMarsSurface(ctx, state.mapWidth, state.mapHeight);
  drawJailRoom(ctx);
  drawTaskStations(ctx, state);
  drawDoors(ctx, state);
  drawVents(ctx, state.vents || []);

  // Draw dead players first
  state.players.filter(p => !p.alive).forEach(p => drawDeadPlayer(ctx, p));
  // Draw alive players
  state.players.filter(p => p.alive).forEach(p => drawPlayer(ctx, p, human));

  ctx.restore();

  // Vision Fog
  drawVisionFog(ctx, human, camX, camY, canvasW, canvasH);

  drawHUD(ctx, state, canvasW, canvasH);
  drawKillFeed(ctx, state, canvasW, canvasH);
}

// ==================== MAIN SOIL - ORANGE MARS ====================
function drawMarsSurface(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base dark soil
  ctx.fillStyle = '#2c1e14';
  ctx.fillRect(0, 0, w, h);

  // Orange Mars gradient
  const grad = ctx.createRadialGradient(w/2, h/2 - 100, 500, w/2, h/2 + 200, Math.max(w, h));
  grad.addColorStop(0, '#e07a4a');   // Bright orange
  grad.addColorStop(0.6, '#c15d32'); // Medium orange-red
  grad.addColorStop(1, '#8b3a1f');   // Deep reddish brown
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1.0;

  // Brown Rocks
  ctx.fillStyle = 'rgba(139, 85, 55, 0.8)';
  for (let i = 0; i < 480; i++) {
    const x = (i * 4567) % w;
    const y = (i * 98765) % h;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Small dark pebbles
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 850; i++) {
    const x = (i * 12347) % w;
    const y = (i * 76543) % h;
    const size = 1.1 + (i % 4);
    ctx.fillRect(x, y, size, size);
  }
}

function drawVents(ctx: CanvasRenderingContext2D, vents: any[]) {
  ctx.strokeStyle = '#5577aa';
  ctx.lineWidth = 9;
  vents.forEach(v => {
    ctx.beginPath();
    ctx.arc(v.x, v.y, 33, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#1a2333';
    ctx.beginPath();
    ctx.arc(v.x, v.y, 21, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawKillFeed(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px monospace';
  const now = Date.now();

  (state.killFeed || []).slice(0, 5).forEach((entry, i) => {
    const alpha = Math.max(0.2, 1 - (now - entry.time) / 7000);
    ctx.fillStyle = `rgba(255, 85, 85, ${alpha})`;
    ctx.fillText(entry.text, w - 25, 100 + i * 28);
  });
}

function drawVisionFog(ctx: CanvasRenderingContext2D, human: Player, camX: number, camY: number, w: number, h: number) {
  const radius = human.role === 'imposter' ? 135 : human.role === 'protector' ? 195 : 255;
  const grad = ctx.createRadialGradient(
    human.x - camX, human.y - camY, radius * 0.5,
    human.x - camX, human.y - camY, radius * 1.4
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(5,4,12,0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Keep your original functions (drawPlayer, drawHUD, drawJailRoom, drawTaskStations, drawDoors, drawDeadPlayer)
export { renderGame };
