import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";

import { io } from "socket.io-client";

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
  const [participants, setParticipants] = useState<any[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);

  const [drawn, setDrawn] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(true);

  const ballScale = useRef(new Animated.Value(0)).current;

  const [winVisible, setWinVisible] = useState(false);
  const [winTitle, setWinTitle] = useState("");
  const [winPlayer, setWinPlayer] = useState("");

  /*
========================
JOIN ROOM
========================
*/

  useEffect(() => {
    socket.emit("bingo:join", { streamer: "default" });

    socket.on("bingo:number", (n: number) => {
      setCurrent(n);

      setDrawn((p) => [...p, n]);

      animateBall();

      //   speakNumber(n);
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
  }, []);

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

      <TouchableOpacity style={styles.drawButton} onPress={draw}>
        <Text style={{ color: "#fff" }}>SACAR</Text>
      </TouchableOpacity>

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

  drawButton: {
    backgroundColor: "#C5A582",
    padding: 16,
    alignItems: "center",
    margin: 10,
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
});
