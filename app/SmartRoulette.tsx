import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";

import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";
import { io } from "socket.io-client";

import { getSessionId } from "../utils/session";
import { API_CONFIG } from '../constants/api';

type Participant = {
  username: string;
  weight: number;
};

type WinnerRecord = {
  round: number;
  username: string;
  weight: number;
  at: number;
};

interface SocketData {
  participant: {
    username: string;
    isSub: boolean;
    points: number;
    giftsSent: number;
  };
  totalCount: number;
}

type Role = "viewer" | "mod" | "streamer";

// Curated palette matching the site theme (arena / cream / terracotta)
const SLICE_STYLES = [
  { fill: "#C5A582", text: "#FFFFFF" },
  { fill: "#F5EFE7", text: "#5A4632" },
  { fill: "#CE7B5B", text: "#FFFFFF" },
  { fill: "#EADCC6", text: "#5A4632" },
  { fill: "#A9866B", text: "#FFFFFF" },
  { fill: "#F7F1E8", text: "#5A4632" },
];

const WHEEL_FONT = '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';

const MAX_SLICES = 120;

const STORAGE_PARTICIPANTS = "roulette_participants";
const STORAGE_TEMPLATES = "roulette_templates";
const STORAGE_SOUND = "roulette_sound";

function readStorage<T>(key: string, fallback: T): T {
  if (Platform.OS !== "web") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function prefersReducedMotion(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function SmartRoulette() {
  const params = useLocalSearchParams();

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isNarrow = winWidth < 900;
  const wheelSize = Math.max(240, Math.min(winWidth - 60, winHeight * 0.55, 480));
  const wheelCenter = wheelSize / 2;
  const wheelRadius = wheelCenter - 24;

  const viewOverlay = params.view === "overlay";

  const socketRef = useRef<any>(null);

  const role: Role = (params.role as Role) || "viewer";

  const parseInitialData = (): Participant[] | null => {
    if (!params.data) return null;
    try {
      const arr = JSON.parse(params.data as string);
      if (!Array.isArray(arr)) return null;
      return arr
        .map((p: any) => ({
          username: p.user_name || p.username || p.name,
          weight: Number(p.weight) > 0 ? Math.floor(Number(p.weight)) : 1,
        }))
        .filter((p) => p.username);
    } catch {
      return null;
    }
  };

  const [participants, setParticipants] = useState<Participant[]>(() => {
    const fromUrl = parseInitialData();
    if (fromUrl && fromUrl.length) return fromUrl;
    const saved = readStorage<Participant[]>(STORAGE_PARTICIPANTS, []);
    return saved.filter((p) => p && p.username && typeof p.username === "string");
  });

  const [winner, setWinner] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [keyword, setKeyword] = useState("!sorteo");
  const [streamer, setStreamer] = useState("");
  const streamerRef = useRef("default");

  // Draw settings
  const [drawMode, setDrawMode] = useState<"replace" | "eliminate">("replace");
  const [spins, setSpins] = useState(6);
  const [soundOn, setSoundOn] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_SOUND, true),
  );
  const soundOnRef = useRef(soundOn);
  const [spinning, setSpinning] = useState(false);

  // Rounds & history
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<WinnerRecord[]>([]);

  // Chat raffle extras
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);

  // Participant tools
  const [search, setSearch] = useState("");
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState("");
  const [lastRemoved, setLastRemoved] = useState<Participant | null>(null);
  const [templates, setTemplates] = useState<Record<string, Participant[]>>(
    () => readStorage<Record<string, Participant[]>>(STORAGE_TEMPLATES, {}),
  );
  const [templateName, setTemplateName] = useState("");
  const [copied, setCopied] = useState<"link" | "results" | null>(null);

  const [visualSlices, setVisualSlices] = useState<Participant[]>([]);
  useEffect(() => {
    setVisualSlices(buildVisualSlices());
  }, [participants]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const pointerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spinAnim.setValue(0);
  }, []);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ["0deg", "3600deg"],
  });

  useEffect(() => {
    soundOnRef.current = soundOn;
    writeStorage(STORAGE_SOUND, soundOn);
  }, [soundOn]);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    writeStorage(STORAGE_PARTICIPANTS, participants);
  }, [participants]);

  /*
  TOKEN
  */

  const getToken = async () => {
    if (Platform.OS === "web") return localStorage.getItem("userToken");

    return await SecureStore.getItemAsync("userToken");
  };

  /*
    SOCKET REAL-TIME LISTENER
  */
  useEffect(() => {
    if (socketRef.current?.connected) return;

    const socket = io("https://manti-twitch-backend.onrender.com", {
      reconnection: false,
      timeout: 5000,
      auth: (cb) => getToken().then((token) => cb(token ? { token } : {})),
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const activeStreamer = streamer?.trim() || getSessionId();

      streamerRef.current = activeStreamer;

      socket.emit("joinRoom", {
        game: "roulette",
        streamer: streamerRef.current,
      });
    });

    socket.on("connect_error", () => {
      // Silent fail — socket not needed for local-only features
    });

    socket.on("newParticipant", (data: SocketData) => {
      if (frozenRef.current) return;

      setParticipants((prev) => {
        const exists = prev.some(
          (p) =>
            p.username.toLowerCase() ===
            data.participant.username.toLowerCase(),
        );

        if (exists) return prev;

        return [
          ...prev,
          {
            username: data.participant.username,
            weight: data.participant.points || 1,
          },
        ];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /*
  SOUND
  */

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<any>(null);
  const tickBucketRef = useRef(-1);

  const playSpinSound = () => {
    if (Platform.OS !== "web") return;

    if (!audioRef.current) {
      audioRef.current = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
      );
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  const playTick = () => {
    if (Platform.OS !== "web") return;
    try {
      const w = window as any;
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1300;
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {}
  };

  // Ticks + pointer bounce while the wheel spins
  useEffect(() => {
    const onFrame = ({ value }: { value: number }) => {
      const bucket = Math.floor((value * 360) / 15);
      if (bucket === tickBucketRef.current) return;
      tickBucketRef.current = bucket;

      if (soundOnRef.current) playTick();

      if (!prefersReducedMotion()) {
        pointerAnim.setValue(0.7);
        Animated.timing(pointerAnim, {
          toValue: 0,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      }
    };

    spinAnim.addListener(onFrame);
    return () => spinAnim.removeListener(onFrame);
  }, []);

  /*
  WEIGHT SYSTEM
  */

  const buildWeightedParticipants = () => {
    const expanded: Participant[] = [];

    participants.forEach((p) => {
      const copies = Math.max(1, Math.floor(p.weight));

      for (let i = 0; i < copies; i++) {
        expanded.push({ ...p });
      }
    });

    // Shuffle
    for (let i = expanded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
    }

    return expanded;
  };

  /*
  ULTRA MODE
  */

  const buildVisualSlices = () => {
    const weighted = buildWeightedParticipants();

    if (weighted.length <= MAX_SLICES) return weighted;

    const slices: Participant[] = [];

    for (let i = 0; i < MAX_SLICES; i++) {
      const random = weighted[Math.floor(Math.random() * weighted.length)];

      slices.push(random);
    }

    return slices;
  };

  /*
  PARTICIPANTS
  */

  const addParticipant = () => {
    const name = newUser.trim();
    if (!name) return;

    const exists = participants.some(
      (p) => p.username.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setAddError(`"${name}" ya está en la lista`);
      return;
    }

    setAddError("");
    setParticipants((p) => [...p, { username: name, weight: 1 }]);
    setNewUser("");
  };

  const addBulk = () => {
    const names = bulkText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;

    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.username.toLowerCase()));
      const toAdd: Participant[] = [];

      for (const n of names) {
        const key = n.toLowerCase();
        if (!existing.has(key)) {
          existing.add(key);
          toAdd.push({ username: n, weight: 1 });
        }
      }

      return [...prev, ...toAdd];
    });

    setBulkText("");
  };

  const removeParticipant = (name: string) => {
    const removed = participants.find((p) => p.username === name);
    setParticipants((prev) => prev.filter((u) => u.username !== name));
    if (removed) setLastRemoved(removed);
  };

  const restoreRemoved = () => {
    if (!lastRemoved) return;
    const r = lastRemoved;
    setParticipants((prev) =>
      prev.some((p) => p.username.toLowerCase() === r.username.toLowerCase())
        ? prev
        : [...prev, r],
    );
    setLastRemoved(null);
  };

  const clearParticipants = () => {
    if (Platform.OS === "web" && !window.confirm("¿Eliminar todos los participantes?")) {
      return;
    }
    setParticipants([]);
    setLastRemoved(null);
    setWinner(null);
    setRound(0);
    setHistory([]);
  };

  const changeWeight = (name: string, delta: number) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.username === name
          ? { ...p, weight: Math.min(99, Math.max(1, p.weight + delta)) }
          : p,
      ),
    );
  };

  const commitRename = (oldName: string) => {
    const name = editValue.trim();
    setEditingName(null);
    if (!name || name === oldName) return;

    const dup = participants.some(
      (p) =>
        p.username !== oldName &&
        p.username.toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      setAddError(`"${name}" ya está en la lista`);
      return;
    }

    setAddError("");
    setParticipants((prev) =>
      prev.map((p) => (p.username === oldName ? { ...p, username: name } : p)),
    );
    setHistory((prev) =>
      prev.map((h) => (h.username === oldName ? { ...h, username: name } : h)),
    );
    if (winner === oldName) setWinner(name);
  };

  /*
  TEMPLATES
  */

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;

    setTemplates((prev) => {
      const next = { ...prev, [name]: participants.map((p) => ({ ...p })) };
      writeStorage(STORAGE_TEMPLATES, next);
      return next;
    });
    setTemplateName("");
  };

  const loadTemplate = (name: string) => {
    const t = templates[name];
    if (!t) return;
    setParticipants(t.map((p) => ({ ...p })));
    setWinner(null);
  };

  const deleteTemplate = (name: string) => {
    setTemplates((prev) => {
      const next = { ...prev };
      delete next[name];
      writeStorage(STORAGE_TEMPLATES, next);
      return next;
    });
  };

  /*
  SHARE & RESULTS
  */

  const flashCopied = (what: "link" | "results") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyShareLink = async () => {
    if (Platform.OS !== "web") return;

    const payload = participants.map((p) => ({
      user_name: p.username,
      weight: p.weight,
    }));
    const url = `${window.location.origin}/SmartRoulette?role=${role}&data=${encodeURIComponent(
      JSON.stringify(payload),
    )}`;

    try {
      await navigator.clipboard.writeText(url);
      flashCopied("link");
    } catch {}
  };

  const copyResults = async () => {
    if (Platform.OS !== "web" || !history.length) return;

    const lines = history.map((h, i) => `${i + 1}º ${h.username}`);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      flashCopied("results");
    } catch {}
  };

  /*
  UNDO LAST WINNER (eliminate mode)
  */

  const undoLastWinner = () => {
    if (!history.length) return;

    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setParticipants((prev) =>
      prev.some(
        (p) => p.username.toLowerCase() === last.username.toLowerCase(),
      )
        ? prev
        : [...prev, { username: last.username, weight: last.weight }],
    );
    setWinner(null);
    setRound((r) => Math.max(0, r - 1));
    spinAnim.setValue(0);
  };

  /*
  ANIMATION
  */

  const animateSpin = (
    winnerName: string,
    visual: Participant[],
    mode: "replace" | "eliminate",
    winnerWeight: number,
  ) => {
    const slice = 360 / Math.max(visual.length, 1);

    const winnerIndex = visual.findIndex((p) => p.username === winnerName);

    if (winnerIndex === -1) {
      console.warn("Winner not in visual slices");
      setSpinning(false);
      return;
    }

    const centerOfSlice = winnerIndex * slice + slice / 2;

    // The pointer sits at the top (270° in SVG coords: 0° = right, y down)
    const targetAngle = (((270 - centerOfSlice) % 360) + 360) % 360;

    const toValue = spins + targetAngle / 360;
    const duration = Math.max(3000, spins * 900);

    setWinner(null);
    setSpinning(true);
    spinAnim.setValue(0);
    tickBucketRef.current = -1;

    const finish = () => {
      setWinner(winnerName);
      setSpinning(false);
      setRound((r) => r + 1);
      setHistory((prev) => [
        ...prev,
        { round: prev.length + 1, username: winnerName, weight: winnerWeight, at: Date.now() },
      ]);

      if (mode === "eliminate") {
        setParticipants((prev) =>
          prev.filter(
            (p) => p.username.toLowerCase() !== winnerName.toLowerCase(),
          ),
        );
        spinAnim.setValue(0);
      }
    };

    if (soundOnRef.current && Platform.OS === "web") playSpinSound();

    if (prefersReducedMotion()) {
      spinAnim.setValue(toValue);
      finish();
      return;
    }

    Animated.timing(spinAnim, {
      toValue,
      duration,
      easing: Easing.bezier(0.12, 0.68, 0.16, 1),
      useNativeDriver: true,
    }).start(() => finish());
  };

  /*
  BACKEND
  */

  const startRaffle = async () => {
    if (role === "viewer") return;

    const token = await getToken();

    await fetch(API_CONFIG.ENDPOINTS.RAFFLE_START, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword,
        game: "roulette",
        streamer: streamerRef.current,
        twitchChannel: streamer,
        subMult: 2,
        giftMult: 2,
      }),
    });

    setRunning(true);
  };

  const stopRaffle = async () => {
    if (role === "viewer") return;

    const token = await getToken();

    const res = await fetch(
      API_CONFIG.ENDPOINTS.RAFFLE_STOP,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const data = await res.json();

    const parsed: Participant[] = data.data.map((p: any) => ({
      username: p.username,
      weight: p.points,
    }));

    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.username.toLowerCase()));

      const newOnes = parsed.filter(
        (p) => !existing.has(p.username.toLowerCase()),
      );

      return [...prev, ...newOnes];
    });

    setRunning(false);
  };

  /*
  LOAD SUBSCRIBERS (streamer only)
  */

  const fetchSubs = async () => {
    if (role !== "streamer") return;

    const token = await getToken();

    const res = await fetch(API_CONFIG.ENDPOINTS.SUBS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!Array.isArray(data?.subscribers)) return;

    const parsed: Participant[] = data.subscribers.map((s: any) => ({
      username: s.user_name || s.username || s.name,
      weight: 1,
    }));

    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.username.toLowerCase()));

      const newOnes = parsed.filter(
        (p) => p.username && !existing.has(p.username.toLowerCase()),
      );

      return [...prev, ...newOnes];
    });
  };

  /*
  PICK WINNER
  */

  const pickWinner = async () => {
    if (spinning) return;

    // Force stop raffle
    setRunning(false);

    if (participants.length === 0) return;

    const weighted = buildWeightedParticipants();

    let winnerUser: Participant;

    if (!running) {
      winnerUser = weighted[Math.floor(Math.random() * weighted.length)];
    } else {
      const token = await getToken();

      const res = await fetch(
        API_CONFIG.ENDPOINTS.PICK_WINNER,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();

      if (!data?.winner?.username) {
        setRunning(false);
        return;
      }

      winnerUser = {
        username: data.winner.username,
        weight: 1,
      };
    }

    if (!winnerUser) return;

    const original = participants.find(
      (p) => p.username.toLowerCase() === winnerUser.username.toLowerCase(),
    );

    animateSpin(
      winnerUser.username,
      visualSlices,
      drawMode,
      original?.weight ?? 1,
    );
  };

  /*
  DERIVED
  */

  const totalWeight =
    participants.reduce((s, p) => s + Math.max(1, Math.floor(p.weight)), 0) || 1;

  const visibleParticipants = search.trim()
    ? participants.filter((p) =>
        p.username.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : participants;

  const templateNames = Object.keys(templates);

  /*
  RENDER WHEEL
  */

  const renderWheel = () => {
    const visual = visualSlices;

    const radius = wheelRadius;
    const center = wheelCenter;
    const slice = 360 / Math.max(visual.length, 1);

    return visual.map((p, i) => {
      const start = i * slice;
      const end = start + slice;

      const x1 = center + radius * Math.cos((Math.PI * start) / 180);
      const y1 = center + radius * Math.sin((Math.PI * start) / 180);

      const x2 = center + radius * Math.cos((Math.PI * end) / 180);
      const y2 = center + radius * Math.sin((Math.PI * end) / 180);

      const path = `
M ${center} ${center}
L ${x1} ${y1}
A ${radius} ${radius} 0 0 1 ${x2} ${y2}
Z
`;

      const textAngle = start + slice / 2;

      const textRadius = visual.length <= 4 ? 0.42 : 0.55;
      const tx =
        center + radius * textRadius * Math.cos((Math.PI * textAngle) / 180);
      const ty =
        center + radius * textRadius * Math.sin((Math.PI * textAngle) / 180);

      const palette = SLICE_STYLES[i % SLICE_STYLES.length];
      const isWinner = !!winner && p.username === winner;

      return (
        <G key={i}>
          <Path
            d={path}
            fill={isWinner ? "#FFD700" : palette.fill}
            stroke="#FFFFFF"
            strokeWidth={1}
          />

          {visual.length <= 120 && (
            <SvgText
              x={tx}
              y={ty}
              fontSize={
                visual.length > 60
                  ? "10"
                  : visual.length > 25
                    ? "14"
                    : visual.length <= 4
                      ? "15"
                      : "17"
              }
              fontFamily={WHEEL_FONT}
              fill={isWinner ? "#3A2F26" : palette.text}
              fontWeight="700"
              letterSpacing="0.5"
              textAnchor="middle"
              alignmentBaseline="middle"
              rotation={textAngle}
              origin={`${tx},${ty}`}
            >
              {p.username.toUpperCase()}
            </SvgText>
          )}
        </G>
      );
    });
  };

  const wheelBlock = (
    <View
      style={[styles.wheelContainer, { width: wheelSize, height: wheelSize }]}
    >
      <Animated.View
        style={{
          transform: [{ rotate: rotation }, { perspective: 900 }],
        }}
      >
        <Svg width={wheelSize} height={wheelSize}>
          <Circle
            cx={wheelCenter}
            cy={wheelCenter}
            r={wheelRadius + 16}
            fill="#EDE4D6"
          />
          {renderWheel()}
          <Circle
            cx={wheelCenter}
            cy={wheelCenter}
            r={wheelRadius + 8}
            fill="none"
            stroke="#C5A582"
            strokeWidth={10}
          />
          <Circle
            cx={wheelCenter}
            cy={wheelCenter}
            r={68}
            fill="#FAF7F2"
            stroke="#C5A582"
            strokeWidth={4}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.pointer, { transform: [{ translateY: pointerAnim }] }]}>
        <View style={styles.pointerTriangle} />
      </Animated.View>

      <TouchableOpacity
        style={[styles.hubButton, spinning && { opacity: 0.6 }]}
        onPress={pickWinner}
        activeOpacity={0.8}
      >
        <Text style={styles.hubButtonText}>GIRAR RULETA</Text>
      </TouchableOpacity>
    </View>
  );

  // Fixed-height box: the wheel never shifts when the winner appears
  const winnerBlock = (
    <View style={styles.winnerBox}>
      {winner ? <Text style={styles.winner}>🏆 {winner}</Text> : null}
    </View>
  );

  /*
  OVERLAY MODE (OBS): wheel + winner only
  */
  if (viewOverlay) {
    return (
      <View style={styles.overlayContainer}>
        {wheelBlock}
        {winnerBlock}
      </View>
    );
  }

  /*
  UI
  */

  const leftContent = (
    <>
      <Text style={styles.title}>Smart Twitch Roulette</Text>

      {wheelBlock}
      {winnerBlock}

      <Text style={styles.statusText}>
        {round === 0
          ? "¡Suerte!"
          : drawMode === "eliminate"
            ? `Ronda ${round} · Quedan ${participants.length}`
            : `Ronda ${round}`}
      </Text>

      {history.length > 0 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>Historial</Text>
          <ScrollView style={styles.historyList}>
            {[...history].reverse().map((h) => {
              const place = history.indexOf(h) + 1;
              return (
                <Text key={`${h.round}-${h.at}`} style={styles.historyItem}>
                  {place}º {h.username}
                </Text>
              );
            })}
          </ScrollView>
          <View style={styles.historyActions}>
            <TouchableOpacity style={styles.tinyButton} onPress={copyResults}>
              <Text style={styles.tinyButtonText}>
                {copied === "results" ? "COPIADO ✓" : "COPIAR"}
              </Text>
            </TouchableOpacity>
            {drawMode === "eliminate" && history.length > 0 && (
              <TouchableOpacity
                style={styles.tinyButton}
                onPress={undoLastWinner}
              >
                <Text style={styles.tinyButtonText}>↩ ÚLTIMO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </>
  );

  const rightContent = (
    <>
      {/* Draw mode + spins + sound */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>Modo de sorteo</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              drawMode === "replace" && styles.modeButtonActive,
            ]}
            onPress={() => setDrawMode("replace")}
          >
            <Text
              style={[
                styles.modeButtonText,
                drawMode === "replace" && styles.modeButtonTextActive,
              ]}
            >
              CON REEMPLAZO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              drawMode === "eliminate" && styles.modeButtonActive,
            ]}
            onPress={() => setDrawMode("eliminate")}
          >
            <Text
              style={[
                styles.modeButtonText,
                drawMode === "eliminate" && styles.modeButtonTextActive,
              ]}
            >
              ELIMINACIÓN
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spinsRow}>
          <Text style={styles.spinsLabel}>Vueltas: {spins}</Text>
          <TouchableOpacity
            style={styles.tinyButton}
            onPress={() => setSpins((s) => Math.max(3, s - 1))}
          >
            <Text style={styles.tinyButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tinyButton}
            onPress={() => setSpins((s) => Math.min(12, s + 1))}
          >
            <Text style={styles.tinyButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tinyButton}
            onPress={() => setSoundOn((s) => !s)}
          >
            <Text style={styles.tinyButtonText}>
              {soundOn ? "🔊 SONIDO" : "🔇 MUDO"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {role === "streamer" && (
        <View style={styles.sectionContainer}>
          <TouchableOpacity style={styles.subsButton} onPress={fetchSubs}>
            <Text style={styles.buttonText}>OBTENER SUSCRIPTORES</Text>
          </TouchableOpacity>
        </View>
      )}

      {role !== "viewer" && (
        <View style={styles.sectionContainer}>
          {role === "mod" && (
            <TextInput
              style={styles.input}
              placeholder="Streamer channel"
              value={streamer}
              onChangeText={setStreamer}
            />
          )}
          <View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="!sorteo"
              value={keyword}
              onChangeText={setKeyword}
            />
            {!running ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={startRaffle}>
                <Text style={styles.buttonText}>Obtener gente del chat</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.dangerButton} onPress={stopRaffle}>
                <Text style={styles.buttonText}>Parar de obtener</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.freezeButton, frozen && styles.freezeOn]}
              onPress={() => setFrozen((f) => !f)}
            >
              <Text style={styles.buttonText}>
                {frozen ? "CHAT CONGELADO" : "CONGELAR CHAT"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.listTitle}>
        Participants ({participants.length})
      </Text>

      <TextInput
        placeholder="Add participant"
        value={newUser}
        onChangeText={(t) => {
          setNewUser(t);
          if (addError) setAddError("");
        }}
        style={styles.input}
      />
      {!!addError && <Text style={styles.errorText}>{addError}</Text>}

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={[styles.button, styles.flexButton]} onPress={addParticipant}>
          <Text style={styles.buttonText}>Añadir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.flexButton, { backgroundColor: "#999" }]}
          onPress={clearParticipants}
        >
          <Text style={styles.buttonText}>Eliminar todo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.flexButton, { backgroundColor: "#B09A7E" }]}
          onPress={copyShareLink}
        >
          <Text style={styles.buttonText}>
            {copied === "link" ? "LINK COPIADO ✓" : "COPIAR LINK"}
          </Text>
        </TouchableOpacity>
      </View>

      {lastRemoved && (
        <TouchableOpacity style={styles.tinyButton} onPress={restoreRemoved}>
          <Text style={styles.tinyButtonText}>
            ↩ RESTAURAR {lastRemoved.username}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.tinyButton}
        onPress={() => setBulkVisible((v) => !v)}
      >
        <Text style={styles.tinyButtonText}>
          {bulkVisible ? "OCULTAR LISTA" : "LISTA MASIVA"}
        </Text>
      </TouchableOpacity>
      {bulkVisible && (
        <View style={styles.sectionContainer}>
          <TextInput
            multiline
            placeholder="Nombres (uno por línea o separados por coma)"
            value={bulkText}
            onChangeText={setBulkText}
            style={styles.bulkInput}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={addBulk}>
            <Text style={styles.buttonText}>AGREGAR LISTA</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        placeholder="Buscar jugador..."
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />

      {templateNames.length > 0 && (
        <View style={styles.templateWrap}>
          {templateNames.map((name) => (
            <View key={name} style={styles.templateChip}>
              <TouchableOpacity onPress={() => loadTemplate(name)}>
                <Text style={styles.templateChipText}>{name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTemplate(name)}>
                <Text style={styles.templateChipDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.templateSaveRow}>
        <TextInput
          placeholder="Nombre de plantilla"
          value={templateName}
          onChangeText={setTemplateName}
          style={[styles.input, styles.flexButton]}
        />
        <TouchableOpacity style={styles.tinyButton} onPress={saveTemplate}>
          <Text style={styles.tinyButtonText}>GUARDAR</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.participantGrid}>
        {visibleParticipants.map((p) => (
          <View key={p.username} style={styles.row}>
            {editingName === p.username ? (
              <>
                <TextInput
                  value={editValue}
                  onChangeText={setEditValue}
                  style={styles.rowInput}
                  autoFocus
                  onBlur={() => commitRename(p.username)}
                  onSubmitEditing={() => commitRename(p.username)}
                />
                <TouchableOpacity onPress={() => commitRename(p.username)}>
                  <Text>✅</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.rowName} numberOfLines={1}>
                {p.username}
              </Text>
            )}

            <View style={styles.rowMeta}>
              {p.weight > 1 && (
                <Text style={styles.weightBadge}>×{p.weight}</Text>
              )}
              <Text style={styles.percentText}>
                {Math.round(
                  (Math.max(1, Math.floor(p.weight)) / totalWeight) * 100,
                )}
                %
              </Text>
              <TouchableOpacity onPress={() => changeWeight(p.username, -1)}>
                <Text style={styles.weightBtn}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeWeight(p.username, 1)}>
                <Text style={styles.weightBtn}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEditingName(p.username);
                  setEditValue(p.username);
                  setAddError("");
                }}
              >
                <Text>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeParticipant(p.username)}>
                <Text style={{ color: "red" }}>❌</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {visibleParticipants.length === 0 && (
          <Text style={styles.emptyList}>
            {participants.length === 0
              ? "Sin participantes"
              : "Sin coincidencias"}
          </Text>
        )}
      </View>
    </>
  );

  if (isNarrow) {
    return (
      <View style={styles.containerNarrow}>
        <View style={styles.leftSideNarrow}>{leftContent}</View>
        <ScrollView
          style={styles.rightSideNarrow}
          contentContainerStyle={styles.rightSideContent}
        >
          {rightContent}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.leftSide}
        contentContainerStyle={styles.leftSideContent}
      >
        {leftContent}
      </ScrollView>
      <ScrollView
        style={styles.rightSide}
        contentContainerStyle={styles.rightSideContent}
      >
        {rightContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#ECE7E1",
    padding: 30,
    justifyContent: "center",
    alignItems: "stretch",
  },

  leftSide: {
    flex: 1.2,
  },

  leftSideContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },

  rightSide: {
    flex: 1,
    marginLeft: 40,
  },

  rightSideContent: {
    paddingVertical: 8,
    paddingRight: 4,
    paddingBottom: 40,
  },

  containerNarrow: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#ECE7E1",
    padding: 16,
    justifyContent: "flex-start",
    alignItems: "stretch",
  },

  leftSideNarrow: {
    alignItems: "center",
    width: "100%",
  },

  rightSideNarrow: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    marginTop: 24,
  },

  overlayContainer: {
    flex: 1,
    backgroundColor: "#ECE7E1",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },

  wheelContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  pointer: {
    position: "absolute",
    top: -2,
    alignSelf: "center",
    zIndex: 10,
  },

  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 24,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#3A2F26",
  },

  hubButton: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "#C5A582",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
  },

  hubButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 6,
    fontFamily: WHEEL_FONT,
    letterSpacing: 0.5,
  },

  winnerBox: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },

  winner: {
    fontSize: 22,
    fontWeight: "700",
  },

  statusText: {
    fontSize: 14,
    color: "#6B543F",
    fontWeight: "600",
    marginTop: 2,
  },

  historyBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },

  historyTitle: {
    fontSize: 12,
    color: "#777",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  historyList: {
    maxHeight: 120,
  },

  historyItem: {
    fontSize: 13,
    paddingVertical: 2,
    color: "#3A2F26",
  },

  historyActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  subsButton: {
    backgroundColor: "#C5A582",
    padding: 12,
    borderRadius: 6,
    minWidth: 120,
    alignItems: "center",
  },

  button: {
    marginTop: 12,
    backgroundColor: "#C5A582",
    padding: 12,
    borderRadius: 20,
    alignItems: "center",
  },

  flexButton: {
    flex: 1,
    marginTop: 0,
  },

  buttonsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    marginTop: 12,
    flexWrap: "wrap",
  },

  buttonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },

  tinyButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#E8DDCE",
    alignItems: "center",
    marginTop: 6,
  },

  tinyButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B543F",
  },

  freezeButton: {
    marginTop: 8,
    backgroundColor: "#888",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },

  freezeOn: {
    backgroundColor: "#C94B4B",
  },

  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "white",
    marginBottom: 10,
  },

  bulkInput: {
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },

  errorText: {
    color: "#C94B4B",
    fontSize: 12,
    marginBottom: 6,
  },

  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  rowName: {
    flex: 1,
    fontWeight: "600",
  },

  rowInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#fff",
    fontSize: 12,
  },

  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  weightBadge: {
    backgroundColor: "#C5A582",
    color: "#fff",
    fontSize: 10,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
    fontWeight: "700",
  },

  weightBtn: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8A6A4B",
    paddingHorizontal: 4,
  },

  percentText: {
    fontSize: 10,
    color: "#999",
    minWidth: 28,
    textAlign: "right",
  },

  emptyList: {
    color: "#999",
    fontStyle: "italic",
    marginTop: 12,
    textAlign: "center",
    width: "100%",
  },

  participantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    paddingBottom: 30,
  },

  sectionContainer: {
    marginBottom: 15,
    width: '100%',
  },

  sectionLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },

  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5A582",
    alignItems: "center",
  },

  modeButtonActive: {
    backgroundColor: "#C5A582",
  },

  modeButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7A5C40",
  },

  modeButtonTextActive: {
    color: "#fff",
  },

  spinsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  spinsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B543F",
  },

  templateWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
    alignItems: "center",
  },

  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  templateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B543F",
  },

  templateChipDelete: {
    fontSize: 12,
    color: "#C94B4B",
    fontWeight: "700",
  },

  templateSaveRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },

  secondaryButton: {
    backgroundColor: "#888",
    padding: 12,
    borderRadius: 6,
    minWidth: 120,
    alignItems: "center",
  },

  dangerButton: {
    backgroundColor: "#C94B4B",
    padding: 12,
    borderRadius: 6,
    minWidth: 120,
    alignItems: "center",
  },
});
