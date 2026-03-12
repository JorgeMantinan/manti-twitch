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
} from "react-native";

import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";
import { io } from "socket.io-client";

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
  const role:Role = (params.role as Role) || "viewer";
  // const [role, setRole] = useState<Role>("viewer");

  const spinAnim = useRef(new Animated.Value(0)).current;

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

  //   if (!token) {
  //     setRole("viewer");
  //     return;
  //   }

  //   const decoded = parseJWT(token);

  //   setRole(determineRole(decoded));
  // };

  // useEffect(() => {
  //   checkAuth();
  // }, []);

  /*
    SOCKET REAL-TIME LISTENER
  */
  useEffect(() => {

    if (socketRef.current) return;

    const socket = io("https://manti-twitch-backend.onrender.com");

    socket.on("connect", () => {
      console.log("🟢 SOCKET RULETA conectado");
    });
    socketRef.current.emit("joinRoom", {
      streamer: role === "mod" ? streamer : "default"
    });

    socket.on("newParticipant", (data: SocketData) => {
      console.log("📩 RULETA recibió:", data.participant.username);

      setParticipants((prev) => {
        const exists = prev.some(
          (p) =>
            p.username.toLowerCase() ===
            data.participant.username.toLowerCase()
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

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };

  }, [streamer]);

  /*
WEIGHT SYSTEM
*/

  const buildWeightedParticipants = () => {
    const list: Participant[] = [];

    participants.forEach((p) => {
      const copies = Math.max(1, Math.floor(p.weight));

      for (let i = 0; i < copies; i++) {
        list.push(p);
      }
    });

    return list;
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

  /*
ANIMATION
*/

  const animateSpin = (winnerName: string, visual: Participant[]) => {
    // playSpinSound(); // Sound to press button SPIN

    const slice = 360 / visual.length;

    const winnerIndex = visual.findIndex((p) => p.username === winnerName);

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
        selectedStreamer: role === "mod" ? streamer : undefined,
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
        (p) => !existing.has(p.username.toLowerCase())
      );

      return [...prev, ...newOnes];
    });

    setRunning(false);
  };

  /*
PICK WINNER
*/

  const pickWinner = async () => {
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

    const visual = buildVisualSlices();

    animateSpin(winnerUser.username, visual);
  };

  /*
RENDER WHEEL
*/

  const renderWheel = () => {
    const visual = buildVisualSlices();

    const radius = 150;
    const center = 180;
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

      const tx = center + radius * 0.65 * Math.cos((Math.PI * textAngle) / 180);
      const ty = center + radius * 0.65 * Math.sin((Math.PI * textAngle) / 180);

      return (
        <G key={i}>
          <Path d={path} fill={`hsl(${(i * 23) % 360},70%,55%)`} />

          {visual.length <= 120 && (
            <SvgText
              x={tx}
              y={ty}
              fontSize={visual.length > 40 ? "10" : "18"}
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

        {role !== "viewer" && (
          <TextInput
            placeholder="Keyword (!sorteo)"
            value={keyword}
            onChangeText={setKeyword}
            style={styles.input}
          />
        )}

        {role === "mod" && (
          <TextInput
            style={styles.input}
            placeholder="Streamer channel"
            value={streamer}
            onChangeText={setStreamer}
          />
        )}

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
            <Svg width={360} height={360}>
              {renderWheel()}
            </Svg>
          </Animated.View>

          <View style={styles.pointer} />
        </View>

        {role !== "viewer" && !running && (
          <TouchableOpacity style={styles.button} onPress={startRaffle}>
            <Text style={styles.buttonText}>Start Raffle</Text>
          </TouchableOpacity>
        )}

        {role !== "viewer" && running && (
          <TouchableOpacity style={styles.button} onPress={stopRaffle}>
            <Text style={styles.buttonText}>Stop Raffle</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.button} onPress={pickWinner}>
          <Text style={styles.buttonText}>SPIN</Text>
        </TouchableOpacity>

        {winner && <Text style={styles.winner}>🏆 {winner}</Text>}
      </View>

      <View style={styles.rightSide}>
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
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>

        <ScrollView style={styles.list}>
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
    backgroundColor: "#FAF7F2",
    justifyContent: "center",
    alignItems: "center",
  },

  leftSide: {
    alignItems: "center",
    marginRight: 40,
  },

  rightSide: {
    width: 260,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },

  wheelContainer: {
    width: 360,
    height: 360,
    alignItems: "center",
    justifyContent: "center",
  },

  pointer: {
    position: "absolute",
    right: -12,
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
    borderRadius: 25,
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
    maxHeight: 300,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
});
