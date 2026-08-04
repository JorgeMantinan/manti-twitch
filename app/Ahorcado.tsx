import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";

import { io, Socket } from "socket.io-client";

import * as SecureStore from "expo-secure-store";

import { useLocalSearchParams } from "expo-router";

import { getSessionId } from "../utils/session";
import { charStates } from "../utils/ahorcado";
import AhorcadoStartModal from "../components/AhorcadoStartModal";
import BingoWinModal from "../components/BingoWinModal";
import HangmanFigure from "../components/HangmanFigure";
import { API_CONFIG } from "../constants/api";

type Role = "viewer" | "mod" | "streamer";

type Player = {
  name: string;
  misses: number;
};

export default function Ahorcado() {
  /**System ROLES */
  const params = useLocalSearchParams();
  const role: Role = (params.role as Role) || "viewer";
  const [streamer, setStreamer] = useState((params.streamer as string) || "");
  const streamerRef = useRef("default");
  const [subsOnly, setSubsOnly] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);

  const [phrase, setPhrase] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const maxMisses = 6;
  const maxPlayerMisses = 6;

  const [modalVisible, setModalVisible] = useState(true);

  const letterScale = useRef(new Animated.Value(0)).current;

  const [winVisible, setWinVisible] = useState(false);
  const [winTitle, setWinTitle] = useState("");
  const [winPlayer, setWinPlayer] = useState("");

  const [auto, setAuto] = useState(false);

  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const getToken = async () => {
    return await SecureStore.getItemAsync("userToken");
  };

  /*
=====================
JOIN ROOM
=====================
*/

  useEffect(() => {
    socketRef.current = io("https://manti-twitch-backend.onrender.com", {
      reconnection: false,
      timeout: 5000,
    });

    socketRef.current.on("connect", () => {
      const activeStreamer = streamer?.trim() || getSessionId();

      streamerRef.current = activeStreamer;

      socketRef.current?.emit("joinRoom", {
        game: "ahorcado",
        streamer: activeStreamer,
      });
    });

    socketRef.current.on("ahorcado:started", (data: any) => {
      setPhrase(data.phrase);
      setDrawn([]);
      setCurrent(null);
      setMisses(0);
      setPlayers([]);
      setWinVisible(false);
    });

    socketRef.current.on("ahorcado:letter", (data: any) => {
      setCurrent(data.letter);
      setDrawn((p) => [...p, data.letter]);
      setMisses(data.misses);
      animateLetter();
      speakLetter(data.letter);
    });

    socketRef.current.on("ahorcado:playerMiss", (data: any) => {
      const p = data.player;
      if (!p) return;

      setPlayers((prev) => {
        if (p.misses >= maxPlayerMisses) {
          return prev.filter((x) => x.name !== p.name);
        }

        const exists = prev.some((x) => x.name === p.name);
        if (exists) {
          return prev.map((x) => (x.name === p.name ? { name: p.name, misses: p.misses } : x));
        }
        return [...prev, { name: p.name, misses: p.misses }];
      });
    });

    socketRef.current.on("ahorcado:win", (data: any) => {
      setWinTitle("¡FRASE COMPLETADA!");
      setWinPlayer(data.phrase);
      setWinVisible(true);
      stopAuto();
    });

    socketRef.current.on("ahorcado:guessed", (data: any) => {
      setWinTitle("¡FRASE ACERTADA!");
      setWinPlayer(`El usuario ${data.player} acertó la frase`);
      setWinVisible(true);
      stopAuto();
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  /*
=====================
CLEAN INTERVAL ON CHANGE STREAMER
=====================
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
=====================
ANIMATION
=====================
*/

  function animateLetter() {
    letterScale.setValue(0);

    Animated.spring(letterScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }

  /*
=====================
VOICE
=====================
*/

  function speakLetter(letter: string) {
    if (typeof window === "undefined") return;

    const msg = new SpeechSynthesisUtterance(`Letra ${letter}`);

    msg.lang = "es-ES";

    speechSynthesis.speak(msg);
  }

  /*
=====================
START
=====================
*/

  async function resolveChannel() {
    try {
      const token = await getToken();
      if (!token) return undefined;

      const res = await fetch(API_CONFIG.ENDPOINTS.AHORCADO_CHANNEL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.channel || undefined;
    } catch {
      return undefined;
    }
  }

  async function startGame() {
    stopAuto();

    setDrawn([]);
    setCurrent(null);
    setMisses(0);
    setPlayers([]);
    setWinVisible(false);

    let twitchChannel = streamer?.trim() || undefined;

    if (!twitchChannel && role === "streamer") {
      twitchChannel = await resolveChannel();
    }

    socketRef.current?.emit("ahorcado:start", {
      streamer: streamerRef.current,
      twitchChannel,
      subsOnly,
    });
  }

  /*
=====================
NEW GAME
=====================
*/
  function newGame() {
    stopAuto();

    setPhrase(null);
    setDrawn([]);
    setCurrent(null);
    setMisses(0);
    setWinVisible(false);

    setModalVisible(true);
  }

  /*
=====================
DRAW
=====================
*/

  function draw() {
    socketRef.current?.emit("ahorcado:draw", {
      streamer: streamerRef.current,
    });
  }

  function stopAuto() {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }

    setAuto(false);
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
          socketRef.current?.emit("ahorcado:draw", {
            streamer: streamerRef.current,
          });
        }, 2000);

        return true;
      }
    });
  }

  /*
=====================
DRAW
=====================
*/

  return (
    <View style={styles.container}>
      <AhorcadoStartModal
        visible={modalVisible}
        role={role}
        streamer={streamer}
        setStreamer={setStreamer}
        subsOnly={subsOnly}
        setSubsOnly={setSubsOnly}
        onStart={() => {
          setModalVisible(false);
          startGame();
        }}
        onClose={() => setModalVisible(false)}
      />

      <ScrollView horizontal style={styles.drawnRow}>
        {drawn.map((l, i) => (
          <View key={i} style={styles.smallLetter}>
            <Text style={styles.smallLetterText}>{l}</Text>
          </View>
        ))}
      </ScrollView>

      <Animated.View
        style={[styles.bigLetter, { transform: [{ scale: letterScale }] }]}
      >
        <Text style={styles.bigText}>{current}</Text>
      </Animated.View>

      <HangmanFigure misses={misses} maxMisses={maxMisses} />

      {players.length > 0 && (
        <View style={styles.playersRow}>
          {players.map((p) => (
            <View key={p.name} style={styles.playerChip}>
              <Text style={styles.playerName}>{p.name}</Text>
              <Text style={styles.playerMisses}>
                FALLOS {p.misses}/{maxPlayerMisses}
              </Text>
            </View>
          ))}
        </View>
      )}

      {phrase && (
        <View style={styles.phraseRow}>
          {charStates(phrase, drawn).map((s, i) => {
            if (s.isSpace) return <View key={i} style={styles.space} />;
            if (!s.isLetter) {
              return (
                <Text key={i} style={styles.punctuation}>
                  {s.ch}
                </Text>
              );
            }

            return (
              <View
                key={i}
                style={[styles.tile, s.revealed && styles.tileRevealed]}
              >
                <Text style={[styles.tileText, !s.revealed && styles.tileHidden]}>
                  {s.revealed ? s.ch : "_"}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.controlCenter}>
        <TouchableOpacity style={styles.newGame} onPress={newGame}>
          <Text style={styles.btnNewGameText}>Nueva partida</Text>
        </TouchableOpacity>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.drawButton} onPress={draw}>
            <Text style={{ color: "#fff" }}>SACAR LETRA</Text>
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
    marginBottom: 15,
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
    fontSize: 12,
  },

  drawnRow: {
    maxHeight: 50,
    flexGrow: 0,
  },

  smallLetter: {
    width: 24,
    height: 24,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C5A582",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
  },

  smallLetterText: {
    fontWeight: "bold",
    fontSize: 11,
  },

  bigLetter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 5,
    borderColor: "#C5A582",
    backgroundColor: "#fff",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  bigText: {
    fontSize: 50,
    fontWeight: "bold",
  },

  phraseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 10,
  },

  space: {
    width: 18,
  },

  punctuation: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#555",
    marginHorizontal: 2,
  },

  tile: {
    width: 34,
    height: 42,
    margin: 3,
    borderWidth: 2,
    borderColor: "#C5A582",
    borderRadius: 6,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  tileRevealed: {
    backgroundColor: "#FFD700",
  },

  tileText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2A2A2A",
  },

  tileHidden: {
    color: "#999",
  },

  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  playersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },

  playerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#C5A582",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },

  playerName: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#2A2A2A",
  },

  playerMisses: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#c94b4b",
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
