/**
 * NAVAL CLASH - motor de simulacion (copia ESPEJO del backend).
 *
 * IMPORTANTE: la copia CANONICA vive en
 * manti-twitch-backend/src/utils/shipsEngine.js. Esta copia se usa como
 * modo local cuando el cliente no puede conectar con el servidor (offline,
 * sin token o durante los tests E2E). Ambas deben mantenerse sincronizadas:
 * mismas constantes, mismo orden de operaciones.
 *
 * Espacio de coordenadas: unidades de "anchos de pantalla".
 *   x in [0, 1], y in [0, aspect]  (aspect = alto/ancho del cliente)
 */

export type ShipClassKey =
  | "fragata"
  | "destructor"
  | "acorazado"
  | "submarino";

export type ShipClass = {
  key: ShipClassKey;
  label: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  reload: number;
  turn: number;
  turret: number;
};

export type ShipState = {
  id: string;
  name: string;
  isSub: boolean;
  cls: ShipClassKey;
  label: string;
  x: number;
  y: number;
  heading: number;
  turret: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  reload: number;
  turnRate: number;
  turretRate: number;
  cooldown: number;
  burst: number;
  alive: boolean;
  kills: number;
  damageDealt: number;
  sunkAt: number | null;
  inStorm: boolean;
  phase: number;
  orbitDir: number;
};

export type BulletState = {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  isSub: boolean;
  from: string;
};

export type BattleEvent = {
  type: "shot" | "hit" | "sink" | "splash" | "cmd" | "winner";
  x?: number;
  y?: number;
  angle?: number;
  owner?: string;
  target?: string;
  name?: string;
  by?: string;
  damage?: number;
  isSub?: boolean;
  id?: string | null;
  timeout?: boolean;
  cmd?: string;
};

export type BattleState = {
  t: number;
  aspect: number;
  stormScale: number;
  ships: ShipState[];
  bullets: BulletState[];
  nextBulletId: number;
  winner: string | null;
  ended: boolean;
  events: BattleEvent[];
};

export type Participant = { name: string; isSub?: boolean };

export type ShipSnapshot = {
  id: string;
  name: string;
  isSub: boolean;
  cls: ShipClassKey;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  turret: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  burst: number;
  inStorm: boolean;
  sunkAt: number | null;
};

export type BulletSnapshot = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isSub: boolean;
  ownerId: string;
};

export type BattleSnapshot = {
  t: number;
  aspect: number;
  storm: number;
  ended: boolean;
  winner: string | null;
  ships: ShipSnapshot[];
  bullets: BulletSnapshot[];
};

export const SHIP_CLASSES: Record<ShipClassKey, ShipClass> = {
  fragata: {
    key: "fragata",
    label: "Fragata",
    hp: 260,
    speed: 0.055,
    radius: 0.03,
    damage: 7,
    reload: 1.1,
    turn: 0.9,
    turret: 2.4,
  },
  destructor: {
    key: "destructor",
    label: "Destructor",
    hp: 200,
    speed: 0.075,
    radius: 0.026,
    damage: 6,
    reload: 0.85,
    turn: 1.1,
    turret: 2.8,
  },
  acorazado: {
    key: "acorazado",
    label: "Acorazado",
    hp: 380,
    speed: 0.04,
    radius: 0.038,
    damage: 11,
    reload: 1.5,
    turn: 0.6,
    turret: 1.9,
  },
  submarino: {
    key: "submarino",
    label: "Submarino",
    hp: 230,
    speed: 0.062,
    radius: 0.024,
    damage: 9,
    reload: 1.0,
    turn: 1.0,
    turret: 2.6,
  },
};

export const CLASS_ORDER: ShipClassKey[] = [
  "fragata",
  "destructor",
  "acorazado",
  "submarino",
];

const SUB_HP_MULT = 1.35;
const SUB_DAMAGE_MULT = 1.25;
const SUB_RELOAD_MULT = 0.85;

export const BULLET_SPEED = 0.16;
export const BULLET_LIFE = 5.2;
export const BULLET_RADIUS = 0.006;
// Radio efectivo de impacto: la silueta se dibuja mas pequena que el radio
// logico, sin este factor las balas estallaban antes de tocar el barco.
export const HIT_RADIUS_SCALE = 0.72;
export const FIRE_RANGE = 0.6;
export const ENGAGE_RANGE = 0.42;
export const GRACE_TIME = 3;

export const STORM = {
  calmTime: 18,
  closeTime: 75,
  minScale: 0.34,
  damage: 5,
};

export const MAX_DURATION = 150;
export const SHIELD_AMOUNT = 25;
export const MAX_BURST = 3;
// Tope de balas en pantalla: evita que con mucha municion se acumulen
// cientos de proyectiles y saturen el render (espejo del backend).
export const MAX_BULLETS = 160;

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

const angleDiff = (a: number, b: number) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const turnTowards = (current: number, target: number, maxDelta: number) =>
  current + clamp(angleDiff(target, current), -maxDelta, maxDelta);

export const stormRadii = (state: BattleState) => ({
  cx: 0.5,
  cy: state.aspect / 2,
  rx: 0.5 * state.stormScale,
  ry: (state.aspect / 2) * state.stormScale,
});

export const createBattle = (
  participants: Participant[],
  opts: { aspect?: number } = {},
): BattleState => {
  const aspect = clamp(opts.aspect || 16 / 9, 0.4, 3);
  const list = Array.isArray(participants) ? participants : [];
  const n = Math.max(list.length, 1);
  const ships: ShipState[] = [];

  list.forEach((p, i) => {
    const cls = SHIP_CLASSES[CLASS_ORDER[i % CLASS_ORDER.length]];
    const isSub = !!p.isSub;
    const maxHp = Math.round(cls.hp * (isSub ? SUB_HP_MULT : 1));

    const angle = (i / n) * Math.PI * 2;
    const rx = 0.34;
    const ry = 0.34 * aspect;
    const x = 0.5 + Math.cos(angle) * rx;
    const y = aspect / 2 + Math.sin(angle) * ry;
    const heading = Math.atan2(aspect / 2 - y, 0.5 - x);

    ships.push({
      id: `s${i}`,
      name: String(p.name || `Barco ${i + 1}`),
      isSub,
      cls: cls.key,
      label: cls.label,
      x,
      y,
      heading,
      turret: heading,
      vx: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      speed: cls.speed * (isSub ? 1.05 : 1),
      radius: cls.radius,
      damage: Math.round(cls.damage * (isSub ? SUB_DAMAGE_MULT : 1)),
      reload: cls.reload * (isSub ? SUB_RELOAD_MULT : 1),
      turnRate: cls.turn,
      turretRate: cls.turret,
      cooldown: cls.reload * (0.2 + 0.8 * (i / n)),
      burst: 0,
      alive: true,
      kills: 0,
      damageDealt: 0,
      sunkAt: null,
      inStorm: false,
      phase: (i * 1.7) % (Math.PI * 2),
      orbitDir: i % 2 === 0 ? 1 : -1,
    });
  });

  return {
    t: 0,
    aspect,
    stormScale: 1,
    ships,
    bullets: [],
    nextBulletId: 1,
    winner: null,
    ended: false,
    events: [],
  };
};

const nearestEnemy = (ship: ShipState, alive: ShipState[]) => {
  let best: ShipState | null = null;
  let bestDist = Infinity;
  for (const other of alive) {
    if (other.id === ship.id) continue;
    const d = Math.hypot(other.x - ship.x, other.y - ship.y);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
};

const leadPoint = (ship: ShipState, target: ShipState) => {
  const dist = Math.hypot(target.x - ship.x, target.y - ship.y);
  const tImpact = dist / BULLET_SPEED;
  return {
    x: target.x + target.vx * tImpact,
    y: target.y + target.vy * tImpact,
  };
};

const fire = (
  state: BattleState,
  ship: ShipState,
  angle: number,
  rng: () => number,
) => {
  const spread = (rng() - 0.5) * 0.11;
  const a = angle + spread;
  const muzzle = ship.radius * 1.2;

  // Tope global de balas: si se supera, descarta las mas antiguas.
  if (state.bullets.length >= MAX_BULLETS) {
    state.bullets.splice(0, state.bullets.length - MAX_BULLETS + 1);
  }

  state.bullets.push({
    id: state.nextBulletId++,
    ownerId: ship.id,
    x: ship.x + Math.cos(a) * muzzle,
    y: ship.y + Math.sin(a) * muzzle,
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    life: BULLET_LIFE,
    damage: ship.damage,
    isSub: ship.isSub,
    from: ship.name,
  });

  if (ship.burst > 0) {
    ship.burst -= 1;
    ship.cooldown = 0.2;
  } else {
    ship.cooldown = ship.reload;
  }

  state.events.push({
    type: "shot",
    x: ship.x + Math.cos(a) * muzzle,
    y: ship.y + Math.sin(a) * muzzle,
    angle: a,
    owner: ship.name,
    isSub: ship.isSub,
  });
};

const updateStorm = (state: BattleState) => {
  const p = (state.t - STORM.calmTime) / STORM.closeTime;
  state.stormScale =
    p <= 0 ? 1 : p >= 1 ? STORM.minScale : 1 + (STORM.minScale - 1) * p;
};

export const stepBattle = (
  state: BattleState,
  dt: number,
  rng: () => number = Math.random,
): BattleState => {
  if (!state || state.ended) return state;

  dt = clamp(dt, 0, 0.05);
  state.t += dt;
  updateStorm(state);

  const storm = stormRadii(state);
  const alive = state.ships.filter((s) => s.alive);

  for (const s of alive) {
    const target = nearestEnemy(s, alive);

    let desired = s.heading;
    let aim = s.heading;

    if (target) {
      const dist = Math.hypot(target.x - s.x, target.y - s.y);
      const bearing = Math.atan2(target.y - s.y, target.x - s.x);
      const lead = leadPoint(s, target);
      aim = Math.atan2(lead.y - s.y, lead.x - s.x);

      if (dist > ENGAGE_RANGE * 1.2) {
        desired = aim;
      } else if (dist < ENGAGE_RANGE * 0.8) {
        desired = bearing + Math.PI;
      } else {
        desired = bearing + (Math.PI / 2) * s.orbitDir;
      }
    }

    let sepX = 0;
    let sepY = 0;
    for (const o of alive) {
      if (o.id === s.id) continue;
      const dx = s.x - o.x;
      const dy = s.y - o.y;
      const d = Math.hypot(dx, dy);
      const minD = (s.radius + o.radius) * 2.8;
      if (d > 0.0001 && d < minD) {
        const w = (minD - d) / minD;
        sepX += (dx / d) * w;
        sepY += (dy / d) * w;
      }
    }

    const eDist = Math.hypot(
      (s.x - storm.cx) / storm.rx,
      (s.y - storm.cy) / storm.ry,
    );
    if (eDist > 0.85) {
      desired = Math.atan2(storm.cy - s.y, storm.cx - s.x);
    }

    if (sepX !== 0 || sepY !== 0) {
      desired = Math.atan2(
        Math.sin(desired) + sepY * 0.9,
        Math.cos(desired) + sepX * 0.9,
      );
    }

    desired += Math.sin(state.t * 0.6 + s.phase) * 0.25;

    s.heading = turnTowards(s.heading, desired, s.turnRate * dt);

    const vx = Math.cos(s.heading) * s.speed;
    const vy = Math.sin(s.heading) * s.speed;
    s.vx = vx;
    s.vy = vy;
    s.x += vx * dt;
    s.y += vy * dt;

    const m = s.radius * 0.6;
    if (s.x < m) {
      s.x = m;
      s.heading = Math.PI - s.heading;
    }
    if (s.x > 1 - m) {
      s.x = 1 - m;
      s.heading = Math.PI - s.heading;
    }
    if (s.y < m) {
      s.y = m;
      s.heading = -s.heading;
    }
    if (s.y > state.aspect - m) {
      s.y = state.aspect - m;
      s.heading = -s.heading;
    }

    const e2 = Math.hypot(
      (s.x - storm.cx) / storm.rx,
      (s.y - storm.cy) / storm.ry,
    );
    s.inStorm = e2 > 1;
    if (s.inStorm) s.hp -= STORM.damage * dt;

    s.cooldown -= dt;

    if (target) {
      s.turret = turnTowards(s.turret, aim, s.turretRate * dt);

      const aligned = Math.abs(angleDiff(s.turret, aim)) < 0.2;
      const dist = Math.hypot(target.x - s.x, target.y - s.y);
      const armed = state.t >= GRACE_TIME;
      if (armed && aligned && dist < FIRE_RANGE && s.cooldown <= 0) {
        fire(state, s, aim, rng);
      }
    }
  }

  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }

  const survivors: BulletState[] = [];
  for (const b of state.bullets) {
    if (b.life <= 0) {
      state.events.push({ type: "splash", x: b.x, y: b.y });
      continue;
    }

    let hit: ShipState | null = null;
    for (const s of state.ships) {
      if (!s.alive || s.id === b.ownerId) continue;
      // HIT_RADIUS_SCALE: la silueta se dibuja mas pequena que el radio
      // logico, sin este factor las balas estallaban antes de tocarla.
      if (
        Math.hypot(s.x - b.x, s.y - b.y) <=
        s.radius * HIT_RADIUS_SCALE + BULLET_RADIUS
      ) {
        hit = s;
        break;
      }
    }

    if (hit) {
      hit.hp -= b.damage;
      const owner = state.ships.find((s) => s.id === b.ownerId);
      if (owner) owner.damageDealt += b.damage;
      state.events.push({
        type: "hit",
        x: b.x,
        y: b.y,
        target: hit.name,
        owner: b.from,
        damage: b.damage,
      });
      if (hit.hp <= 0) {
        hit.hp = 0;
        hit.alive = false;
        hit.sunkAt = state.t;
        if (owner) owner.kills += 1;
        state.events.push({
          type: "sink",
          x: hit.x,
          y: hit.y,
          name: hit.name,
          by: b.from,
        });
      }
    } else if (b.x < 0 || b.x > 1 || b.y < 0 || b.y > state.aspect) {
      state.events.push({ type: "splash", x: b.x, y: b.y });
    } else {
      survivors.push(b);
    }
  }
  state.bullets = survivors;

  const aliveNow = state.ships.filter((s) => s.alive);
  if (aliveNow.length <= 1 && state.ships.length > 1) {
    state.ended = true;
    state.winner = aliveNow[0] ? aliveNow[0].id : null;
    state.events.push({ type: "winner", id: state.winner });
  } else if (state.t >= MAX_DURATION) {
    state.ended = true;
    const best = [...state.ships].sort(
      (a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt,
    )[0];
    state.winner = best ? best.id : null;
    state.events.push({ type: "winner", id: state.winner, timeout: true });
  }

  return state;
};

export const findShip = (state: BattleState, query: string) => {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  if (!q) return null;
  let partial: ShipState | null = null;
  for (const s of state.ships) {
    const name = s.name.toLowerCase();
    if (name === q) return s;
    if (!partial && name.includes(q)) partial = s;
  }
  return partial;
};

export const applyCommand = (
  state: BattleState,
  cmd: { type: string; target?: string | null; by?: string },
) => {
  if (!state || state.ended) return null;
  const type = cmd?.type;

  if (type === "ammo") {
    for (const s of state.ships) {
      if (!s.alive) continue;
      s.burst = Math.min(MAX_BURST, s.burst + 1);
      s.cooldown = 0;
    }
    state.events.push({ type: "cmd", cmd: "ammo", by: cmd.by });
    return { ok: true, message: "MUNICIÓN EXTRA PARA TODOS" };
  }

  if (type === "fire") {
    const s = findShip(state, cmd.target || "");
    if (!s || !s.alive) {
      return {
        ok: false,
        message: `No encuentro el barco "${cmd.target}"`,
      };
    }
    const target = nearestEnemy(s, state.ships.filter((x) => x.alive));
    if (!target) return { ok: false, message: "No hay blancos" };
    const aim = Math.atan2(target.y - s.y, target.x - s.x);
    fire(state, s, aim, Math.random);
    s.cooldown = 0.25;
    state.events.push({
      type: "cmd",
      cmd: "fire",
      by: cmd.by,
      target: s.name,
    });
    return { ok: true, message: `${s.name} dispara por orden de ${cmd.by}` };
  }

  if (type === "shield") {
    const s = findShip(state, cmd.target || "");
    if (!s || !s.alive) {
      return {
        ok: false,
        message: `No encuentro el barco "${cmd.target}"`,
      };
    }
    s.hp = Math.min(s.maxHp, s.hp + SHIELD_AMOUNT);
    state.events.push({
      type: "cmd",
      cmd: "shield",
      by: cmd.by,
      target: s.name,
    });
    return { ok: true, message: `${s.name} recibe blindaje` };
  }

  return null;
};

export const snapshot = (state: BattleState): BattleSnapshot => ({
  t: state.t,
  aspect: state.aspect,
  storm: state.stormScale,
  ended: !!state.ended,
  winner: state.winner,
  ships: state.ships.map((s) => ({
    id: s.id,
    name: s.name,
    isSub: s.isSub,
    cls: s.cls,
    label: s.label,
    x: s.x,
    y: s.y,
    vx: s.vx,
    vy: s.vy,
    heading: s.heading,
    turret: s.turret,
    hp: s.hp,
    maxHp: s.maxHp,
    alive: s.alive,
    kills: s.kills,
    burst: s.burst,
    inStorm: s.inStorm,
    sunkAt: s.sunkAt,
  })),
  bullets: state.bullets.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    isSub: b.isSub,
    ownerId: b.ownerId,
  })),
});

export const drainEvents = (state: BattleState): BattleEvent[] => {
  if (!state.events.length) return [];
  const out = state.events.slice();
  state.events.length = 0;
  return out;
};
