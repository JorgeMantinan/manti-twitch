import React, { useState, useRef, useEffect, useMemo } from "react";
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

import { useLocalSearchParams } from "expo-router";
import { io } from "socket.io-client";
import * as SecureStore from "expo-secure-store";

import { getSessionId } from "../utils/session";
import { API_CONFIG } from "../constants/api";
import { decodeToken } from "../services/auth";
import WheelSvg, { WheelSlice } from "../components/roulette/WheelSvg";
import BingoWinModal from "../components/BingoWinModal";

type Participant = {
  username: string;
  weight: number;
  isSub?: boolean;
  gifts?: number;
  paused?: boolean;
};

type WinnerRecord = {
  round: number;
  username: string;
  weight: number;
  at: number;
};

type Role = "viewer" | "mod" | "streamer";
type DrawMode = "replace" | "eliminate" | "prizes";
type FilterMode = "all" | "subs" | "followers";

interface SocketData {
  participant: {
    username: string;
    isSub: boolean;
    points: number;
    giftsSent: number;
  };
  totalCount: number;
}

const WHEEL_FONT = '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';

const MAX_SLICES = 120;

const STORAGE_PARTICIPANTS = "roulette_participants";
const STORAGE_TEMPLATES = "roulette_templates";
const STORAGE_PREFS = "roulette_prefs";

const ANTI_REPEAT_CYCLE: Record<number, number> = { 0: 2, 2: 5, 5: 10, 10: 0 };
const COUNTDOWN_CYCLE = [0, 30, 60, 120];

type Prefs = {
  spins?: number;
  soundOn?: boolean;
  modalOn?: boolean;
  dark?: boolean;
  anonOn?: boolean;
  announceOn?: boolean;
  antiRepeat?: number;
  countdownSec?: number;
  drawMode?: DrawMode;
  prizesMax?: number;
  filterMode?: FilterMode;
};

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

function qp(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (Array.isArray(v)) return String(v[0] ?? "");
  return v == null ? "" : String(v);
}

export default function SmartRoulette() {
  const params = useLocalSearchParams();

  const viewMode = qp(params, "view"); // "" | "overlay" | "mini"
  const role: Role = (qp(params, "role") as Role) || "viewer";

  const savedPrefs = useMemo<Prefs>(
    () => readStorage<Prefs>(STORAGE_PREFS, {}),
    [],
  );
  const URL_ALIASES: Record<string, string> = {
    drawMode: "mode",
    prizesMax: "prizes",
    modalOn: "modal",
    dark: "theme",
    anonOn: "anon",
    announceOn: "announce",
    filterMode: "filter",
    antiRepeat: "anti",
    countdownSec: "countdown",
  };
  const pref = <K extends keyof Prefs>(key: K, fallback: Prefs[K]): Prefs[K] => {
    const aliased = URL_ALIASES[String(key)];
    const urlVal = qp(params, String(key)) || (aliased ? qp(params, aliased) : "");
    if (urlVal !== "") {
      if (key === "spins") return Math.min(12, Math.max(3, Number(urlVal) || (fallback as number))) as Prefs[K];
      if (key === "antiRepeat") return ([0, 2, 5, 10].includes(Number(urlVal)) ? Number(urlVal) : fallback) as Prefs[K];
      if (key === "countdownSec") return (COUNTDOWN_CYCLE.includes(Number(urlVal)) ? Number(urlVal) : fallback) as Prefs[K];
      if (key === "prizesMax") return Math.min(10, Math.max(1, Number(urlVal) || (fallback as number))) as Prefs[K];
      if (key === "soundOn" || key === "modalOn" || key === "dark" || key === "anonOn" || key === "announceOn")
        return (urlVal !== "0") as Prefs[K];
      return urlVal as Prefs[K];
    }
    return savedPrefs[key] !== undefined ? savedPrefs[key] : fallback;
  };

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isNarrow = winWidth < 900;
  const isOverlay = viewMode === "overlay";
  const isMini = viewMode === "mini";
  const wheelSize = isMini
    ? Math.max(220, Math.min(winWidth - 48, 300))
    : Math.max(240, Math.min(winWidth - 60, winHeight * 0.55, 480));

  const socketRef = useRef<any>(null);
  const promptHandledRef = useRef(false);

  const parseInitialData = (): Participant[] | null => {
    if (!params.data) return null;
    try {
      const arr = JSON.parse(params.data as string);
      if (!Array.isArray(arr)) return null;
      return arr
        .map((p: any) => ({
          username: p.user_name || p.username || p.name,
          weight: Number(p.weight) > 0 ? Math.floor(Number(p.weight)) : 1,
          isSub: !!p.isSub,
          gifts: Number(p.gifts) || 0,
        }))
        .filter((p) => p.username);
    } catch {
      return null;
    }
  };

  const [participants, setParticipants] = useState<Participant[]>(() => {
    const fromUrl = parseInitialData();
    return fromUrl || [];
  });

  const [restorePrompt, setRestorePrompt] = useState<
    { list: Participant[]; at: number } | null
  >(null);

  const [winner, setWinner] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [keyword, setKeyword] = useState("!sorteo");
  const [streamer, setStreamer] = useState("");
  const streamerRef = useRef("default");

  // Draw settings
  const [drawMode, setDrawMode] = useState<DrawMode>(
    () => (pref("drawMode", "replace") as DrawMode) || "replace",
  );
  const [spins, setSpins] = useState<number>(() => Number(pref("spins", 6)));
  const [soundOn, setSoundOn] = useState<boolean>(() => !!pref("soundOn", true));
  const soundOnRef = useRef(soundOn);
  const [spinning, setSpinning] = useState(false);
  const [prizesMax, setPrizesMax] = useState<number>(() => Number(pref("prizesMax", 3)));
  const [antiRepeat, setAntiRepeat] = useState<number>(() => Number(pref("antiRepeat", 0)));
  const [duelOn, setDuelOn] = useState(false);
  const [duelA, setDuelA] = useState("");
  const [duelB, setDuelB] = useState("");

  // Rounds & history
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<WinnerRecord[]>([]);

  // Chat raffle extras
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [announceOn, setAnnounceOn] = useState<boolean>(() => !!pref("announceOn", false));
  const [countdownSec, setCountdownSec] = useState<number>(() => Number(pref("countdownSec", 0)));
  const [cdLeft, setCdLeft] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>(
    () => (pref("filterMode", "all") as FilterMode) || "all",
  );
  const [followerSet, setFollowerSet] = useState<Set<string> | null>(null);
  const [tokenLogin, setTokenLogin] = useState<string | null>(null);

  // Participant tools
  const [search, setSearch] = useState("");
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvVisible, setCsvVisible] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState("");
  const [lastRemoved, setLastRemoved] = useState<Participant | null>(null);
  const [templates, setTemplates] = useState<Record<string, Participant[]>>(() =>
    readStorage<Record<string, Participant[]>>(STORAGE_TEMPLATES, {}),
  );
  const [templateName, setTemplateName] = useState("");
  const [copied, setCopied] = useState<"link" | "results" | "log" | null>(null);

  // Extras
  const [modalOn, setModalOn] = useState<boolean>(() => !!pref("modalOn", false));
  const modalOnRef = useRef(modalOn);
  const [winModalVisible, setWinModalVisible] = useState(false);
  const [dark, setDark] = useState<boolean>(() => !!pref("dark", false));
  const [anonOn, setAnonOn] = useState<boolean>(() => !!pref("anonOn", false));
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [logOpen, setLogOpen] = useState(false);
  const [actionLog, setActionLog] = useState<{ at: string; text: string }[]>([]);

  const pushLog = (text: string) => {
    const at = new Date().toLocaleTimeString();
    setActionLog((prev) => [{ at, text }, ...prev].slice(0, 50));
  };

  // Persist prefs
  useEffect(() => {
    writeStorage(STORAGE_PREFS, {
      spins,
      soundOn,
      modalOn,
      dark,
      anonOn,
      announceOn,
      antiRepeat,
      countdownSec,
      drawMode,
      prizesMax,
      filterMode,
    } satisfies Prefs);
  }, [
    spins,
    soundOn,
    modalOn,
    dark,
    anonOn,
    announceOn,
    antiRepeat,
    countdownSec,
    drawMode,
    prizesMax,
    filterMode,
  ]);

  // Session restore prompt (only when not coming from ?data)
  useEffect(() => {
    if (Platform.OS !== "web" || params.data) return;
    const saved = readStorage<{ list?: Participant[]; at?: number } | Participant[]>(
      STORAGE_PARTICIPANTS,
      { list: [], at: 0 },
    );
    const list = Array.isArray(saved) ? saved : saved.list || [];
    const at = Array.isArray(saved) ? 0 : saved.at || 0;
    if (list.length > 0) {
      setRestorePrompt({ list, at });
    } else {
      promptHandledRef.current = true;
    }
  }, []);

  // Persist participants (with timestamp)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (participants.length === 0 && !promptHandledRef.current) return;
    writeStorage(STORAGE_PARTICIPANTS, { list: participants, at: Date.now() });
  }, [participants]);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    modalOnRef.current = modalOn;
  }, [modalOn]);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  /*
  TOKEN
  */

  const getToken = async () => {
    if (Platform.OS === "web") return localStorage.getItem("userToken");

    return await SecureStore.getItemAsync("userToken");
  };

  // JWT login (streamer channel resolution for followers/announce fallback)
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getToken();
      if (!token || !alive) return;
      const decoded: any = decodeToken(token);
      if (decoded?.login && alive) setTokenLogin(decoded.login);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

    socket.on("connect_error", () => {});

    socket.on("newParticipant", (data: SocketData) => {
      if (frozenRef.current || lockedRef.current) return;

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
            isSub: !!data.participant.isSub,
            gifts: data.participant.giftsSent || 0,
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

  const spinAnim = useRef(new Animated.Value(0)).current;
  const pointerAnim = useRef(new Animated.Value(0)).current;

  const rotation = spinAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ["0deg", "3600deg"],
  });

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
  POOL / FILTERS
  */

  const basePool = (): Participant[] => {
    let pool = participants.filter((p) => !p.paused);

    if (duelOn) {
      const set = new Set(
        [duelA.trim().toLowerCase(), duelB.trim().toLowerCase()].filter(Boolean),
      );
      pool = pool.filter((p) => set.has(p.username.toLowerCase()));
    }

    if (filterMode === "subs") {
      pool = pool.filter((p) => !!p.isSub);
    } else if (filterMode === "followers" && followerSet) {
      pool = pool.filter((p) => followerSet.has(p.username.toLowerCase()));
    }

    if (antiRepeat > 0) {
      const recent = new Set(
        history.slice(-antiRepeat).map((h) => h.username.toLowerCase()),
      );
      pool = pool.filter((p) => !recent.has(p.username.toLowerCase()));
    }

    return pool;
  };

  const buildVisualFrom = (pool: Participant[]): Participant[] => {
    const expanded: Participant[] = [];
    pool.forEach((p) => {
      const copies = Math.max(1, Math.floor(p.weight));
      for (let i = 0; i < copies; i++) expanded.push({ ...p });
    });
    for (let i = expanded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
    }
    if (expanded.length <= MAX_SLICES) return expanded;
    const slices: Participant[] = [];
    for (let i = 0; i < MAX_SLICES; i++) {
      slices.push(expanded[Math.floor(Math.random() * expanded.length)]);
    }
    return slices;
  };

  const [visualSlices, setVisualSlices] = useState<Participant[]>([]);
  useEffect(() => {
    setVisualSlices(buildVisualFrom(basePool()));
  }, [participants, duelOn, duelA, duelB, filterMode, followerSet, antiRepeat]);

  /*
  ANON LABELS
  */

  const anonMap = useMemo(() => {
    if (!anonOn) return {};
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const m: Record<string, string> = {};
    shuffled.forEach((p, i) => {
      m[p.username] = `Jugador ${i + 1}`;
    });
    return m;
  }, [anonOn, participants.length]);

  const labelFor = (username: string) => anonMap[username] || username;

  /*
  AVATARS
  */

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let alive = true;
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token || !participants.length) {
        if (alive) setAvatars({});
        return;
      }
      const logins = Array.from(
        new Set(participants.map((p) => p.username)),
      ).slice(0, 100);
      try {
        const res = await fetch(
          `${API_CONFIG.ENDPOINTS.AVATARS}?logins=${encodeURIComponent(logins.join(","))}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.avatars) setAvatars(data.avatars);
      } catch {}
    }, 800);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [participants]);

  /*
  FOLLOWERS FILTER
  */

  useEffect(() => {
    if (filterMode !== "followers" || role === "viewer") {
      setFollowerSet(null);
      return;
    }
    const nick = role === "mod" ? streamer.trim() : tokenLogin;
    if (!nick) return;

    let alive = true;
    (async () => {
      const token = await getToken();
      if (!token || !alive) return;
      try {
        const res = await fetch(API_CONFIG.ENDPOINTS.FOLLOWERS, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streamerNick: nick,
            startDate: "2010-01-01",
            endDate: new Date().toISOString().slice(0, 10),
          }),
        });
        const data = await res.json();
        if (!alive) return;
        if (Array.isArray(data)) {
          setFollowerSet(
            new Set(data.map((f: any) => String(f.user_name || "").toLowerCase())),
          );
        } else {
          setFollowerSet(new Set());
        }
      } catch {
        if (alive) setFollowerSet(new Set());
      }
    })();

    return () => {
      alive = false;
    };
  }, [filterMode, role, streamer, tokenLogin]);

  /*
  COUNTDOWN (chat raffle auto-close)
  */

  useEffect(() => {
    if (!running || countdownSec <= 0) {
      setCdLeft(0);
      return;
    }
    setCdLeft(countdownSec);
    const iv = setInterval(() => {
      setCdLeft((s) => {
        if (s <= 1) {
          clearInterval(iv);
          stopRaffle();
          setFrozen(true);
          pushLog("Cierre automático de la rifa");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running, countdownSec]);

  /*
  PARTICIPANTS
  */

  const addParticipant = () => {
    const name = newUser.trim();
    if (!name || locked) return;

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
    pushLog(`${name} entró a la lista`);
  };

  const addBulk = () => {
    if (locked) return;
    const names = bulkText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;

    let added = 0;
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
      added = toAdd.length;
      return [...prev, ...toAdd];
    });

    setBulkText("");
    pushLog(`Lista masiva: ${names.length} nombres`);
  };

  const removeParticipant = (name: string) => {
    if (locked) return;
    const removed = participants.find((p) => p.username === name);
    setParticipants((prev) => prev.filter((u) => u.username !== name));
    if (removed) {
      setLastRemoved(removed);
      pushLog(`${name} salió de la lista`);
    }
  };

  const restoreRemoved = () => {
    if (!lastRemoved || locked) return;
    const r = lastRemoved;
    setParticipants((prev) =>
      prev.some((p) => p.username.toLowerCase() === r.username.toLowerCase())
        ? prev
        : [...prev, r],
    );
    setLastRemoved(null);
    pushLog(`${r.username} restaurado`);
  };

  const clearParticipants = () => {
    if (locked) return;
    if (Platform.OS === "web" && !window.confirm("¿Vaciar la lista?")) return;
    setParticipants([]);
    setLastRemoved(null);
    setWinner(null);
    setRound(0);
    setHistory([]);
    pushLog("Lista vaciada");
  };

  const changeWeight = (name: string, delta: number) => {
    if (locked) return;
    setParticipants((prev) =>
      prev.map((p) =>
        p.username === name
          ? { ...p, weight: Math.min(99, Math.max(1, p.weight + delta)) }
          : p,
      ),
    );
  };

  const togglePause = (name: string) => {
    if (locked) return;
    setParticipants((prev) =>
      prev.map((p) =>
        p.username === name ? { ...p, paused: !p.paused } : p,
      ),
    );
  };

  const commitRename = (oldName: string) => {
    const name = editValue.trim();
    setEditingName(null);
    if (!name || name === oldName || locked) return;

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
    pushLog(`${oldName} renombrado como ${name}`);
  };

  /*
  TEMPLATES
  */

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name || locked) return;

    setTemplates((prev) => {
      const next = { ...prev, [name]: participants.map((p) => ({ ...p })) };
      writeStorage(STORAGE_TEMPLATES, next);
      return next;
    });
    setTemplateName("");
    pushLog(`Plantilla "${name}" guardada`);
  };

  const loadTemplate = (name: string) => {
    const t = templates[name];
    if (!t || locked) return;
    setParticipants(t.map((p) => ({ ...p })));
    setWinner(null);
    pushLog(`Plantilla "${name}" cargada`);
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
  SHARE, CSV & LOG
  */

  const flashCopied = (what: "link" | "results" | "log") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyShareLink = async () => {
    if (Platform.OS !== "web") return;

    const payload = participants.map((p) => ({
      user_name: p.username,
      weight: p.weight,
      isSub: p.isSub,
      gifts: p.gifts,
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

  const copyLog = async () => {
    if (Platform.OS !== "web") return;
    const lines = actionLog.map((l) => `${l.at} ${l.text}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      flashCopied("log");
    } catch {}
  };

  const exportCsv = () => {
    if (Platform.OS !== "web") return;
    const lines = ["nombre,peso,subs,regalos,pausado"];
    participants.forEach((p) =>
      lines.push(
        `${p.username},${p.weight},${p.isSub ? 1 : 0},${p.gifts || 0},${p.paused ? 1 : 0}`,
      ),
    );
    lines.push("", "ronda,ganador");
    history.forEach((h) => lines.push(`${h.round},${h.username}`));

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ruleta.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    pushLog("CSV exportado");
  };

  const importCsv = () => {
    if (locked) return;
    const rows = csvText
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (!rows.length) return;

    const parsed: Participant[] = [];
    for (const row of rows) {
      if (row.toLowerCase().startsWith("nombre,")) continue;
      const [name, w] = row.split(",");
      const clean = (name || "").trim();
      if (!clean) continue;
      parsed.push({
        username: clean,
        weight: Math.min(99, Math.max(1, Number(w) || 1)),
      });
    }

    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.username.toLowerCase()));
      const add = parsed.filter(
        (p) => !existing.has(p.username.toLowerCase()),
      );
      return [...prev, ...add];
    });
    setCsvText("");
    setCsvVisible(false);
    pushLog(`CSV importado: ${parsed.length} filas`);
  };

  /*
  UNDO LAST WINNER
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
    pushLog(`Ganador anulado: ${last.username}`);
  };

  /*
  ANIMATION
  */

  const animateSpin = (
    winnerName: string,
    visual: Participant[],
    mode: DrawMode,
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
        {
          round: prev.length + 1,
          username: winnerName,
          weight: winnerWeight,
          at: Date.now(),
        },
      ]);
      pushLog(`Ganó ${winnerName}`);

      if (announceOn && role !== "viewer" && socketRef.current) {
        const ch = role === "mod" ? streamer.trim() : undefined;
        socketRef.current.emit("roulette:announce", {
          winner: winnerName,
          channel: ch || undefined,
        });
      }

      if (modalOnRef.current) setWinModalVisible(true);

      if (mode !== "replace") {
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
  BACKEND (chat raffle)
  */

  const startRaffle = async () => {
    if (role === "viewer" || locked) return;

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
    pushLog("Rifa del chat iniciada");
  };

  const stopRaffle = async () => {
    if (role === "viewer") return;

    const token = await getToken();

    const res = await fetch(API_CONFIG.ENDPOINTS.RAFFLE_STOP, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    const parsed: Participant[] = (data.data || []).map((p: any) => ({
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
    pushLog("Rifa del chat parada");
  };

  /*
  LOAD SUBSCRIBERS (streamer only)
  */

  const fetchSubs = async () => {
    if (role !== "streamer" || locked) return;

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
      isSub: true,
    }));

    let added = 0;
    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.username.toLowerCase()));
      const newOnes = parsed.filter(
        (p) => p.username && !existing.has(p.username.toLowerCase()),
      );
      added = newOnes.length;
      return [...prev, ...newOnes];
    });
    pushLog(`Suscriptores cargados: ${added}`);
  };

  /*
  PICK WINNER
  */

  const prizesExhausted =
    drawMode === "prizes" && history.length >= prizesMax;

  const pickWinner = async () => {
    if (spinning || prizesExhausted) return;

    setRunning(false);

    const usingBackend = running;

    const pool = usingBackend ? participants.filter((p) => !p.paused) : basePool();

    if (pool.length === 0) {
      pushLog("Sin participantes para sortear");
      return;
    }

    let winnerUser: Participant;
    let visual: Participant[];

    if (!usingBackend) {
      const weighted = buildVisualFrom(pool);
      visual = weighted;
      winnerUser = weighted[Math.floor(Math.random() * weighted.length)];
    } else {
      const token = await getToken();

      const res = await fetch(API_CONFIG.ENDPOINTS.PICK_WINNER, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!data?.winner?.username) {
        setRunning(false);
        return;
      }

      winnerUser = {
        username: data.winner.username,
        weight: 1,
      };
      visual = buildVisualFrom(participants.filter((p) => !p.paused));
    }

    if (!winnerUser) return;

    const original = participants.find(
      (p) => p.username.toLowerCase() === winnerUser.username.toLowerCase(),
    );

    setVisualSlices(visual);
    animateSpin(winnerUser.username, visual, drawMode, original?.weight ?? 1);
  };

  /*
  DERIVED
  */

  const totalWeight =
    participants.reduce((s, p) => s + Math.max(1, Math.floor(p.weight)), 0) || 1;

  const visibleParticipants = search.trim()
    ? participants.filter(
        (p) =>
          p.username.toLowerCase().includes(search.trim().toLowerCase()) ||
          labelFor(p.username).toLowerCase().includes(search.trim().toLowerCase()),
      )
    : participants;

  const templateNames = Object.keys(templates);

  const winCounts = useMemo(() => {
    const m: Record<string, number> = {};
    history.forEach((h) => {
      m[h.username] = (m[h.username] || 0) + 1;
    });
    return m;
  }, [history]);

  const duelResolved = (() => {
    if (!duelOn) return true;
    const names = [duelA.trim().toLowerCase(), duelB.trim().toLowerCase()];
    if (!names[0] || !names[1]) return false;
    return names.every((n) =>
      participants.some((p) => p.username.toLowerCase() === n),
    );
  })();

  const wheelSlices: WheelSlice[] = visualSlices.map((p) => ({
    label: labelFor(p.username),
    real: p.username,
    avatar: avatars[p.username],
  }));

  /*
  RENDER BLOCKS
  */

  const wheelBlock = (
    <View
      style={[styles.wheelContainer, { width: wheelSize, height: wheelSize }]}
    >
      <Animated.View
        style={{
          transform: [{ rotate: rotation }, { perspective: 900 }],
        }}
      >
        <WheelSvg
          slices={wheelSlices}
          winner={winner}
          size={wheelSize}
          dark={dark}
        />
      </Animated.View>

      <Animated.View
        style={[styles.pointer, { transform: [{ translateY: pointerAnim }] }]}
      >
        <View style={styles.pointerTriangle} />
      </Animated.View>

      <TouchableOpacity
        style={[styles.hubButton, (spinning || prizesExhausted) && { opacity: 0.6 }]}
        onPress={pickWinner}
        activeOpacity={0.8}
      >
        <Text style={styles.hubButtonText}>GIRAR RULETA</Text>
      </TouchableOpacity>
    </View>
  );

  const winnerBlock = (
    <View style={styles.winnerBox}>
      {winner ? <Text style={[styles.winner, dark && styles.textLight]}>🏆 {winner}</Text> : null}
    </View>
  );

  const statusBlock = (
    <Text style={[styles.statusText, dark && styles.textMuted]}>
      {prizesExhausted
        ? "¡PREMIOS AGOTADOS!"
        : round === 0
          ? "¡Suerte!"
          : drawMode === "eliminate"
            ? `Ronda ${round} · Quedan ${participants.length}`
            : drawMode === "prizes"
              ? `Premio ${history.length}/${prizesMax}`
              : `Ronda ${round}`}
    </Text>
  );

  const historyBlock =
    history.length > 0 ? (
      <View style={[styles.historyBox, dark && styles.historyBoxDark]}>
        <Text style={styles.historyTitle}>Historial</Text>
        <ScrollView style={styles.historyList}>
          {[...history].reverse().map((h) => {
            const place = history.indexOf(h) + 1;
            return (
              <Text
                key={`${h.round}-${h.at}`}
                style={[styles.historyItem, dark && styles.textLight]}
              >
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
          {drawMode !== "replace" && history.length > 0 && (
            <TouchableOpacity style={styles.tinyButton} onPress={undoLastWinner}>
              <Text style={styles.tinyButtonText}>↩ ÚLTIMO</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ) : null;

  const overlayBlock = (
    <View
      style={
        isOverlay
          ? styles.overlayContainer
          : styles.miniContainer
      }
    >
      {!isOverlay && <Text style={[styles.title, dark && styles.textLight]}>Smart Twitch Roulette</Text>}
      {wheelBlock}
      {winnerBlock}
      {statusBlock}
      {!isOverlay && historyBlock}
    </View>
  );

  if (isOverlay || isMini) return overlayBlock;

  const tinyBtn = (label: string, onPress: () => void, active?: boolean) => (
    <TouchableOpacity
      style={[styles.tinyButton, active && styles.tinyButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tinyButtonText, active && styles.tinyTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const inputStyle = dark ? [styles.input, styles.inputDark] : styles.input;

  const rightContent = (
    <>
      {/* SETTINGS */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionLabel, dark && styles.textMuted]}>Modo de sorteo</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, drawMode === "replace" && styles.modeButtonActive]}
            onPress={() => setDrawMode("replace")}
          >
            <Text
              style={[styles.modeButtonText, drawMode === "replace" && styles.modeButtonTextActive]}
            >
              CON REEMPLAZO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, drawMode === "eliminate" && styles.modeButtonActive]}
            onPress={() => setDrawMode("eliminate")}
          >
            <Text
              style={[styles.modeButtonText, drawMode === "eliminate" && styles.modeButtonTextActive]}
            >
              ELIMINACIÓN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, drawMode === "prizes" && styles.modeButtonActive]}
            onPress={() => setDrawMode("prizes")}
          >
            <Text
              style={[styles.modeButtonText, drawMode === "prizes" && styles.modeButtonTextActive]}
            >
              PREMIOS
            </Text>
          </TouchableOpacity>
        </View>

        {drawMode === "prizes" && (
          <View style={styles.spinsRow}>
            <Text style={[styles.spinsLabel, dark && styles.textLight]}>Premios: {prizesMax}</Text>
            {tinyBtn("−", () => setPrizesMax((s) => Math.max(1, s - 1)))}
            {tinyBtn("+", () => setPrizesMax((s) => Math.min(10, s + 1)))}
          </View>
        )}

        <View style={styles.spinsRow}>
          <Text style={[styles.spinsLabel, dark && styles.textLight]}>Vueltas: {spins}</Text>
          {tinyBtn("−", () => setSpins((s) => Math.max(3, s - 1)))}
          {tinyBtn("+", () => setSpins((s) => Math.min(12, s + 1)))}
          {tinyBtn(soundOn ? "🔊 SONIDO" : "🔇 MUDO", () => setSoundOn((s) => !s))}
          {tinyBtn(
            antiRepeat > 0 ? `NO REPETIR: ${antiRepeat}` : "NO REPETIR: OFF",
            () => setAntiRepeat((n) => ANTI_REPEAT_CYCLE[n] ?? 0),
            antiRepeat > 0,
          )}
        </View>

        <View style={styles.spinsRow}>
          {tinyBtn(modalOn ? "MODAL: ON" : "MODAL: OFF", () => setModalOn((s) => !s), modalOn)}
          {tinyBtn(dark ? "🌙 OSCURO" : "☀️ CLARO", () => setDark((s) => !s), dark)}
          {tinyBtn(anonOn ? "🎭 ANÓNIMO: ON" : "🎭 ANÓNIMO", () => setAnonOn((s) => !s), anonOn)}
        </View>

        {tinyBtn(duelOn ? "⚔️ DUELO: ON" : "⚔️ DUELO", () => setDuelOn((s) => !s), duelOn)}
        {duelOn && (
          <View style={styles.sectionContainer}>
            <TextInput
              style={inputStyle}
              placeholder="Jugador A"
              value={duelA}
              onChangeText={setDuelA}
            />
            <TextInput
              style={inputStyle}
              placeholder="Jugador B"
              value={duelB}
              onChangeText={setDuelB}
            />
            {!duelResolved && (
              <Text style={styles.errorText}>Ambos deben existir en la lista</Text>
            )}
          </View>
        )}
      </View>

      {role !== "viewer" && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionLabel, dark && styles.textMuted]}>Filtro</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, filterMode === "all" && styles.modeButtonActive]}
              onPress={() => setFilterMode("all")}
            >
              <Text style={[styles.modeButtonText, filterMode === "all" && styles.modeButtonTextActive]}>
                TODOS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, filterMode === "subs" && styles.modeButtonActive]}
              onPress={() => setFilterMode("subs")}
            >
              <Text style={[styles.modeButtonText, filterMode === "subs" && styles.modeButtonTextActive]}>
                SOLO SUBS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, filterMode === "followers" && styles.modeButtonActive]}
              onPress={() => setFilterMode("followers")}
            >
              <Text style={[styles.modeButtonText, filterMode === "followers" && styles.modeButtonTextActive]}>
                SEGUIDORES
              </Text>
            </TouchableOpacity>
          </View>
          {filterMode === "followers" && (
            <Text style={[styles.spinsLabel, dark && styles.textMuted]}>
              {followerSet
                ? `${followerSet.size} seguidores cargados`
                : "Cargando seguidores..."}
            </Text>
          )}
        </View>
      )}

      {role === "streamer" && (
        <View style={styles.sectionContainer}>
          <TouchableOpacity style={styles.subsButton} onPress={fetchSubs} disabled={locked}>
            <Text style={styles.buttonText}>OBTENER SUSCRIPTORES</Text>
          </TouchableOpacity>
        </View>
      )}

      {role !== "viewer" && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionLabel, dark && styles.textMuted]}>Rifa del chat</Text>
          {role === "mod" && (
            <TextInput
              style={inputStyle}
              placeholder="Streamer channel"
              value={streamer}
              onChangeText={setStreamer}
              editable={!locked}
            />
          )}
          <View>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              placeholder="!sorteo"
              value={keyword}
              onChangeText={setKeyword}
              editable={!locked}
            />
            {!running ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={startRaffle} disabled={locked}>
                <Text style={styles.buttonText}>Obtener gente del chat</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.dangerButton} onPress={stopRaffle}>
                <Text style={styles.buttonText}>Parar de obtener</Text>
              </TouchableOpacity>
            )}
            <View style={styles.spinsRow}>
              {tinyBtn(
                frozen ? "CHAT CONGELADO" : "CONGELAR CHAT",
                () => setFrozen((f) => !f),
                frozen,
              )}
              {tinyBtn(
                announceOn ? "💬 AVISO: ON" : "💬 AVISO: OFF",
                () => setAnnounceOn((s) => !s),
                announceOn,
              )}
              {tinyBtn(
                countdownSec > 0 ? `CIERRE: ${countdownSec}s` : "CIERRE: OFF",
                () =>
                  setCountdownSec((s) => {
                    const idx = COUNTDOWN_CYCLE.indexOf(s);
                    return COUNTDOWN_CYCLE[(idx + 1) % COUNTDOWN_CYCLE.length];
                  }),
                countdownSec > 0,
              )}
            </View>
            {running && cdLeft > 0 && (
              <Text style={[styles.spinsLabel, dark && styles.textLight]}>
                Cierre en {Math.floor(cdLeft / 60)}:{String(cdLeft % 60).padStart(2, "0")}
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.listHeaderRow}>
        <Text style={[styles.listTitle, dark && styles.textLight]}>
          Participants ({participants.length})
        </Text>
        {tinyBtn(locked ? "🔓 LISTA" : "🔒 BLOQUEAR", () => setLocked((l) => !l), locked)}
      </View>

      {restorePrompt && (
        <View style={[styles.historyBox, dark && styles.historyBoxDark]}>
          <Text style={[styles.historyItem, dark && styles.textLight]}>
            Restaurar lista anterior ({restorePrompt.list.length} ·{" "}
            {restorePrompt.at
              ? new Date(restorePrompt.at).toLocaleString()
              : "sin fecha"}
            )
          </Text>
          <View style={styles.historyActions}>
            <TouchableOpacity
              style={styles.tinyButton}
              onPress={() => {
                promptHandledRef.current = true;
                setParticipants(restorePrompt.list.map((p) => ({ ...p })));
                setRestorePrompt(null);
              }}
            >
              <Text style={styles.tinyButtonText}>RESTAURAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tinyButton}
              onPress={() => {
                promptHandledRef.current = true;
                writeStorage(STORAGE_PARTICIPANTS, { list: [], at: 0 });
                setRestorePrompt(null);
              }}
            >
              <Text style={styles.tinyButtonText}>DESCARTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TextInput
        placeholder="Add participant"
        value={newUser}
        onChangeText={(t) => {
          setNewUser(t);
          if (addError) setAddError("");
        }}
        style={dark ? [styles.input, styles.inputDark] : styles.input}
        editable={!locked}
      />
      {!!addError && <Text style={styles.errorText}>{addError}</Text>}

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.button, styles.flexButton]}
          onPress={addParticipant}
          disabled={locked}
        >
          <Text style={styles.buttonText}>Añadir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.flexButton, { backgroundColor: "#999" }]}
          onPress={clearParticipants}
          disabled={locked}
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

      <View style={styles.spinsRow}>
        {lastRemoved && (
          <TouchableOpacity style={styles.tinyButton} onPress={restoreRemoved}>
            <Text style={styles.tinyButtonText}>
              ↩ RESTAURAR {lastRemoved.username}
            </Text>
          </TouchableOpacity>
        )}
        {tinyBtn(bulkVisible ? "OCULTAR LISTA" : "LISTA MASIVA", () => setBulkVisible((v) => !v), bulkVisible)}
        {tinyBtn(csvVisible ? "OCULTAR CSV" : "CSV", () => setCsvVisible((v) => !v), csvVisible)}
        {tinyBtn("EXPORTAR", exportCsv)}
        {tinyBtn(`REGISTRO (${actionLog.length})`, () => setLogOpen((v) => !v), logOpen)}
      </View>

      {bulkVisible && (
        <View style={styles.sectionContainer}>
          <TextInput
            multiline
            placeholder="Nombres (uno por línea o separados por coma)"
            value={bulkText}
            onChangeText={setBulkText}
            style={[dark ? [styles.input, styles.inputDark] : styles.input, styles.bulkInput]}
            editable={!locked}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={addBulk} disabled={locked}>
            <Text style={styles.buttonText}>AGREGAR LISTA</Text>
          </TouchableOpacity>
        </View>
      )}

      {csvVisible && (
        <View style={styles.sectionContainer}>
          <TextInput
            multiline
            placeholder="Pega CSV (nombre,peso)"
            value={csvText}
            onChangeText={setCsvText}
            style={[dark ? [styles.input, styles.inputDark] : styles.input, styles.bulkInput]}
            editable={!locked}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={importCsv} disabled={locked}>
            <Text style={styles.buttonText}>IMPORTAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {logOpen && (
        <View style={[styles.historyBox, dark && styles.historyBoxDark]}>
          <View style={styles.historyActions}>
            <Text style={styles.historyTitle}>Registro</Text>
            <TouchableOpacity style={styles.tinyButton} onPress={copyLog}>
              <Text style={styles.tinyButtonText}>
                {copied === "log" ? "COPIADO ✓" : "COPIAR"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.historyList}>
            {actionLog.map((l, i) => (
              <Text
                key={`${l.at}-${i}`}
                style={[styles.historyItem, dark && styles.textLight]}
              >
                {l.at} · {l.text}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      <TextInput
        placeholder="Buscar jugador..."
        value={search}
        onChangeText={setSearch}
        style={dark ? [styles.input, styles.inputDark] : styles.input}
      />

      {templateNames.length > 0 && (
        <View style={styles.templateWrap}>
          {templateNames.map((name) => (
            <View
              key={name}
              style={[styles.templateChip, dark && styles.templateChipDark]}
            >
              <TouchableOpacity onPress={() => loadTemplate(name)}>
                <Text style={[styles.templateChipText, dark && styles.textLight]}>
                  {name}
                </Text>
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
          style={[dark ? [styles.input, styles.inputDark] : styles.input, styles.flexButton]}
          editable={!locked}
        />
        <TouchableOpacity style={styles.tinyButton} onPress={saveTemplate} disabled={locked}>
          <Text style={styles.tinyButtonText}>GUARDAR</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.participantGrid}>
        {visibleParticipants.map((p) => (
          <View
            key={p.username}
            style={[
              styles.row,
              dark && styles.rowDark,
              p.paused && styles.rowPaused,
            ]}
          >
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
              <Text
                style={[styles.rowName, dark && styles.textLight]}
                numberOfLines={1}
              >
                {labelFor(p.username)}
              </Text>
            )}

            <View style={styles.rowMeta}>
              {!!p.isSub && <Text>⭐</Text>}
              {!!p.gifts && <Text>🎁{p.gifts > 1 ? p.gifts : ""}</Text>}
              {!!winCounts[p.username] && (
                <Text style={styles.winBadge}>👑{winCounts[p.username]}</Text>
              )}
              {p.weight > 1 && <Text style={styles.weightBadge}>×{p.weight}</Text>}
              <Text style={styles.percentText}>
                {Math.round((Math.max(1, Math.floor(p.weight)) / totalWeight) * 100)}%
              </Text>
              {tinyBtn(p.paused ? "▶️" : "⏸️", () => togglePause(p.username))}
              {tinyBtn("−", () => changeWeight(p.username, -1))}
              {tinyBtn("+", () => changeWeight(p.username, 1))}
              <TouchableOpacity
                onPress={() => {
                  setEditingName(p.username);
                  setEditValue(p.username);
                  setAddError("");
                }}
                disabled={locked}
              >
                <Text>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeParticipant(p.username)}
                disabled={locked}
              >
                <Text style={{ color: "red" }}>❌</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {visibleParticipants.length === 0 && (
          <Text style={[styles.emptyList, dark && styles.textMuted]}>
            {participants.length === 0
              ? "Sin participantes"
              : "Sin coincidencias"}
          </Text>
        )}
      </View>
    </>
  );

  const leftContent = (
    <>
      <Text style={[styles.title, dark && styles.textLight]}>Smart Twitch Roulette</Text>

      {wheelBlock}
      {winnerBlock}
      {statusBlock}
      {historyBlock}
    </>
  );

  const winModal = (
    <BingoWinModal
      visible={winModalVisible}
      title="¡GANADOR!"
      player={winner || ""}
      onClose={() => setWinModalVisible(false)}
    />
  );

  if (isNarrow) {
    return (
      <View style={[styles.containerNarrow, dark && styles.containerDark]}>
        <View style={styles.leftSideNarrow}>{leftContent}</View>
        <ScrollView
          style={styles.rightSideNarrow}
          contentContainerStyle={styles.rightSideContent}
        >
          {rightContent}
        </ScrollView>
        {winModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
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
      {winModal}
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

  containerDark: {
    backgroundColor: "#1C1C1E",
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

  miniContainer: {
    flex: 1,
    backgroundColor: "#ECE7E1",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 24,
    padding: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
    color: "#2A2A2A",
  },

  textLight: {
    color: "#F2EDE6",
  },

  textMuted: {
    color: "#999",
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
    color: "#2A2A2A",
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

  historyBoxDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
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
    alignItems: "center",
    flexWrap: "wrap",
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

  tinyButtonActive: {
    backgroundColor: "#C5A582",
  },

  tinyButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B543F",
  },

  tinyTextActive: {
    color: "#fff",
  },

  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },

  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    color: "#2A2A2A",
  },

  input: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "white",
    marginBottom: 10,
  },

  inputDark: {
    backgroundColor: "#2C2C2E",
    borderColor: "#444",
    color: "#F2EDE6",
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

  rowDark: {
    backgroundColor: "#2C2C2E",
    borderColor: "#444",
  },

  rowPaused: {
    opacity: 0.45,
  },

  rowName: {
    flex: 1,
    fontWeight: "600",
    color: "#2A2A2A",
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
    gap: 5,
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

  winBadge: {
    backgroundColor: "#8A6A4B",
    color: "#fff",
    fontSize: 10,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
    fontWeight: "700",
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
    width: "100%",
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
    flexWrap: "wrap",
  },

  modeButton: {
    flexGrow: 1,
    minWidth: 90,
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
    flexWrap: "wrap",
    marginTop: 4,
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

  templateChipDark: {
    backgroundColor: "#2C2C2E",
    borderColor: "#444",
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
