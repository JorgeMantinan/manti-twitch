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

import { io, Socket } from "socket.io-client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useLocalSearchParams } from "expo-router";

import { getSessionId } from "../utils/session";
import { generateSpanishCard } from "../utils/bingoCard";
import ParticipantsModal from "../components/BingoParticipantsModal";
import BingoWinModal from "../components/BingoWinModal";

type Role = "viewer" | "mod" | "streamer";

type BingoCard = (number | null)[][];

type PlayerCard = {
  player: string;
  card: BingoCard;
  isSub?: boolean;
};

export default function Bingo() {
  /**System ROLES */
  const params = useLocalSearchParams();
  const role: Role = (params.role as Role) || "viewer";
  const [streamer, setStreamer] = useState((params.streamer as string) || "");
  const streamerRef = useRef("default");
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
  const socketRef = useRef<Socket | null>(null);

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
    socketRef.current = io("https://manti-twitch-backend.onrender.com");

    socketRef.current.on("connect", () => {
    const activeStreamer = streamer?.trim() || getSessionId();

      streamerRef.current = activeStreamer;

      socketRef.current?.emit("joinroom", {
        game: "bingo",
        streamer: activeStreamer,
      });
    });

    socketRef.current.on("newParticipant", (data: any) => {

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
          },
        ];
      });
    });

    socketRef.current.on("bingo:number", (n: number) => {
      setCurrent(n);
      setDrawn((p) => [...p, n]);
      animateBall();
    });

    socketRef.current.on("bingo:line", (player) => {
      const realPlayer = player.split("_")[0];
      setWinTitle("LINEA");
      setWinPlayer(realPlayer);
      setWinVisible(true);
    });

    socketRef.current.on("bingo:bingo", (player) => {
      const realPlayer = player.split("_")[0];
      setWinTitle("BINGO");
      setWinPlayer(realPlayer);
      setWinVisible(true);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  /*
========================
CLEAN INTERVAL ON CHANGE STREAMER
========================
*/
  useEffect(() => {
    return () => {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
  }, []);

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
    const cardsGenerated: PlayerCard[] = [];

    participants.forEach((p) => {
      const amount = p.isSub ? 2 : 1;

      for (let i = 0; i < amount; i++) {
        cardsGenerated.push({
          player: p.name,
          card: generateSpanishCard(),
          isSub: p.isSub,
        });
      }
    });

    setCards(cardsGenerated);

    const backendCards: Record<string, BingoCard> = {};

    cardsGenerated.forEach((c, i) => {
      backendCards[`${c.player}_${i}`] = c.card;
    });

    socketRef.current?.emit("bingo:start", {
      streamer: streamerRef.current,
      cards: backendCards,
    });
  }

  /*
========================
NEW GAME
========================
*/
  function newGame() {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }

    setAuto(false);

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
    console.log("DRAW STREAMER:", streamerRef.current);
    socketRef.current?.emit("bingo:draw", { streamer: streamerRef.current });
  }

  function toggleAuto() {
    setAuto((prev) => {
      if (prev) {
        if (autoRef.current) {
          clearInterval(autoRef.current);
          autoRef.current = null;
        }
        return false;
      } else {
        autoRef.current = setInterval(() => {
          socketRef.current?.emit("bingo:draw", {
            streamer: streamerRef.current,
          });
        }, 2000);

        return true;
      }
    });
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
        onClose={() => setModalVisible(false)}
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
      <View style={styles.controlCenter}>
        <TouchableOpacity style={styles.newGame} onPress={newGame}>
          <Text style={styles.btnNewGameText}>Nueva partida</Text>
        </TouchableOpacity>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.drawButton} onPress={draw}>
            <Text style={{ color: "#fff" }}>SACAR BOLA</Text>
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
      </View>

      <ScrollView contentContainerStyle={styles.cardsGrid}>
        {cards.map((c, i) => (
          <View key={i} style={[styles.card, c.isSub && styles.subCard]}>
            <Text style={[styles.player, c.isSub && styles.subPlayer]}>
              {c.player} {c.isSub ? "⭐" : ""}
            </Text>

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
  controlCenter: {
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },

  newGame: {
    backgroundColor: "#C5A582",
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    elevation: 2,
  },
  btnNewGameText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12, // Fuente más pequeña
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
    backgroundColor: "#FFD700",
  },

  num: {
    fontWeight: "bold",
  },

  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
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
  subPlayer: {
    color: "#FFD700",
    fontWeight: "bold",
  },
  subCard: {
    borderWidth: 3,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
