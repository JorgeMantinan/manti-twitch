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
  Dimensions,
} from "react-native";

import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";
import { io } from "socket.io-client";

import { getSessionId } from "../utils/session";

type Participant = {
  username: string;
  weight: number;
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

// Roulette width
const { width } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(width * 0.45, 520);
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2 - 20;

const MAX_SLICES = 120;

export default function SmartRoulette() {
  const params = useLocalSearchParams();

  const socketRef = useRef<any>(null);

  const initialParticipants = params.data
    ? JSON.parse(params.data as string)
    : [];

  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants.map((p: any) => ({
      username: p.user_name || p.username || p.name,
      weight: 1,
    })),
  );

  const [winner, setWinner] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [keyword, setKeyword] = useState("!sorteo");
  const [streamer, setStreamer] = useState("");
  const streamerRef = useRef("default");
  const role: Role = (params.role as Role) || "viewer";

  const [visualSlices, setVisualSlices] = useState<Participant[]>([]);
  useEffect(() => {
    setVisualSlices(buildVisualSlices());
  }, [participants]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spinAnim.setValue(0);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ["0deg", "3600deg"],
  });

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

    const socket = io("https://manti-twitch-backend.onrender.com");
    socketRef.current = socket;

    socket.on("connect", () => {
      const activeStreamer = streamer?.trim() || getSessionId();

      streamerRef.current = activeStreamer;

      socket.emit("joinRoom", {
        game: "roulette",
        streamer: streamerRef.current,
      });
    });

    socket.on("newParticipant", (data: SocketData) => {
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

    // Separate Subs
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
SOUND
*/

  const playSpinSound = () => {
    if (Platform.OS !== "web") return;

    if (!audioRef.current) {
      audioRef.current = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
      );
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  /*
FIREWORKS
*/

  const showFireworks = () => {
    if (Platform.OS !== "web") return;

    const container = document.createElement("div");

    container.style.position = "fixed";
    container.style.left = "50%";
    container.style.top = "40%";
    container.style.fontSize = "60px";
    // container.innerHTML = "🎆🎉🎆";

    document.body.appendChild(container);

    setTimeout(() => {
      document.body.removeChild(container);
    }, 3000);
  };

  /*
PARTICIPANTS
*/

  const addParticipant = () => {
    if (!newUser.trim()) return;

    setParticipants((p) => [...p, { username: newUser.trim(), weight: 1 }]);

    setNewUser("");
  };

  const removeParticipant = (name: string) => {
    setParticipants((p) => p.filter((u) => u.username !== name));
  };
  const clearParticipants = () => {
    setParticipants([]);
  };

  /*
ANIMATION
*/

  const animateSpin = (winnerName: string, visual: Participant[]) => {
    // playSpinSound(); // Sound to press button SPIN

    const slice = 360 / visual.length;

    const winnerIndex = visual.findIndex((p) => p.username === winnerName);

    if (winnerIndex === -1) {
      console.warn("Winner not in visual slices");
      return;
    }

    const centerOfSlice = winnerIndex * slice + slice / 2;

    const targetAngle = 360 - centerOfSlice;

    const spins = 6;

    spinAnim.setValue(0);

    Animated.timing(spinAnim, {
      toValue: spins + targetAngle / 360,
      duration: 5000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setWinner(winnerName);
      showFireworks();
    });
  };

  /*
BACKEND
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
      "https://manti-twitch-backend.onrender.com/api/raffle/stop",
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
PICK WINNER
*/

  const pickWinner = async () => {
    // Force stop raffle
    setRunning(false);
    
    if (participants.length === 0) return;

    const weighted = buildWeightedParticipants();

    let winnerUser = weighted[0];

    if (!running) {
      winnerUser = weighted[Math.floor(Math.random() * weighted.length)];
    } else {
      const token = await getToken();

      const res = await fetch(
        "https://manti-twitch-backend.onrender.com/api/raffle/pick-winner",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();

      winnerUser = {
        username: data.winner.username,
        weight: 1,
      };
    }

    animateSpin(winnerUser.username, visualSlices);
  };

  /*
RENDER WHEEL
*/

  const renderWheel = () => {
    const visual = visualSlices;

    const radius = RADIUS;
    const center = CENTER;
    const slice = 360 / visual.length;

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

      const tx = center + radius * 0.55 * Math.cos((Math.PI * textAngle) / 180);
      const ty = center + radius * 0.55 * Math.sin((Math.PI * textAngle) / 180);

      return (
        <G key={i}>
          <Path d={path} fill={`hsl(${(i * 23) % 360},70%,55%)`} />

          {visual.length <= 120 && (
            <SvgText
              x={tx}
              y={ty}
              fontSize={
                visual.length > 60 ? "10" : visual.length > 25 ? "14" : "18"
              }
              fill="white"
              textAnchor="middle"
              alignmentBaseline="middle"
              rotation={textAngle}
              origin={`${tx},${ty}`}
            >
              {p.username}
            </SvgText>
          )}
        </G>
      );
    });
  };

  /*
UI
*/

  return (
    <View style={styles.container}>
      <View style={styles.leftSide}>
        <Text style={styles.title}>Smart Twitch Roulette</Text>

        <View style={styles.wheelContainer}>
          <Animated.View
            style={{
              transform: [
                { rotate: rotation },
                { perspective: 800 },
                { rotateX: "10deg" },
              ],
            }}
          >
            <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
              {renderWheel()}
            </Svg>
          </Animated.View>

          <View style={styles.pointer} />
        </View>

        <TouchableOpacity style={styles.button} onPress={pickWinner}>
          <Text style={styles.buttonText}>GIRAR RULETA</Text>
        </TouchableOpacity>

        {winner && <Text style={styles.winner}>🏆 {winner}</Text>}
      </View>

      <View style={styles.rightSide}>

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
            </View>
          </View>
        )}
        <Text style={styles.listTitle}>
          Participants ({participants.length})
        </Text>

        <TextInput
          placeholder="Add participant"
          value={newUser}
          onChangeText={setNewUser}
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={addParticipant}>
          <Text style={styles.buttonText}>Añadir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#999" }]}
          onPress={clearParticipants}
        >
          <Text style={styles.buttonText}>Eliminar todo</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.participantGrid}
        >
          {participants.map((p, i) => (
            <View key={p.username + i} style={styles.row}>
              <Text>{p.username}</Text>

              <TouchableOpacity onPress={() => removeParticipant(p.username)}>
                <Text style={{ color: "red" }}>❌</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
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
    alignItems: "center",
  },

  leftSide: {
    flex: 1.2,
    alignItems: "center",
  },

  rightSide: {
    flex: 1,
    marginLeft: 40,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },

  wheelContainer: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  pointer: {
    position: "absolute",
    right: -14,
    top: "50%",
    marginTop: -15,
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderRightWidth: 25,
    borderBottomWidth: 15,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#333",
  },

  button: {
    marginTop: 12,
    backgroundColor: "#C5A582",
    padding: 12,
    borderRadius: 20,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "600",
  },

  winner: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "700",
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

  list: {
    flex: 1,
  },

  row: {
    width: "48%",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  participantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 20,
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
