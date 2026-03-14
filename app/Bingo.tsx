import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
} from "react-native";

import { io } from "socket.io-client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";

import { generateSpanishCard } from "../utils/bingoCard";
import ParticipantsModal from "../components/BingoParticipantsModal";
import BingoWinModal from "../components/BingoWinModal";

const socket = io("https://manti-twitch-backend.onrender.com");

type Role = "viewer" | "mod" | "streamer";

type BingoCard = (number | null)[][];

type PlayerCard = {
  player: string;
  card: BingoCard;
};

export default function Bingo() {
  /**System ROLES */
  const params = useLocalSearchParams();
  const role: Role = (params.role as Role) || "viewer";
  const [streamer, setStreamer] = useState("");
  const [raffleWord, setRaffleWord] = useState("!sorteo");
  const [raffleRunning, setRaffleRunning] = useState(false);

  const [participants, setParticipants] = useState<any[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);

  const [drawn, setDrawn] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(true);

  const ballScale = useRef(new Animated.Value(0)).current;

  const [winVisible, setWinVisible] = useState(false);
  const [winTitle, setWinTitle] = useState("");
  const [winPlayer, setWinPlayer] = useState("");

  const [auto, setAuto] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getToken = async () => {
    if (Platform.OS === "web") return localStorage.getItem("userToken");
    return await SecureStore.getItemAsync("userToken");
  };

  /*
========================
JOIN ROOM
========================
*/

  useEffect(() => {
    socket.emit("joinRoom", {
      streamer: role === "mod" ? streamer : "default",
    });

    socket.on("newParticipant", (data: any) => {
      setParticipants((prev) => {
        const exists = prev.some(
          (p) =>
            p.name.toLowerCase() === data.participant.username.toLowerCase(),
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

    socket.on("bingo:number", (n: number) => {
      setCurrent(n);
      setDrawn((p) => [...p, n]);
      animateBall();
    });

    socket.on("bingo:line", (player) => {
      setWinTitle("LINEA");
      setWinPlayer(player);
      setWinVisible(true);
    });

    socket.on("bingo:bingo", (player) => {
      setWinTitle("BINGO");
      setWinPlayer(player);
      setWinVisible(true);
    });

    return () => {
      socket.disconnect();

      if (autoRef.current) {
        clearInterval(autoRef.current);
      }
    };
  }, [streamer]);

  /*
========================
RAFFLE
========================
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
========================
GET SUBS
========================
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
      },
    );

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

  /*
========================
ANIMATION
========================
*/

  function animateBall() {
    ballScale.setValue(0);

    Animated.spring(ballScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }

  /*
========================
VOICE
========================
*/

  function speakNumber(n: number) {
    if (typeof window === "undefined") return;

    const msg = new SpeechSynthesisUtterance(`Número ${n}`);

    msg.lang = "es-ES";

    speechSynthesis.speak(msg);
  }

  /*
========================
START
========================
*/

  function startGame() {
    const cardsGenerated = participants.map((p) => ({
      player: p.name,
      card: generateSpanishCard(),
    }));

    setCards(cardsGenerated);

    const backendCards: Record<string, BingoCard> = {};

    cardsGenerated.forEach((c) => {
      backendCards[c.player] = c.card;
    });

    socket.emit("bingo:start", {
      streamer: "default",
      cards: backendCards,
    });
  }

  /*
========================
NEW GAME
========================
*/
  function newGame() {
    setCards([]);
    setDrawn([]);
    setCurrent(null);

    setModalVisible(true);
  }

  /*
========================
DRAW
========================
*/

  function draw() {
    socket.emit("bingo:draw", { streamer: "default" });
  }

  function toggleAuto() {
    if (auto) {
      setAuto(false);

      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    } else {
      setAuto(true);

      autoRef.current = setInterval(() => {
        socket.emit("bingo:draw", { streamer: "default" });
      }, 2000);
    }
  }

  /*
========================
MARKED
========================
*/

  function marked(n: number) {
    return drawn.includes(n);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newGame} onPress={newGame}>
        <Text style={{ color: "#fff" }}>Nueva partida</Text>
      </TouchableOpacity>
      <ParticipantsModal
        visible={modalVisible}
        participants={participants}
        setParticipants={setParticipants}
        role={role}
        streamer={streamer}
        setStreamer={setStreamer}
        raffleWord={raffleWord}
        setRaffleWord={setRaffleWord}
        raffleRunning={raffleRunning}
        startRaffle={startRaffle}
        stopRaffle={stopRaffle}
        fetchSubs={fetchSubs}
        onStart={() => {
          setModalVisible(false);
          startGame();
        }}
      />

      <ScrollView horizontal style={styles.drawnRow}>
        {drawn.map((n, i) => (
          <View key={i} style={styles.smallBall}>
            <Text>{n}</Text>
          </View>
        ))}
      </ScrollView>

      <Animated.View
        style={[styles.bigBall, { transform: [{ scale: ballScale }] }]}
      >
        <Text style={styles.bigText}>{current}</Text>
      </Animated.View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.drawButton} onPress={draw}>
          <Text style={{ color: "#fff" }}>SACAR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.autoButton, auto && styles.autoOn]}
          onPress={toggleAuto}
        >
          <Text style={{ color: "#fff" }}>
            AUTOMÁTICO {auto ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.cardsGrid}>
        {cards.map((c, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.player}>{c.player}</Text>

            {c.card.map((row: any, r: number) => (
              <View key={r} style={styles.row}>
                {row.map((n: any, col: number) => {
                  const m = n && marked(n);

                  return (
                    <View
                      key={col}
                      style={[
                        styles.cell,
                        !n && styles.empty,
                        m && styles.mark,
                      ]}
                    >
                      <Text style={styles.num}>{n || ""}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <BingoWinModal
        visible={winVisible}
        title={winTitle}
        player={winPlayer}
        onClose={() => setWinVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ECE7E1",
    paddingTop: 40,
  },

  newGame: {
    backgroundColor: "#444",
    padding: 10,
    alignItems: "center",
  },

  drawnRow: {
    maxHeight: 50,
  },

  smallBall: {
    width: 20,
    height: 20,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C5A582",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
  },

  bigBall: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 5,
    borderColor: "#C5A582",
    backgroundColor: "#fff",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
  },

  bigText: {
    fontSize: 50,
    fontWeight: "bold",
  },

  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff",
    margin: 6,
    padding: 6,
    borderRadius: 8,
    width: "15%",
    minWidth: 140,
    alignItems: "center",
  },

  player: {
    textAlign: "center",
    fontWeight: "bold",
  },

  row: {
    flexDirection: "row",
  },

  cell: {
    width: 28,
    height: 32,
    borderWidth: 1,
    borderColor: "#DDD",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    backgroundColor: "#C5A582",
  },

  mark: {
    backgroundColor: "#b7c582",
  },

  num: {
    fontWeight: "bold",
  },

  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  drawButton: {
    backgroundColor: "#C5A582",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },

  autoButton: {
    backgroundColor: "#777",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },

  autoOn: {
    backgroundColor: "#4CAF50",
  },
});
