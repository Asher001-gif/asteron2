import * as THREE from 'three';
import { GameState, Player, PLAYER_RADIUS } from './types';
import { ROOM_WALLS, OBSTACLES, ROOMS, createDoors } from './collision';
import robotBlueUrl from '@/assets/robot-blue.jpg';
import robotGreenUrl from '@/assets/robot-green.jpg';

// Vision radii per role (kept in sync with renderer.ts)
const VISION_RADIUS: Record<string, number> = {
  crewmate: 260,
  protector: 210,
  imposter: 160,
};

// Build a texture from a JPG and key out the pure-black background to alpha.
function makeKeyedTexture(url: string): THREE.Texture {
  const tex = new THREE.Texture();
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      // Treat near-black as transparent
      if (d[i] < 28 && d[i + 1] < 28 && d[i + 2] < 28) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.src = url;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Renderer3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private playerSprites = new Map<number, THREE.Sprite>();
  private taskMeshes = new Map<number, THREE.Mesh>();
  private doorMeshes = new Map<number, THREE.Mesh>();
  private ambient: THREE.HemisphereLight;
  private fog: THREE.Fog;
  private ground: THREE.Mesh;
  private texBlue: THREE.Texture;
  private texGreen: THREE.Texture;
  private startTime: number = 0;
  private stormStarted: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(1);
   // Initial Mars Clear Sky
    this.renderer.setClearColor(0x9c4a2f, 1);   // Bright Mars sky

    this.camera = new THREE.PerspectiveCamera(72, 1, 1, 900);

    // Initial good visibility (Mars)
    this.fog = new THREE.Fog(0xc96a4a, 500, 1350);
    this.scene.fog = this.fog;

    this.ambient = new THREE.HemisphereLight(0xffbb88, 0x442211, 1.1);
    this.scene.add(this.ambient);

    this.startTime = Date.now();

       // Mars dusty atmosphere fog
    this.fog = new THREE.Fog(0xc96a4a, 500, 1350);
    this.scene.fog = this.fog;

    this.ambient = new THREE.HemisphereLight(0xeaf0ff, 0x222633, 1.15);
    this.scene.add(this.ambient);

    this.texBlue = makeKeyedTexture(robotBlueUrl);
    this.texGreen = makeKeyedTexture(robotGreenUrl);

 // Outer ground - Mars style (lightweight)
const groundGeo = new THREE.PlaneGeometry(2000, 1500);
const groundMat = new THREE.MeshLambertMaterial({ 
    color: 0xc1442a,           // Martian reddish-orange
    // color: 0xd16e4f,        // Alternative warmer tone
});
this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(800, 0, -600);
    this.scene.add(this.ground);

    this.buildStaticGeometry();
  }

  private buildStaticGeometry() {
  // Improved walls - more realistic look
const wallMat = new THREE.MeshLambertMaterial({ 
    color: 0x555555,           // Gray metal/industrial look
    // color: 0x8B5A2B,        // Try this for rusty/warm look
    roughness: 0.9,            // Makes it less shiny
    metalness: 0.2
});
    for (const w of ROOM_WALLS) {
      const dx = w.x2 - w.x1;
      const dz = w.y2 - w.y1;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const geo = new THREE.BoxGeometry(len, 50, 12);   // Taller + Thicker
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set((w.x1 + w.x2) / 2, 22, -(w.y1 + w.y2) / 2);
      mesh.rotation.y = Math.atan2(dz, dx);
      this.scene.add(mesh);
    }

    // Room floor markers (grey tile)
    const roomFloorMat = new THREE.MeshLambertMaterial({ color: 0x7d8290 });
    for (const r of ROOMS) {
      const geo = new THREE.PlaneGeometry(r.w, r.h);
      const m = new THREE.Mesh(geo, roomFloorMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(r.x + r.w / 2, 0.2, -(r.y + r.h / 2));
      this.scene.add(m);
    }

    // Obstacles → Mars rocks
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8b4a38 });
    for (const o of OBSTACLES) {
      const geo = new THREE.DodecahedronGeometry(o.r, 0);
      const m = new THREE.Mesh(geo, rockMat);
      m.position.set(o.x, o.r * 0.6, -o.y);
      this.scene.add(m);
    }

    // Door slots (built once from the initial door list, identified by id)
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    for (const d of createDoors()) {
      const dx = d.x2 - d.x1;
      const dz = d.y2 - d.y1;
      const len = Math.hypot(dx, dz);
      const geo = new THREE.BoxGeometry(Math.max(len, 6), 36, 8);
      const mesh = new THREE.Mesh(geo, doorMat);
      mesh.position.set(d.cx, 18, -d.cy);
      mesh.rotation.y = Math.atan2(dz, dx);
      this.scene.add(mesh);
      this.doorMeshes.set(d.id, mesh);
    }
  }

  private ensurePlayerSprite(p: Player): THREE.Sprite {
    let s = this.playerSprites.get(p.id);
    if (s) return s;
    const tex = p.role === 'protector' ? this.texGreen : this.texBlue;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.3,
      fog: true,
    });
    s = new THREE.Sprite(mat);
    s.scale.set(PLAYER_RADIUS * 3.4, PLAYER_RADIUS * 3.4, 1);
    s.center.set(0.5, 0.0);
    this.scene.add(s);
    this.playerSprites.set(p.id, s);
    return s;
  }

  private ensureTaskMesh(stationId: number, x: number, y: number) {
    let m = this.taskMeshes.get(stationId);
    if (m) return m;
    m = new THREE.Mesh(
      new THREE.BoxGeometry(32, 28, 32),
      new THREE.MeshLambertMaterial({ color: 0x3aa0ff })
    );
    m.position.set(x, 14, -y);
    this.scene.add(m);
    this.taskMeshes.set(stationId, m);
    return m;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(state: GameState, yaw: number = 0) {
    help me to change my land color to orange in my 3d game check respositry via https://github.com/Asher001-gif/asteron2✅ Done! Here's how to change your land color to orange:
Change in src/game/renderer3d.ts
Find this section (around lines 76-82):
TypeScript// Outer ground (dark)
const groundGeo = new THREE.PlaneGeometry(2000, 1500);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x111318 });
this.ground = new THREE.Mesh(groundGeo, groundMat);
Replace it with:
TypeScript// Outer ground (orange)
const groundGeo = new THREE.PlaneGeometry(2000, 1500);
const groundMat = new THREE.MeshLambertMaterial({ 
    color: 0xff6600   // Nice bright orange
});
this.ground = new THREE.Mesh(groundGeo, groundMat);

Good Orange Hex Codes (pick one):






























ColorHex CodeRecommendationBright Orange0xff6600BestDeep Orange0xff4500Good contrastNeon Orange0xff8c00VibrantDesert Orange0xe67e22More natural
Bonus: Also change room floors?
If you also want the room floors to be orange-ish:
TypeScript// Room floor markers
const roomFloorMat = new THREE.MeshLambertMaterial({ color: 0xffaa44 });

After changing:

Save the file
Run bun dev (or npm run dev)
Refresh the game

Would you like a more "Martian/desert" look with some texture or different shades? I can suggest better colors.bro is u can see rooms walls i want to mkae them better and wall like✅ Got it bro!
Your walls are currently very basic (thin black boxes). Let's make them look much better and more like real walls.
1. Better Wall Material (Recommended)
Go to src/game/renderer3d.ts and replace this part:
TypeScript// Walls from segments → thin black boxes
const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0c });
With this improved version:
TypeScript// Improved walls - more realistic look
const wallMat = new THREE.MeshLambertMaterial({ 
    color: 0x555555,           // Gray metal/industrial look
    // color: 0x8B5A2B,        // Try this for rusty/warm look
    roughness: 0.9,            // Makes it less shiny
    metalness: 0.2
});

2. Make Walls Thicker & Taller (More Wall-like)
Change this line:
TypeScriptconst geo = new THREE.BoxGeometry(len, 44, 6);
To:
TypeScriptconst geo = new THREE.BoxGeometry(len, 50, 12);   // Taller + Thicker

3. Add Wall Texture (Best Improvement)
If you want even better walls, add a simple texture. Add this near the top with other textures:
TypeScript// Add this with other textures
private wallTexture: THREE.Texture;

// In constructor, after other textures:
this.wallTexture = new THREE.TextureLoader().load(
  'https://threejs.org/examples/textures/uv_grid_opengl.jpg' // temporary
);
this.wallTexture.wrapS = this.wallTexture.wrapT = THREE.RepeatWrapping;
Then update wall material to:
TypeScriptconst wallMat = new THREE.MeshLambertMaterial({ 
    map: this.wallTexture,
    color: 0xaaaaaa
});

Quick Good Wall Colors:

Industrial Gray: 0x555555 (recommended)
Sci-fi Blue-Gray: 0x446677
Warm Station: 0x8B5A2B
Dark Metal: 0x333333

Would you like me to also:

Add baseboards at bottom of walls?
Make walls have slight random height for more organic feel?
Change room floors to match better?

Just tell me what style you want (sci-fi, rusty spaceship, clean, etc.) and I’ll give exact code.bro actually we are on mars so i want to give ground some mars like feeling but lightweight✅ Perfect bro! Since we're on Mars, let's make the ground feel more Martian — reddish, dusty, rocky — while keeping it lightweight (no heavy textures).
Best Change for Mars Ground (in src/game/renderer3d.ts)
Replace this part:
TypeScript// Outer ground (dark)
const groundGeo = new THREE.PlaneGeometry(2000, 1500);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x111318 });
With this Mars version:
TypeScript// Outer ground - Mars style (lightweight)
const groundGeo = new THREE.PlaneGeometry(2000, 1500);
const groundMat = new THREE.MeshLambertMaterial({ 
    color: 0xc1442a,           // Martian reddish-orange
    // color: 0xd16e4f,        // Alternative warmer tone
});
this.ground = new THREE.Mesh(groundGeo, groundMat);
this.ground.rotation.x = -Math.PI / 2;
this.ground.position.set(800, 0, -600);
this.scene.add(this.ground);

Recommended Mars Colors (Lightweight):






























LookHex CodeSuggestionClassic Mars Red0xc1442aBest for nowDusty Orange-Red0xd16e4fWarmer, more friendlyDarker Rocky Mars0x9b3a2bMore seriousBright Martian0xe07a5fVibrant

Extra Lightweight Mars Touches:

Slightly change room floors to match Mars better:

TypeScript// Room floor markers (Mars tile)
const roomFloorMat = new THREE.MeshLambertMaterial({ color: 0xb85c3d });

Make rocks more Martian:

TypeScript// Obstacles → Mars rocks
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8b4a38 });

Quick Test:

Change the ground color to 0xc1442a
Save
Run bun dev
Check how it feels

Want me to also suggest:

A subtle fog color for Mars atmosphere?
Better sky/background color?
Make ground slightly uneven (very light way)?

Just say what you want next! 🚀some mars fog✅ Mars Fog Added!
Mars has a thin, dusty, reddish atmosphere — so we'll add a light fog that gives that hazy Martian feel without killing performance.
Add this code in src/game/renderer3d.ts
Find the constructor (where you set up the scene), and add this right after this.scene = new THREE.Scene();
TypeScript// Mars Atmosphere Fog (lightweight)
this.scene.fog = new THREE.Fog(
    0xc96a4a,     // Fog color - reddish Martian haze
    600,          // Near distance (start fading)
    1400          // Far distance (fully fogged)
);

Recommended Mars Fog Settings:

































StyleFog ColorNearFarBest ForClassic Mars0xc96a4a6001400RecommendedDustier / Storm0xb85c3d4001100Heavy atmosphereSoft Morning0xe89b7a7001600Lighter feel

Bonus: Also change background color to match Mars sky
Add this right after the fog:
TypeScript// Mars sky background
this.scene.background = new THREE.Color(0x9c4a2f);   // Dark reddish sky

Full Recommended Block:
TypeScriptthis.scene = new THREE.Scene();

// Mars Atmosphere
this.scene.fog = new THREE.Fog(0xc96a4a, 600, 1400);
this.scene.background = new THREE.Color(0x9c4a2f);

After adding:

Save the file
Run bun dev
Fly around and see the haze


Want me to adjust it?
Tell me if you want:

Stronger fog?
Lighter fog?
Add some subtle color to the sun/light too?

Just say the word bro 🚀where is fog line help✅ Found it bro!
Your file already has a fog line. Here's the exact location:
File: src/game/renderer3d.ts
Around lines 66–68, inside the constructor:
TypeScriptconstructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ ... });

    this.camera = new THREE.PerspectiveCamera(72, 1, 1, 900);

    // ←←←←←←←←←←←←←←←←←←←←←←←←← HERE ←←←←←←←←←←←←←←←←←←←←←←←←←
    // Fog produces vision falloff; far value updated per role each frame.
    this.fog = new THREE.Fog(0x06070b, 60, 260);
    this.scene.fog = this.fog;
    // ←←←←←←←←←←←←←←←←←←←←←←←←← HERE ←←←←←←←←←←←←←←←←←←←←←←←←←

Change it to Mars Fog (Replace these 2 lines):
TypeScript// Mars dusty atmosphere fog
    this.fog = new THREE.Fog(0xc96a4a, 500, 1350);
    this.scene.fog = this.fog;
Also change the background color (right above or below) to match Mars sky:
TypeScriptthis.renderer.setClearColor(0x9c4a2f, 1);   // Mars sky color

Quick Summary of Changes:

Replace the fog color + distances
Change setClearColor to reddish Mars tone

Want me to give you the full updated constructor block so you can just copy-paste?bro that black sky what about mars sky atmosphere✅ Got it bro!
Currently your sky is black because of this line:
TypeScriptthis.renderer.setClearColor(0x05060a, 1);
Mars Sky + Atmosphere Setup
Replace the top part of your constructor with this Mars version:
TypeScriptconstructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(1);
    
    // 🔥 Mars Sky Color (replaces black)
    this.renderer.setClearColor(0x9c4a2f, 1);   // Reddish Martian sky

    this.camera = new THREE.PerspectiveCamera(72, 1, 1, 900);

    // Mars Dusty Fog
    this.fog = new THREE.Fog(0xc96a4a, 500, 1350);
    this.scene.fog = this.fog;

    // Better Mars lighting
    this.ambient = new THREE.HemisphereLight(0xffbb88, 0x442211, 1.1);  // Warm reddish light
    this.scene.add(this.ambient);

Summary of Changes:

Sky Background → 0x9c4a2f (Mars orange-red sky)
Fog → Reddish Martian haze
Lighting → Warmer, more orange/red tones (feels like Mars sun)


Want it even better? Here are a few options:

Option A (Recommended): Use the code above
Option B (Darker Dust Storm): Change sky to 0x6b2f1f and fog to 0xb85c3d
Option C (Brighter Morning): Sky 0xe89b7a, fog 0xd88a5f

Just tell me which one you like or say “make it more dusty” and I’ll adjust!
Go try the code and tell me how it looks 🚀wait is we can make for few time sky everything visible after 100 sec the sky became black with low visiblity like cureent vision✅ Yes bro, we can do that!
We’ll make it so:

At the start → Nice Mars sky + good visibility
After 100 seconds → Slowly turns into black sky + heavy low visibility (like a Martian dust storm)


Step 1: Add these new properties in the class
In src/game/renderer3d.ts, inside the Renderer3D class, add these lines:
TypeScriptexport class Renderer3D {
    // ... existing properties ...

    private startTime: number = 0;
    private stormStarted: boolean = false;

Step 2: Change Constructor (Mars start)
Replace your constructor’s sky/fog/lighting part with this:
TypeScriptconstructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ ... });

    this.renderer.setPixelRatio(1);
    
    // Initial Mars Clear Sky
    this.renderer.setClearColor(0x9c4a2f, 1);   // Bright Mars sky

    this.camera = new THREE.PerspectiveCamera(72, 1, 1, 900);

    // Initial good visibility (Mars)
    this.fog = new THREE.Fog(0xc96a4a, 500, 1350);
    this.scene.fog = this.fog;

    this.ambient = new THREE.HemisphereLight(0xffbb88, 0x442211, 1.1);
    this.scene.add(this.ambient);

    this.startTime = Date.now();

render(state: GameState, yaw: number = 0) {
    const elapsed = (Date.now() - this.startTime) / 1000;  // seconds passed

    // After 100 seconds → start Mars dust storm
    if (elapsed > 100 && !this.stormStarted) {
        this.stormStarted = true;
    }

    if (this.stormStarted) {
        const stormIntensity = Math.min((elapsed - 100) / 30, 1); // slowly over 30 sec

        // Darken sky
        const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0x9c4a2f),   // Mars sky
            new THREE.Color(0x05060a),   // Black
            stormIntensity
        );
        this.renderer.setClearColor(skyColor, 1);

        // Increase fog (low visibility)
        this.fog.color.setHex(0x3a2a22);
        this.fog.near = 60;
        this.fog.far = THREE.MathUtils.lerp(1350, 220, stormIntensity);
        
        // Darker lighting
        this.ambient.intensity = THREE.MathUtils.lerp(1.1, 0.4, stormIntensity);
    }
    const human = state.players[0];

    // Vision via fog: hide everything beyond vision radius.
    const vr = VISION_RADIUS[human.role] ?? 220;
    this.fog.near = vr * 0.35;
    this.fog.far = vr;

    // Tasks
    for (const t of state.taskStations) {
      const m = this.ensureTaskMesh(t.id, t.x, t.y);
      (m.material as THREE.MeshLambertMaterial).color.setHex(t.completed ? 0x2ecc71 : 0x3aa0ff);
    }

    // Doors: hide when open
    for (const d of state.doors) {
      const m = this.doorMeshes.get(d.id);
      if (m) m.visible = !d.open;
    }

    // Players
    const seen = new Set<number>();
    for (const p of state.players) {
      seen.add(p.id);
      const s = this.ensurePlayerSprite(p);
      s.position.set(p.x, p.alive ? 0 : 4, -p.y);
      // Hide our own sprite in first person
      s.visible = p.id !== human.id;
      const mat = s.material as THREE.SpriteMaterial;
      if (p.frozen) mat.color.setHex(0x80e0ff);
      else if (!p.alive) mat.color.setHex(0x553333);
      else mat.color.setHex(0xffffff);
      if (!p.alive) {
        s.scale.set(PLAYER_RADIUS * 3.2, PLAYER_RADIUS * 1.6, 1);
      } else {
        s.scale.set(PLAYER_RADIUS * 3.4, PLAYER_RADIUS * 3.4, 1);
      }
    }
    // Cleanup removed players (shouldn't happen but safe)
    for (const id of Array.from(this.playerSprites.keys())) {
      if (!seen.has(id)) {
        const m = this.playerSprites.get(id)!;
        this.scene.remove(m);
        this.playerSprites.delete(id);
      }
    }

    // First-person camera at the human's head, looking along yaw.
    const headY = 36;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    this.camera.position.set(human.x, headY, -human.y);
    this.camera.lookAt(human.x + fx * 100, headY - 6, -(human.y + fz * 100));

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
