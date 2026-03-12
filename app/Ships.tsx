import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";
import { io } from "socket.io-client";

const { width, height } = Dimensions.get("window");

const STORAGE_KEY = "participantes_barcos";

const TICK_RATE = 50;
const BULLET_SPEED = 24;
const SHIP_SPEED_MULT = 8;
const BULLET_SIZE = 10;

const FONDO_OCEANO = require("../assets/images/sea-waves.jpg");

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

export default function Ships() {
  const socketRef = useRef<any>(null);  
  const params = useLocalSearchParams();

  const [gameState, setGameState] = useState<"setup" | "playing">("setup");

  const [participants, setParticipants] = useState<any[]>([]);
  const [inputName, setInputName] = useState("");
  const [isSubInput, setIsSubInput] = useState(false);

  const [ships, setShips] = useState<any[]>([]);
  const [bullets, setBullets] = useState<any[]>([]);
  const [winner, setWinner] = useState<any>(null);
  const [finalRank, setFinalRank] = useState<any[]>([]);

  const shipsRef = useRef<any[]>([]);
  const bulletsRef = useRef<any[]>([]);

  const role:Role = (params.role as Role) || "viewer";
  // const [role, setRole] = useState<Role>("viewer");

  const [streamer, setStreamer] = useState("");
  const [raffleWord, setRaffleWord] = useState("!sorteo");
  const [raffleRunning, setRaffleRunning] = useState(false);

  /*
  TOKEN
  */

  const getToken = async () => {
    if (Platform.OS === "web") return localStorage.getItem("userToken");
    return await SecureStore.getItemAsync("userToken");
  };

  /*
  JWT PARSER
  */

  // const parseJWT = (token: string) => {
  //   try {
  //     const payload = token.split(".")[1];
  //     return JSON.parse(atob(payload));
  //   } catch {
  //     return null;
  //   }
  // };

  /*
  ROLE SYSTEM
  */

  // const determineRole = (decoded: any): Role => {
  //   if (!decoded) return "viewer";

  //   let scopes: string[] = [];

  //   if (Array.isArray(decoded.scopes)) scopes = decoded.scopes;
  //   else if (typeof decoded.scopes === "string")
  //     scopes = decoded.scopes.split(" ");
  //   else if (typeof decoded.scope === "string")
  //     scopes = decoded.scope.split(" ");

  //   if (scopes.includes("channel:read:subscriptions")) return "streamer";

  //   if (scopes.includes("moderator:read:followers")) return "mod";

  //   return "viewer";
  // };

  // const checkAuth = async () => {
  //   const token = await getToken();
  //   if (!token) return;

  //   const decoded = parseJWT(token);
  //   setRole(determineRole(decoded));
  // };

  // useEffect(() => {
  //   checkAuth();
  // }, []);

  /*
  STORAGE LOAD
  */

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

  /*
  STORAGE SAVE
  */

  useEffect(() => {
    const saveData = async () => {
      const data = JSON.stringify(participants);

      if (Platform.OS === "web") localStorage.setItem(STORAGE_KEY, data);
      else await AsyncStorage.setItem(STORAGE_KEY, data);
    };

    saveData();
  }, [participants]);

  /*
   3. SOCKETS listener
  */
  useEffect(() => {
    socketRef.current = io("https://manti-twitch-backend.onrender.com");
    socketRef.current.emit("joinRoom", {
      streamer: role === "mod" ? streamer : "default"
    });

    // Añadimos el tipo aquí (data: SocketData)
    socketRef.current.on("newParticipant", (data: SocketData) => {
      setParticipants((prev) => {
        const exists = prev.some(
          (p) => p.name.toLowerCase() === data.participant.username.toLowerCase()
        );
        if (exists) return prev;

        return [
          ...prev,
          {
            name: data.participant.username,
            isSub: data.participant.isSub,
          },
        ];
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [streamer]);

  /*
  PARTICIPANTS
  */

  const addParticipant = () => {
    if (!inputName.trim()) return;

    setParticipants(prev => {
      const exists = prev.some(
        p => p.name.toLowerCase() === inputName.trim().toLowerCase()
      );

      if (exists) return prev;

      return [
        ...prev,
        {
          name: inputName.trim(),
          isSub: isSubInput
        }
      ];
    });

    setInputName("");
  };

  const removeParticipant = (index: number) => {
    setParticipants((p) => p.filter((_, i) => i !== index));
  };

  /*
  RAFFLE
  */

  const startRaffle = async () => {
    if (role === "viewer") return;

    const token = await getToken();

    await fetch("https://manti-twitch-backend.onrender.com/api/raffle/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: raffleWord,
        selectedStreamer: role === "mod" ? streamer : undefined,
      }),
    });

    setRaffleRunning(true);
  };

  const stopRaffle = async () => {
    const token = await getToken();

    const res = await fetch(
      "https://manti-twitch-backend.onrender.com/api/raffle/stop",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

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

  /*
  SUBS
  */

  const fetchSubs = async () => {
    if (role !== "streamer") return;

    const token = await getToken();

    const res = await fetch(
      "https://manti-twitch-backend.onrender.com/api/subs",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    const parsed = data.subscribers.map((s: any) => ({
      name: s.user_name,
      isSub: true,
    }));

    setParticipants((prev) => {
      const existing = new Set(prev.map((p) => p.name.toLowerCase()));

      const newOnes = parsed.filter(
        (p: any) => !existing.has(p.name.toLowerCase())
      );

      return [...prev, ...newOnes];
    });
  };

  /*
  CLEAR
  */

  const clearAll = async () => {
    setParticipants([]);

    if (Platform.OS === "web") localStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  };

  /*
  START BATTLE
  */

  const startBattle = () => {
    if (participants.length < 2) return;

    const initialShips = participants.map((p, i) => ({
      id: `ship-${i}-${Date.now()}`,
      name: p.name,
      isSub: p.isSub,

      hp: p.isSub ? 160 : 120,
      maxHp: p.isSub ? 160 : 120,

      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 200) + 100,

      vx: (Math.random() - 0.5) * SHIP_SPEED_MULT,
      vy: (Math.random() - 0.5) * SHIP_SPEED_MULT,

      kills: 0,
      color: p.isSub ? "#FFD700" : "#FFF",
    }));

    setShips(initialShips);
    shipsRef.current = initialShips;

    setBullets([]);
    bulletsRef.current = [];

    setWinner(null);

    setGameState("playing");
  };

  /*
  GAME LOOP
  */

  useEffect(() => {
    if (gameState !== "playing" || winner) return;

    const interval = setInterval(() => {
      let allShips = [...shipsRef.current];
      let activeBullets = [...bulletsRef.current];

      activeBullets = activeBullets
        .map((b) => ({
          ...b,
          x: b.x + Math.cos(b.angle) * BULLET_SPEED,
          y: b.y + Math.sin(b.angle) * BULLET_SPEED,
        }))
        .filter((b) => b.x > 0 && b.x < width && b.y > 0 && b.y < height);

      const nextBullets: any[] = [];

      activeBullets.forEach((bullet) => {
        let hit = false;

        allShips.forEach((ship) => {
          if (!hit && ship.hp > 0 && ship.id !== bullet.ownerId) {
            const dist = Math.hypot(ship.x - bullet.x, ship.y - bullet.y);

            if (dist < 35) {
              hit = true;

              ship.hp -= bullet.isSub ? 18 : 15;

              if (ship.hp <= 0) {
                const owner = allShips.find((k) => k.id === bullet.ownerId);
                if (owner) owner.kills += 1;
              }
            }
          }
        });

        if (!hit) nextBullets.push(bullet);
      });

      const aliveShips = allShips.filter((s) => s.hp > 0);

      aliveShips.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;

        if (s.x <= 0 || s.x >= width - 40) s.vx *= -1;
        if (s.y <= 50 || s.y >= height - 100) s.vy *= -1;

        if (Math.random() > 0.92) {
          const targets = aliveShips.filter((e) => e.id !== s.id);

          if (targets.length > 0) {
            const target =
              targets[Math.floor(Math.random() * targets.length)];

            const angle = Math.atan2(target.y - s.y, target.x - s.x);

            nextBullets.push({
              x: s.x,
              y: s.y,
              angle,
              isSub: s.isSub,
              ownerId: s.id,
            });
          }
        }
      });

      if (aliveShips.length === 1 && allShips.length > 1) {
        setWinner(aliveShips[0]);
        setFinalRank(
          [...allShips].sort((a, b) => b.kills - a.kills).slice(0, 5),
        );
      }

      shipsRef.current = allShips;
      bulletsRef.current = nextBullets;

      setShips([...aliveShips]);
      setBullets(nextBullets);
    }, TICK_RATE);

    return () => clearInterval(interval);
  }, [gameState, winner]);

  /*
  SETUP SCREEN
  */

  if (gameState === "setup") {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.setupTitle}>Batalla Naval</Text>

        {role === "mod" && (
          <>
            <Text style={{ color: "#AAA", marginBottom: 4 }}>
              Canal donde hacer el raffle
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Nombre del streamer"
              value={streamer}
              onChangeText={setStreamer}
            />
          </>
        )}

        {role !== "viewer" && (
          <>
            <TextInput
              style={styles.textInput}
              placeholder="Keyword"
              value={raffleWord}
              onChangeText={setRaffleWord}
            />

            {!raffleRunning && (
              <TouchableOpacity style={styles.startBtn} onPress={startRaffle}>
                <Text style={styles.startBtnText}>START RAFFLE</Text>
              </TouchableOpacity>
            )}

            {raffleRunning && (
              <TouchableOpacity style={styles.startBtn} onPress={stopRaffle}>
                <Text style={styles.startBtnText}>STOP RAFFLE</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {role === "streamer" && (
          <TouchableOpacity style={styles.startBtn} onPress={fetchSubs}>
            <Text style={styles.startBtnText}>GET SUBS</Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputBox}>
          <TextInput
            style={styles.textInput}
            placeholder="Nombre"
            value={inputName}
            onChangeText={setInputName}
          />

          <TouchableOpacity
            style={[
              styles.typeToggle,
              isSubInput && { backgroundColor: "#FFD700" },
            ]}
            onPress={() => setIsSubInput(!isSubInput)}
          >
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>
              {isSubInput ? "👑 SUB" : "🚤"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={addParticipant}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.participantList}>
          {participants.map((p, i) => (
            <View key={i} style={styles.participantItem}>
              <Text style={{ color: p.isSub ? "#FFD700" : "#FFF" }}>
                {p.isSub ? "👑 " : "🚤 "} {p.name}
              </Text>

              <TouchableOpacity onPress={() => removeParticipant(i)}>
                <Text style={{ color: "#ff4444" }}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.startBtn} onPress={startBattle}>
          <Text style={styles.startBtnText}>INICIAR PELEA</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearBtnText}>BORRAR TODO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
  GAME SCREEN
  */

  return (
    <ImageBackground source={FONDO_OCEANO} style={styles.ocean}>
      {/* SCOREBOARD */}
      <View style={styles.scoreboard}>
        <Text style={styles.scoreTitle}>⚓ EN VIVO</Text>

        {ships
          .sort((a, b) => b.kills - a.kills)
          .slice(0, 3)
          .map((s, i) => (
            <Text key={i} style={[styles.scoreText, { color: s.color }]}>
              {s.name}: {s.kills}
            </Text>
          ))}
      </View>

      {ships.map((ship) => (
        <View
          key={ship.id}
          style={[styles.shipContainer, { left: ship.x, top: ship.y }]}
        >
          <Text style={[styles.shipName, { color: ship.color }]}>
            {ship.name}
          </Text>

          <View style={styles.hpBG}>
            <View
              style={[
                styles.hpFill,
                {
                  width: `${(ship.hp / ship.maxHp) * 100}%`,
                  backgroundColor: ship.isSub ? "#FFD700" : "#4caf50",
                },
              ]}
            />
          </View>

          <Text style={{ fontSize: ship.isSub ? 45 : 30 }}>
            {ship.isSub ? "🚢" : "🚤"}
          </Text>
        </View>
      ))}

      {bullets.map((b, i) => (
        <View
          key={i}
          style={[
            styles.bullet,
            {
              left: b.x,
              top: b.y,
              backgroundColor: b.isSub ? "#FFD700" : "#FFF",
            },
          ]}
        />
      ))}

      {/* WINNER MODAL */}
      <Modal visible={winner !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.winEmoji}>👑</Text>
            <Text style={styles.winTitle}>¡VICTORIA!</Text>

            <Text style={[styles.winName, { color: winner?.color }]}>
              {winner?.name}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.rankTitle}>🏆 TOP 5 ASESINOS</Text>

            <View style={styles.rankList}>
              {finalRank.map((s, i) => (
                <View key={i} style={styles.rankItem}>
                  <Text style={styles.rankPos}>{i + 1}.</Text>

                  <Text style={[styles.rankName, { color: s.color }]}>
                    {s.name}
                  </Text>

                  <Text style={styles.rankKills}>{s.kills} kills</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.restartBtn}
              onPress={() => setGameState("setup")}
            >
              <Text style={styles.restartText}>VOLVER AL PANEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    paddingTop: 60,
  },
  setupTitle: {
    color: "#C5A582",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 10,
    color: "#000",
    marginBottom: 10,
  },
  inputBox: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeToggle: {
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  addBtn: {
    backgroundColor: "#C5A582",
    width: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: "#FFF", fontSize: 24 },
  participantList: { flex: 1 },
  participantItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    marginBottom: 8,
  },
  startBtn: {
    backgroundColor: "#4caf50",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  startBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  clearBtn: { padding: 15, alignItems: "center" },
  clearBtnText: { color: "#AAA" },
  ocean: { flex: 1 },
  scoreboard: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 10,
    borderRadius: 10,
    minWidth: 110,
    borderWidth: 1,
    borderColor: "#FFD700",
    zIndex: 10,
  },
  scoreTitle: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
  },
  scoreText: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  shipContainer: { position: "absolute", alignItems: "center" },
  shipName: {
    fontSize: 14,
    fontWeight: "bold",
    textShadowColor: "#000",
    textShadowRadius: 2,
  },
  hpBG: { height: 4, width: 35, backgroundColor: "#333" },
  hpFill: { height: "100%" },
  bullet: {
    position: "absolute",
    width: BULLET_SIZE,
    height: BULLET_SIZE,
    borderRadius: BULLET_SIZE / 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    width: "85%",
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#C5A582",
  },
  winEmoji: { fontSize: 60, marginBottom: -10 },
  winTitle: { color: "#AAA", fontSize: 14, letterSpacing: 2 },
  winName: {
    fontSize: 32,
    fontWeight: "bold",
    marginVertical: 5,
    textAlign: "center",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#333",
    marginVertical: 20,
  },
  rankTitle: {
    color: "#C5A582",
    fontWeight: "bold",
    marginBottom: 15,
    fontSize: 16,
  },
  rankList: { width: "100%", marginBottom: 25 },
  rankItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  rankPos: { color: "#666", fontWeight: "bold", width: 25 },
  rankName: { flex: 1, fontWeight: "600", fontSize: 16 },
  rankKills: { color: "#FFF", fontWeight: "bold" },
  restartBtn: {
    backgroundColor: "#C5A582",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  restartText: { color: "#FFF", fontWeight: "bold" },
});