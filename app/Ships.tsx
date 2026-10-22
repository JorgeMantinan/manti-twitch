import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";
import { io, Socket } from "socket.io-client";

import { getSessionId } from "../utils/session";
import { API_CONFIG } from "../constants/api";
import { apiFetch } from "../services/auth";
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Ellipse,
} from "react-native-svg";
import OceanScene from "../components/ships/OceanScene";
import ShipSprite, { TurretSprite } from "../components/ships/ShipSprite";
import {
  createBattle,
  stepBattle,
  snapshot,
  drainEvents,
  applyCommand,
  SHIP_CLASSES,
  type BattleSnapshot,
  type BattleEvent,
  type ShipSnapshot,
} from "../utils/ships/engine";

const STORAGE_KEY = "participantes_barcos";
const SOCKET_URL = "https://manti-twitch-backend.onrender.com";
const LOCAL_TICK_MS = 1000 / 30;
const SNAPSHOT_LERP = 14;
// Factor global de tamano de barcos en px (independiente del viewport).
// Ajusta aqui el tamano visual sin tocar el motor.
const SCALE_MULT = 1000;

const CLASS_EMOJI: Record<string, string> = {
  fragata: "⛴",
  destructor: "🛥",
  acorazado: "🚢",
  submarino: "🚤",
};

type Role = "viewer" | "mod" | "streamer";
type Mode = "server" | "local";

type Participant = { name: string; isSub?: boolean };

type ShipAnim = {
  px: number;
  py: number;
  pHeading: number;
  pTurret: number;
  ready: boolean;
};

type Fx = {
  id: number;
  kind: "hit" | "sink" | "splash";
  x: number;
  y: number;
  size: number;
};

type FeedItem = { id: number; text: string; tone: "kill" | "cmd" | "info" };

const OceanSceneMemo = React.memo(OceanScene);

function ShipView({ ship, anim }: { ship: ShipSnapshot; anim: ShipAnim }) {
  const cls = SHIP_CLASSES[ship.cls];
  const radiusPx = cls.radius * SCALE_MULT;
  const length = radiusPx * 2.8;
  const width = radiusPx * 1.9;
  const turretSize = radiusPx * 1.5;

  const hpRatio = ship.maxHp > 0 ? Math.max(0, ship.hp) / ship.maxHp : 0;
  const sunk = ship.alive ? 0 : 1;
  const headingDeg = (anim.pHeading * 180) / Math.PI;
  const turretDeg = ((anim.pTurret - anim.pHeading) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      testID={`ship-${ship.id}`}
      style={[
        styles.shipWrap,
        {
          width: length,
          height: width,
          left: anim.px - length / 2,
          top: anim.py - width / 2,
        },
      ]}
    >
      {/* Sprite + torreta: rotan con el rumbo */}
      <View
        pointerEvents="none"
        style={{
          width: length,
          height: width,
          transform: [{ rotate: `${headingDeg}deg` }],
        }}
      >
        {/* La silueta solo se dibuja si esta vivo; al hundirse solo queda
            la torreta (evita la "imagen rara" del casco hundido). */}
        {ship.alive && (
          <ShipSprite
            cls={ship.cls}
            isSub={ship.isSub}
            length={length}
            width={width}
            hpRatio={hpRatio}
            sunk={sunk}
          />
        )}

        <View
          pointerEvents="none"
          style={[
            styles.turretWrap,
            {
              left: length * 0.42,
              top: width * 0.5,
              width: turretSize,
              height: turretSize,
              marginLeft: -turretSize / 2,
              marginTop: -turretSize / 2,
              transform: [{ rotate: `${turretDeg}deg` }],
            },
          ]}
        >
          <TurretSprite cls={ship.cls} isSub={ship.isSub} size={turretSize} />
        </View>
      </View>

      {/* Nombre: siempre horizontal (fuera de la rotacion) */}
      <Text
        pointerEvents="none"
        style={[
          styles.shipLabel,
          { top: width + 2 },
          ship.isSub && styles.shipLabelSub,
        ]}
        numberOfLines={1}
      >
        {ship.name}
      </Text>
    </View>
  );
}

const ShipViewMemo = React.memo(ShipView, () => false);

export default function Ships() {
  const params = useLocalSearchParams();
  const role: Role = (params.role as Role) || "viewer";
  const turbo = Math.max(
    1,
    Math.min(20, parseInt(String(params.turbo || "1"), 10) || 1),
  );
  const { width, height } = useWindowDimensions();

  const socketRef = useRef<Socket | null>(null);
  const streamerRef = useRef("default");

  const [gameState, setGameState] = useState<"setup" | "playing">("setup");
  const [mode, setMode] = useState<Mode>("local");
  const [connected, setConnected] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [inputName, setInputName] = useState("");
  const [isSubInput, setIsSubInput] = useState(false);

  const [streamer, setStreamer] = useState("");
  const [raffleWord, setRaffleWord] = useState("!sorteo");
  const [raffleRunning, setRaffleRunning] = useState(false);

  const [scene, setScene] = useState<BattleSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [winner, setWinner] = useState<ShipSnapshot | null>(null);
  const [finalRank, setFinalRank] = useState<ShipSnapshot[]>([]);
  const [battleOver, setBattleOver] = useState(false);
  const [cmdTarget, setCmdTarget] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const stateRef = useRef<BattleSnapshot | null>(null);
  const recvAtRef = useRef(0);
  const battleOverRef = useRef(false);
  const streamerInputRef = useRef("");
  const animsRef = useRef<Map<string, ShipAnim>>(new Map());
  const bulletAnimsRef = useRef<Map<number, ShipAnim>>(new Map());
  const localBattleRef = useRef<ReturnType<typeof createBattle> | null>(null);
  const applySnapshotRef = useRef<
    (snap: BattleSnapshot, events: BattleEvent[]) => void
  >(() => {});
  const fxIdRef = useRef(1);
  const feedIdRef = useRef(1);
  const lastRenderRef = useRef(0);

  const aspect = height / width;

  /* ------------------------------------------------------------------ *
   * TOKEN + STORAGE
   * ------------------------------------------------------------------ */

  const getToken = async () => {
    if (Platform.OS === "web") return localStorage.getItem("userToken");
    return await SecureStore.getItemAsync("userToken");
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        let savedData = null;
        if (Platform.OS === "web") savedData = localStorage.getItem(STORAGE_KEY);
        else savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed)) setParticipants(parsed);
        }
      } catch {}
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      const data = JSON.stringify(participants);
      if (Platform.OS === "web") localStorage.setItem(STORAGE_KEY, data);
      else await AsyncStorage.setItem(STORAGE_KEY, data);
    };
    saveData();
  }, [participants]);

  /* ------------------------------------------------------------------ *
   * FEED + EFECTOS
   * ------------------------------------------------------------------ */

  const pushFeed = useCallback(
    (text: string, tone: "kill" | "cmd" | "info") => {
      setFeed((prev) =>
        [{ id: feedIdRef.current++, text, tone }, ...prev].slice(0, 4),
      );
    },
    [],
  );

  const triggerShake = useCallback(() => {
    // El screen-shake se omitio: react-native-web descarta los Animated
    // en este setup (Expo + React Compiler), igual que los barcos.
  }, []);

  const addFx = useCallback(
    (kind: Fx["kind"], x: number, y: number, size: number) => {
      setFx((prev) => [...prev, { id: fxIdRef.current++, kind, x, y, size }]);
      const id = fxIdRef.current - 1;
      setTimeout(() => {
        setFx((prev) => prev.filter((f) => f.id !== id));
      }, 700);
    },
    [],
  );

  /* ------------------------------------------------------------------ *
   * SOCKET
   * ------------------------------------------------------------------ */

  useEffect(() => {
    streamerInputRef.current = streamer;
  }, [streamer]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: false,
      timeout: 5000,
      auth: (cb) => getToken().then((token) => cb(token ? { token } : {})),
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      const activeStreamer =
        streamerInputRef.current.trim() || getSessionId();
      streamerRef.current = activeStreamer;
      socket.emit("joinRoom", { game: "ships", streamer: activeStreamer });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("newParticipant", (data: any) => {
      setParticipants((prev) => {
        const exists = prev.some(
          (p) => p.name.toLowerCase() === data.participant.username.toLowerCase(),
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            name: data.participant.username,
            isSub: !!data.participant.isSub,
          },
        ];
      });
    });

    socket.on("ships:state", (payload: any) => {
      if (!payload?.snapshot) return;
      applySnapshotRef.current(payload.snapshot, payload.events || []);
    });

    socket.on("ships:chatcmd", (payload: any) => {
      if (!payload?.message) return;
      pushFeed(`💬 ${payload.message}`, "cmd");
    });

    return () => {
      socket.disconnect();
    };
  }, [pushFeed]);

  /* ------------------------------------------------------------------ *
   * SNAPSHOT -> ESCENA
   * ------------------------------------------------------------------ */

  const applySnapshot = useCallback(
    (snap: BattleSnapshot, events: BattleEvent[]) => {
      stateRef.current = snap;
      recvAtRef.current = Date.now();
      setScene(snap);

      events.forEach((ev) => {
        if (ev.type === "hit") {
          addFx("hit", ev.x || 0, ev.y || 0, 1);
          triggerShake();
        } else if (ev.type === "sink") {
          addFx("sink", ev.x || 0, ev.y || 0, 1.6);
          triggerShake();
          pushFeed(`💥 ${ev.by} hundió a ${ev.name}`, "kill");
        } else if (ev.type === "splash") {
          addFx("splash", ev.x || 0, ev.y || 0, 0.7);
        } else if (ev.type === "cmd") {
          pushFeed(`⚓ ${ev.by} activó un comando`, "cmd");
        }
      });

      if (snap.ended && !battleOverRef.current) {
        battleOverRef.current = true;
        const champ = snap.ships.find((s) => s.id === snap.winner) || null;
        setWinner(champ);
        setFinalRank(
          [...snap.ships]
            .sort((a, b) => b.kills - a.kills || b.hp - a.hp)
            .slice(0, 5),
        );
        setBattleOver(true);
      }
    },
    [addFx, pushFeed, triggerShake],
  );

  useEffect(() => {
    applySnapshotRef.current = applySnapshot;
  }, [applySnapshot]);

  /* ------------------------------------------------------------------ *
   * LOOP DE RENDER (interpolacion + efectos)
   * ------------------------------------------------------------------ */

  const mapping = useMemo(() => {
    const a = scene?.aspect || aspect;
    const scale = Math.min(width, height / a);
    return {
      scale,
      offsetX: (width - scale) / 2,
      offsetY: (height - scale * a) / 2,
      aspect: a,
    };
  }, [scene?.aspect, aspect, width, height]);

  useEffect(() => {
    if (gameState !== "playing") return;

    let raf = 0;
    let lastFrame = Date.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const now = Date.now();
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      const snap = stateRef.current;
      if (!snap) return;

      const elapsed = (now - recvAtRef.current) / 1000;
      const { scale, offsetX, offsetY } = mapping;

      snap.ships.forEach((ship) => {
        let anim = animsRef.current.get(ship.id);
        if (!anim) {
          anim = { px: 0, py: 0, pHeading: 0, pTurret: 0, ready: false };
          animsRef.current.set(ship.id, anim);
        }

        const targetX = ship.x * scale + offsetX + ship.vx * elapsed * scale;
        const targetY = ship.y * scale + offsetY + ship.vy * elapsed * scale;

        if (!anim.ready) {
          anim.px = targetX;
          anim.py = targetY;
          anim.pHeading = ship.heading;
          anim.pTurret = ship.turret;
          anim.ready = true;
        } else {
          const k = Math.min(1, dt * SNAPSHOT_LERP);
          anim.px += (targetX - anim.px) * k;
          anim.py += (targetY - anim.py) * k;
          anim.pHeading += (ship.heading - anim.pHeading) * k;
          anim.pTurret += (ship.turret - anim.pTurret) * k;
        }
      });

      const aliveIds = new Set(snap.ships.map((s) => s.id));
      animsRef.current.forEach((_, id) => {
        if (!aliveIds.has(id)) animsRef.current.delete(id);
      });

      snap.bullets.forEach((b) => {
        let anim = bulletAnimsRef.current.get(b.id);
        if (!anim) {
          anim = { px: 0, py: 0, pHeading: 0, pTurret: 0, ready: false };
          bulletAnimsRef.current.set(b.id, anim);
        }
        const tx = b.x * scale + offsetX + b.vx * elapsed * scale;
        const ty = b.y * scale + offsetY + b.vy * elapsed * scale;
        if (!anim.ready) {
          anim.px = tx;
          anim.py = ty;
          anim.ready = true;
        } else {
          const k = Math.min(1, dt * SNAPSHOT_LERP);
          anim.px += (tx - anim.px) * k;
          anim.py += (ty - anim.py) * k;
        }
      });

      const bulletIds = new Set(snap.bullets.map((b) => b.id));
      bulletAnimsRef.current.forEach((_, id) => {
        if (!bulletIds.has(id)) bulletAnimsRef.current.delete(id);
      });

      // Re-render a ~30fps (no en cada rAF) para reducir reconciliacion.
      if (now - lastRenderRef.current >= 33) {
        lastRenderRef.current = now;
        setTick((t) => (t + 1) % 1000000);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gameState, mapping]);

  /* ------------------------------------------------------------------ *
   * MODO LOCAL (sin servidor)
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (mode !== "local" || gameState !== "playing") return;

    const id = setInterval(() => {
      // Leer el ref en cada tick: al reiniciar, localBattleRef cambia y el
      // efecto no se re-ejecuta (los deps no cambian). Si capturaramos el
      // battle viejo aqui, seguiriamos emitiendo la partida acabada y la
      // pantalla de victoria/leaderboard no se iria.
      const battle = localBattleRef.current;
      if (!battle) return;

      for (let i = 0; i < turbo; i++) {
        stepBattle(battle, 1 / 30);
      }
      const events = drainEvents(battle);

      applySnapshot(snapshot(battle), events);
    }, LOCAL_TICK_MS);

    return () => clearInterval(id);
  }, [mode, gameState, applySnapshot, turbo]);

  /* ------------------------------------------------------------------ *
   * PARTICIPANTES
   * ------------------------------------------------------------------ */

  const addParticipant = () => {
    if (!inputName.trim()) return;
    setParticipants((prev) => {
      const exists = prev.some(
        (p) => p.name.toLowerCase() === inputName.trim().toLowerCase(),
      );
      if (exists) return prev;
      return [
        ...prev,
        { name: inputName.trim(), isSub: isSubInput },
      ];
    });
    setInputName("");
  };

  const removeParticipant = (index: number) => {
    setParticipants((p) => p.filter((_, i) => i !== index));
  };

  const clearAll = async () => {
    setParticipants([]);
    if (Platform.OS === "web") localStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  };

  /* ------------------------------------------------------------------ *
   * RAFFLE + SUBS
   * ------------------------------------------------------------------ */

  const startRaffle = async () => {
    if (role === "viewer") return;
    const token = await getToken();
    await apiFetch(API_CONFIG.ENDPOINTS.RAFFLE_START, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: raffleWord,
        game: "ships",
        streamer: streamerRef.current,
        twitchChannel: streamer,
      }),
    });
    setRaffleRunning(true);
  };

  const stopRaffle = async () => {
    const token = await getToken();
    const res = await apiFetch(API_CONFIG.ENDPOINTS.RAFFLE_STOP, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const parsed = data.data.map((p: any) => ({
      name: p.username,
      isSub: p.isSub,
    }));
    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.name.toLowerCase()));
      const newOnes = parsed.filter(
        (p: any) => !existing.has(p.name.toLowerCase()),
      );
      return [...prev, ...newOnes];
    });
    setRaffleRunning(false);
  };

  const fetchSubs = async () => {
    if (role !== "streamer") return;
    const token = await getToken();
    const res = await apiFetch(API_CONFIG.ENDPOINTS.SUBS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    const parsed = data.subscribers.map((s: any) => ({
      name: s.user_name,
      isSub: true,
    }));
    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.name.toLowerCase()));
      const newOnes = parsed.filter(
        (p: any) => !existing.has(p.name.toLowerCase()),
      );
      return [...prev, ...newOnes];
    });
  };

  /* ------------------------------------------------------------------ *
   * ARRANCAR BATALLA
   * ------------------------------------------------------------------ */

  const startBattle = async () => {
    if (participants.length < 2) return;

    const token = await getToken();
    const canUseServer =
      !!token && !!socketRef.current?.connected && role !== "viewer";

    resetScene();

    if (canUseServer) {
      setMode("server");
      socketRef.current?.emit("ships:start", {
        participants,
        aspect,
        channel: streamer.trim() || undefined,
      });
      pushFeed("⚓ Batalla iniciada en el servidor", "info");
    } else {
      setMode("local");
      localBattleRef.current = createBattle(participants, { aspect });
      pushFeed("⚓ Batalla local (sin servidor)", "info");
    }

    setGameState("playing");
  };

  const resetScene = () => {
    stateRef.current = null;
    battleOverRef.current = false;
    animsRef.current.clear();
    bulletAnimsRef.current.clear();
    setScene(null);
    setWinner(null);
    setFinalRank([]);
    setBattleOver(false);
    setFeed([]);
    setFx([]);
  };

  const backToPanel = () => {
    if (mode === "server") socketRef.current?.emit("ships:stop");
    localBattleRef.current = null;
    setGameState("setup");
    resetScene();
  };

  const restartBattle = () => {
    localBattleRef.current = null;
    resetScene();
    startBattle();
  };

  const runLocalCommand = (type: "ammo" | "fire" | "shield") => {
    const battle = localBattleRef.current;
    if (!battle) return;

    // Objetivo explicito (chip seleccionado) o, si no hay, el primer barco
    // vivo. Evita enviar "null" al motor.
    const explicit = scene?.ships.find((s) => s.id === cmdTarget);
    const fallback = scene?.ships.find((s) => s.alive);
    const target = explicit && explicit.alive ? explicit : fallback;

    const result = applyCommand(battle, {
      type,
      target: target ? target.name : null,
      by: "Mando",
    });

    if (result?.message) {
      pushFeed(`⚓ ${result.message}`, result.ok ? "cmd" : "info");
    }
  };

  /* ------------------------------------------------------------------ *
   * RENDER: SETUP
   * ------------------------------------------------------------------ */

  if (gameState === "setup") {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.setupKicker}>NAVAL CLASH</Text>
        <Text style={styles.setupTitle}>Batalla Naval</Text>

        {role === "mod" && (
          <TextInput
            style={styles.textInput}
            placeholder="Nombre del streamer"
            placeholderTextColor="#6f8698"
            value={streamer}
            onChangeText={setStreamer}
          />
        )}

        {role !== "viewer" && (
          <>
            <TextInput
              style={styles.textInput}
              placeholder="Keyword"
              placeholderTextColor="#6f8698"
              value={raffleWord}
              onChangeText={setRaffleWord}
            />

            {!raffleRunning && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={startRaffle}
              >
                <Text style={styles.startBtnText}>Obtener gente del chat</Text>
              </TouchableOpacity>
            )}

            {raffleRunning && (
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={stopRaffle}
              >
                <Text style={styles.startBtnText}>Dejar de obtener</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {role === "streamer" && (
          <TouchableOpacity style={styles.startBtn} onPress={fetchSubs}>
            <Text style={styles.startBtnText}>OBTENER SUBS</Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputBox}>
          <TextInput
            style={[styles.textInput, styles.nameInput]}
            placeholder="Nombre"
            placeholderTextColor="#6f8698"
            value={inputName}
            onChangeText={setInputName}
            onSubmitEditing={addParticipant}
          />

          <TouchableOpacity
            style={[styles.typeToggle, isSubInput && styles.typeToggleSub]}
            onPress={() => setIsSubInput(!isSubInput)}
          >
            <Text style={styles.typeToggleText}>
              {isSubInput ? "👑 SUB" : "🚤"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={addParticipant}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.participantList}
          contentContainerStyle={styles.grid}
        >
          {participants.map((p, i) => (
            <View
              key={`${p.name}-${i}`}
              style={[styles.participantItem, p.isSub && styles.participantSub]}
            >
              <Text style={styles.participantName} numberOfLines={1}>
                {p.isSub ? "👑 " : "🚤 "}
                {p.name}
              </Text>

              <TouchableOpacity onPress={() => removeParticipant(i)}>
                <Text style={styles.removeText}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {participants.length < 2 && (
          <Text style={styles.hintText}>
            Necesitas al menos 2 barcos para zarpar
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.startBtn,
            participants.length < 2 && styles.startBtnDisabled,
          ]}
          onPress={startBattle}
        >
          <Text style={styles.startBtnText}>INICIAR PELEA</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearBtnText}>BORRAR TODO</Text>
        </TouchableOpacity>

        <Text style={styles.commandsHint}>
          En el chat: !municion · !fuego &lt;barco&gt; · !blindaje &lt;barco&gt;
        </Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------ *
   * RENDER: BATALLA
   * ------------------------------------------------------------------ */

  const ships = scene?.ships || [];
  const ranked = [...ships].sort(
    (a, b) => b.kills - a.kills || b.hp - a.hp,
  );
  const stormScale = scene?.storm ?? 1;
  const stormRx = 0.5 * stormScale * mapping.scale;
  const stormRy = (mapping.aspect / 2) * stormScale * mapping.scale;
  const stormCx = mapping.offsetX + 0.5 * mapping.scale;
  const stormCy = mapping.offsetY + (mapping.aspect / 2) * mapping.scale;
  const timeLeft = Math.max(0, 150 - (scene?.t || 0));

  return (
    <View style={styles.battleContainer}>
      <OceanSceneMemo width={width} height={height} />

      {/* Tormenta */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        testID="storm-overlay"
      >
        <SvgOverlay
          width={width}
          height={height}
          cx={stormCx}
          cy={stormCy}
          rx={stormRx}
          ry={stormRy}
        />
      </View>

      {/* Barcos */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ships.map((ship) => {
          const anim = animsRef.current.get(ship.id);
          if (!anim) return null;
          return <ShipViewMemo key={ship.id} ship={ship} anim={anim} />;
        })}

        {scene?.bullets.map((b) => {
          const anim = bulletAnimsRef.current.get(b.id);
          if (!anim) return null;
          return (
            <View
              key={b.id}
              pointerEvents="none"
              testID="bullet"
              style={[
                styles.bullet,
                {
                  left: anim.px - 7,
                  top: anim.py - 7,
                  backgroundColor: b.isSub ? "#ffd166" : "#eaf6ff",
                },
              ]}
            />
          );
        })}
      </View>

      {/* Explosiones */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {fx.map((f) => (
          <Explosion
            key={f.id}
            fx={f}
            scale={mapping.scale}
            offsetX={mapping.offsetX}
            offsetY={mapping.offsetY}
          />
        ))}
      </View>

      {/* HUD */}
      <View style={styles.hudTop} pointerEvents="box-none">
        <View style={styles.scoreboard} testID="scoreboard">
          <Text style={styles.scoreTitle}>⚓ FLOTA</Text>
          {ranked.slice(0, 5).map((s, i) => (
            <View key={s.id} style={styles.scoreRow}>
              <Text
                style={[
                  styles.scoreName,
                  s.isSub && styles.scoreNameSub,
                  s.id === scene?.winner && styles.scoreNameWinner,
                ]}
                numberOfLines={1}
              >
                {i + 1}. {CLASS_EMOJI[s.cls]} {s.name}
              </Text>
              <View style={styles.hpBarBg}>
                <View
                  style={[
                    styles.hpBarFill,
                    {
                      width: `${Math.max(
                        0,
                        Math.min(100, (s.hp / (s.maxHp || 1)) * 100),
                      )}%`,
                      backgroundColor: s.isSub ? "#ffd166" : "#5fd0a6",
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreKills}>☠ {s.kills}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLine}>⏱ {Math.floor(timeLeft)}s</Text>
          <Text style={styles.statusLine}>
            🌪 {Math.round(stormScale * 100)}%
          </Text>
          <Text
            style={[
              styles.statusLine,
              mode === "local" && styles.statusWarn,
            ]}
          >
            {mode === "server"
              ? connected
                ? "🛰 EN VIVO"
                : "🛰 SIN CONEXIÓN"
              : "💻 LOCAL"}
          </Text>
        </View>
      </View>

      {/* Feed */}
      <View style={styles.feed} pointerEvents="none">
        {feed.map((f) => (
          <Text
            key={f.id}
            style={[
              styles.feedText,
              f.tone === "kill" && styles.feedKill,
              f.tone === "cmd" && styles.feedCmd,
            ]}
          >
            {f.text}
          </Text>
        ))}
      </View>

      {/* Controles */}
      <View style={styles.controls}>
        <Text style={styles.commandsHint}>
          !municion · !fuego &lt;nombre&gt; · !blindaje &lt;nombre&gt;
        </Text>
        {mode === "local" && (
          <View style={styles.cmdBar}>
            <View style={styles.cmdTargets}>
              {scene?.ships
                .filter((s) => s.alive)
                .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setCmdTarget(s.id === cmdTarget ? null : s.id)}
                    style={[
                      styles.cmdChip,
                      cmdTarget === s.id && styles.cmdChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cmdChipText,
                        cmdTarget === s.id && styles.cmdChipTextActive,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => runLocalCommand("ammo")}
              >
                <Text style={styles.controlBtnText}>MUNICIÓN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => runLocalCommand("fire")}
              >
                <Text style={styles.controlBtnText}>FUEGO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => runLocalCommand("shield")}
              >
                <Text style={styles.controlBtnText}>BLINDAJE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={restartBattle}>
            <Text style={styles.controlBtnText}>NUEVA BATALLA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, styles.controlBtnGhost]}
            onPress={backToPanel}
          >
            <Text style={styles.controlBtnText}>PANEL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Victoria */}
      <Modal visible={battleOver} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.winEmoji}>👑</Text>
            <Text style={styles.winTitle}>¡VICTORIA!</Text>
            <Text style={styles.winName}>{winner?.name || "Sin ganador"}</Text>
            <Text style={styles.winClass}>{winner?.label}</Text>

            <View style={styles.divider} />
            <Text style={styles.rankTitle}>🏆 TOP 5</Text>

            <View style={styles.rankList}>
              {finalRank.map((s, i) => (
                <View key={s.id} style={styles.rankItem}>
                  <Text style={styles.rankPos}>{i + 1}.</Text>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.rankKills}>{s.kills} ☠</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.restartBtn} onPress={restartBattle}>
              <Text style={styles.restartText}>OTRA BATALLA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={backToPanel}>
              <Text style={styles.backText}>VOLVER AL PANEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------- *
 * OVERLAY DE TORMENTA
 * -------------------------------------------------------------------- */

function SvgOverlay({
  width,
  height,
  cx,
  cy,
  rx,
  ry,
}: {
  width: number;
  height: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="stormEdge" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#02060c" stopOpacity={0} />
          <Stop offset="0.72" stopColor="#02060c" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#02060c" stopOpacity={0.9} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#stormEdge)" />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        stroke="#7fd8ff"
        strokeOpacity={0.5}
        strokeWidth={2}
        strokeDasharray="10 8"
        fill="none"
      />
    </Svg>
  );
}

/* -------------------------------------------------------------------- *
 * EXPLOSION
 * -------------------------------------------------------------------- */

function Explosion({
  fx,
  scale,
  offsetX,
  offsetY,
}: {
  fx: Fx;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const progressRef = useRef(0);
  const [, setP] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / 650);
      progressRef.current = p;
      setP((v) => (v + 1) % 1000);
    }, 16);
    return () => clearInterval(id);
  }, []);

  const progress = progressRef.current;

  const color =
    fx.kind === "splash" ? "#9fd8ee" : fx.kind === "sink" ? "#ff8a3d" : "#ffd166";
  const maxR = fx.size * 46;
  const px = fx.x * scale + offsetX;
  const py = fx.y * scale + offsetY;
  const ringScale = 0.2 + 1.2 * progress;
  const ringSize = maxR * ringScale;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fxRing,
        {
          left: px - ringSize / 2,
          top: py - ringSize / 2,
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderColor: color,
          opacity: 0.9 * (1 - progress),
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------- *
 * ESTILOS
 * -------------------------------------------------------------------- */

const NAVY = "#08192b";
const PANEL = "rgba(6,20,34,0.82)";
const GOLD = "#f2c14e";

const styles = StyleSheet.create({
  battleContainer: {
    flex: 1,
    backgroundColor: NAVY,
    overflow: "hidden",
  },

  shipWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },

  shipLabel: {
    position: "absolute",
    left: -20,
    right: -20,
    textAlign: "center",
    color: "#eaf4fb",
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  shipLabelSub: {
    color: "#ffd166",
  },

  turretWrap: {
    position: "absolute",
  },

  bullet: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  fxRing: {
    position: "absolute",
    borderWidth: 3,
  },

  hudTop: {
    position: "absolute",
    top: 44,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  scoreboard: {
    backgroundColor: PANEL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.35)",
    padding: 10,
    minWidth: 190,
    maxWidth: "58%",
  },

  scoreTitle: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 6,
  },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },

  scoreName: {
    color: "#dce9f2",
    fontSize: 12,
    fontWeight: "700",
    width: 78,
  },

  scoreNameSub: {
    color: GOLD,
  },

  scoreNameWinner: {
    color: "#ffffff",
  },

  hpBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },

  hpBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  scoreKills: {
    color: "#ff8a3d",
    fontSize: 11,
    fontWeight: "bold",
    width: 26,
    textAlign: "right",
  },

  statusBox: {
    backgroundColor: PANEL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(159,216,238,0.2)",
    padding: 10,
    alignItems: "flex-end",
    gap: 3,
  },

  statusLine: {
    color: "#cfe6f2",
    fontSize: 11,
    fontWeight: "700",
  },

  statusWarn: {
    color: GOLD,
  },

  feed: {
    position: "absolute",
    left: 14,
    bottom: 118,
    gap: 3,
  },

  feedText: {
    color: "#cfe6f2",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(4,14,24,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },

  feedKill: {
    color: "#ffb066",
  },

  feedCmd: {
    color: "#9fe8c8",
  },

  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
    gap: 8,
  },

  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },

  controlBtn: {
    backgroundColor: "rgba(242,193,78,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
  },

  controlBtnGhost: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  controlBtnText: {
    color: "#0b2237",
    fontWeight: "bold",
    fontSize: 12,
  },

  commandsHint: {
    color: "rgba(207,230,242,0.7)",
    fontSize: 11,
    textAlign: "center",
  },

  cmdBar: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(4,18,32,0.72)",
    borderWidth: 1,
    borderColor: "rgba(127,216,255,0.22)",
  },

  cmdTargets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },

  cmdChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  cmdChipActive: {
    backgroundColor: "rgba(242,193,78,0.9)",
    borderColor: "#f2c14e",
  },

  cmdChipText: {
    color: "#cfe6f2",
    fontSize: 11,
    fontWeight: "600",
  },

  cmdChipTextActive: {
    color: "#0b2237",
  },

  /* SETUP */
  setupContainer: {
    flex: 1,
    backgroundColor: NAVY,
    padding: 20,
    paddingTop: 56,
  },

  setupKicker: {
    color: GOLD,
    fontSize: 11,
    letterSpacing: 4,
    textAlign: "center",
    fontWeight: "bold",
  },

  setupTitle: {
    color: "#eaf4fb",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 18,
  },

  textInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    color: "#eaf4fb",
    borderWidth: 1,
    borderColor: "rgba(159,216,238,0.25)",
    marginBottom: 10,
  },

  inputBox: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  nameInput: {
    flex: 1,
    marginBottom: 0,
  },

  typeToggle: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: "center",
  },

  typeToggleSub: {
    backgroundColor: GOLD,
  },

  typeToggleText: {
    color: "#fff",
    fontWeight: "bold",
  },

  addBtn: {
    backgroundColor: GOLD,
    width: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  addBtnText: {
    color: "#0b2237",
    fontSize: 24,
    fontWeight: "bold",
  },

  participantList: {
    flex: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  participantItem: {
    width: "31%",
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(159,216,238,0.18)",
    alignItems: "center",
  },

  participantSub: {
    borderColor: GOLD,
    backgroundColor: "rgba(242,193,78,0.12)",
  },

  participantName: {
    color: "#eaf4fb",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },

  removeText: {
    color: "#ff7a7a",
    fontSize: 11,
    fontWeight: "bold",
  },

  hintText: {
    color: "rgba(207,230,242,0.6)",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 10,
  },

  startBtn: {
    backgroundColor: GOLD,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  startBtnDisabled: {
    opacity: 0.4,
  },

  startBtnText: {
    color: "#0b2237",
    fontWeight: "bold",
    fontSize: 15,
  },

  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },

  dangerButton: {
    backgroundColor: "#c94b4b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },

  clearBtn: {
    padding: 12,
    alignItems: "center",
  },

  clearBtnText: {
    color: "rgba(207,230,242,0.5)",
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,8,14,0.88)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    backgroundColor: "#0a1c2e",
    width: "86%",
    padding: 26,
    borderRadius: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.45)",
  },

  winEmoji: {
    fontSize: 54,
    marginBottom: -6,
  },

  winTitle: {
    color: "#8fb0c6",
    fontSize: 13,
    letterSpacing: 3,
  },

  winName: {
    color: GOLD,
    fontSize: 30,
    fontWeight: "bold",
    marginVertical: 4,
    textAlign: "center",
  },

  winClass: {
    color: "#8fb0c6",
    fontSize: 12,
    marginBottom: 6,
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 16,
  },

  rankTitle: {
    color: GOLD,
    fontWeight: "bold",
    marginBottom: 12,
    fontSize: 15,
  },

  rankList: {
    width: "100%",
    marginBottom: 20,
  },

  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },

  rankPos: {
    color: "#6f8698",
    fontWeight: "bold",
    width: 22,
  },

  rankName: {
    flex: 1,
    color: "#eaf4fb",
    fontSize: 14,
    fontWeight: "600",
  },

  rankKills: {
    color: "#ff8a3d",
    fontWeight: "bold",
    fontSize: 12,
  },

  restartBtn: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 34,
    borderRadius: 24,
    marginBottom: 10,
  },

  restartText: {
    color: "#0b2237",
    fontWeight: "bold",
  },

  backBtn: {
    paddingVertical: 10,
  },

  backText: {
    color: "rgba(207,230,242,0.65)",
    fontWeight: "bold",
    fontSize: 12,
  },
});
