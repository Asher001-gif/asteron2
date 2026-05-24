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

  drawMarsSurface(ctx, state.mapWidth, state.mapHeight);
  drawJailRoom(ctx);
  drawTaskStations(ctx, state);
  drawDoors(ctx, state);

  state.players.filter(p => !p.alive).forEach(p => drawDeadPlayer(ctx, p));
  state.players.filter(p => p.alive).forEach(p => drawPlayer(ctx, p, human));

  ctx.restore();

  // Fog of War
  const visionR = human.role === 'imposter' ? 140 : human.role === 'protector' ? 190 : 250;
  const fogGrad = ctx.createRadialGradient(
    human.x - camX, human.y - camY, visionR * 0.6,
    human.x - camX, human.y - camY, visionR * 1.1
  );
  fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
  fogGrad.addColorStop(1, 'rgba(0,0,0,0.93)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawHUD(ctx, state, canvasW, canvasH);
}

/* ==================== ORANGE MARS SOIL + BROWN ROCKS ==================== */
function drawMarsSurface(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base
  ctx.fillStyle = '#1c120a';
  ctx.fillRect(0, 0, w, h);

  // **ORANGE MARS SOIL**
  const grad = ctx.createRadialGradient(w/2, h/2 - 150, 500, w/2, h/2 + 250, Math.max(w,h));
  grad.addColorStop(0, '#ff9f4d');     // Bright orange
  grad.addColorStop(0.5, '#e36b2c');   // Strong orange-red
  grad.addColorStop(1, '#9c3f1a');     // Deep red-brown
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1.0;

  // **BROWN ROCKS**
  ctx.fillStyle = 'rgba(139, 85, 45, 0.9)';
  for (let i = 0; i < 550; i++) {
    const x = (i * 4567) % w;
    const y = (i * 98765) % h;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Small pebbles
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 950; i++) {
    const x = (i * 12347) % w;
    const y = (i * 76543) % h;
    ctx.fillRect(x, y, 1.4 + (i % 3), 1.4 + (i % 3));
  }

  // Rooms
  for (const room of ROOMS) {
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(room.x, room.y, room.w, room.h);
  }
}

// Keep the rest of your original functions (drawPlayer, drawHUD, drawJailRoom, etc.)
// They should remain below this.

export { renderGame };
