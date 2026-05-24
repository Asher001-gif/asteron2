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

  // Players
  state.players.filter(p => !p.alive).forEach(p => drawDeadPlayer(ctx, p));
  state.players.filter(p => p.alive).forEach(p => drawPlayer(ctx, p, human));

  ctx.restore();

  // Fog of War
  drawVisionFog(ctx, human, camX, camY, canvasW, canvasH);

  drawHUD(ctx, state, canvasW, canvasH);
  drawKillFeed(ctx, state, canvasW);
}

/* ==================== ORANGE MARS SOIL + BROWN ROCKS (2.5D Feel) ==================== */
function drawMarsSurface(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base dark layer
  ctx.fillStyle = '#1a120d';
  ctx.fillRect(0, 0, w, h);

  // Rich Orange Mars Soil
  const soilGrad = ctx.createRadialGradient(w/2, h/2 - 180, 400, w/2, h/2 + 220, Math.max(w, h));
  soilGrad.addColorStop(0, '#ff9f4d');
  soilGrad.addColorStop(0.45, '#e36b2c');
  soilGrad.addColorStop(1, '#9c3f1a');
  ctx.fillStyle = soilGrad;
  ctx.globalAlpha = 0.88;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1.0;

  // Brown Rocks (2.5D depth)
  ctx.fillStyle = 'rgba(139, 85, 45, 0.9)';
  for (let i = 0; i < 550; i++) {
    const x = (i * 4567) % w;
    const y = (i * 98765) % h;
    const size = 2.0 + (i % 5);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
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

function drawVents(ctx: CanvasRenderingContext2D, vents: any[]) {
  ctx.strokeStyle = '#6688bb';
  ctx.lineWidth = 10;
  vents.forEach(v => {
    ctx.beginPath();
    ctx.arc(v.x, v.y, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#1a2333';
    ctx.beginPath();
    ctx.arc(v.x, v.y, 22, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawKillFeed(ctx: CanvasRenderingContext2D, state: GameState, w: number) {
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
    human.x - camX, human.y - camY, radius * 1.45
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(5, 4, 12, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Keep your original functions below (drawPlayer, drawHUD, drawJailRoom, drawTaskStations, drawDoors, drawDeadPlayer)
// They should still be in the file.

export { renderGame };
