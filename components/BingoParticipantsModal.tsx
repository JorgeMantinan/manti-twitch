import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

type Participant = {
  name: string;
};

type Role = "viewer" | "mod" | "streamer";

type Props = {
  visible: boolean;

  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;

  role: Role;

  streamer: string;
  setStreamer: (v: string) => void;

  raffleWord: string;
  setRaffleWord: (v: string) => void;

  raffleRunning: boolean;

  startRaffle: () => void;
  stopRaffle: () => void;

  fetchSubs: () => void;

  onStart: () => void;

  onClose: () => void;
};

export default function ParticipantsModal({
  visible,
  participants,
  setParticipants,

  role,

  streamer,
  setStreamer,

  raffleWord,
  setRaffleWord,

  raffleRunning,

  startRaffle,
  stopRaffle,

  fetchSubs,

  onStart,
  onClose,
}: Props) {
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;

    setParticipants((p) => [...p, { name }]);

    setName("");
  }

  function remove(index: number) {
    setParticipants((p) => p.filter((_, i) => i !== index));
  }

  function removeAll() {
    setParticipants([]);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeCorner} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Participantes</Text>

          {/* --- BLOQUE 1: ACCIONES AUTOMÁTICAS (Subs y Sorteo) --- */}
          <View style={styles.topActions}>
            {role === "streamer" && (
              <TouchableOpacity
                style={[styles.button, { marginTop: 0, marginBottom: 10 }]}
                onPress={fetchSubs}
              >
                <Text style={styles.text}>GET SUBS FROM TWITCH</Text>
              </TouchableOpacity>
            )}

            {role !== "viewer" && (
              <View style={styles.raffleBox}>
                <TextInput
                  style={[styles.input, { marginRight: 10 }]}
                  placeholder="Palabra sorteo (ej: !bingo)"
                  value={raffleWord}
                  onChangeText={setRaffleWord}
                />
                {!raffleRunning ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={startRaffle}
                  >
                    <Text style={styles.text}>START RAFFLE</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={stopRaffle}
                  >
                    <Text style={styles.text}>STOP RAFFLE</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.separator} />

          {/* --- BLOQUE 2: ENTRADA MANUAL --- */}
          <Text style={styles.sectionLabel}>Añadir manualmente:</Text>
          <View style={styles.addRow}>
            {role === "mod" && (
              <TextInput
                style={[styles.input, { flex: 0.4 }]}
                placeholder="Canal"
                value={streamer}
                onChangeText={setStreamer}
              />
            )}
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nombre del usuario..."
            />
            <TouchableOpacity style={styles.addBtn} onPress={add}>
              <Text style={styles.btnText}>Añadir</Text>
            </TouchableOpacity>
          </View>

          {/* --- BLOQUE 3: LISTADO --- */}
          <ScrollView style={styles.list}>
            {participants.map((p, i) => (
              <View key={i} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.name}</Text>
                <TouchableOpacity
                  onPress={() => remove(i)}
                  style={styles.removeBtn}
                >
                  <Text style={styles.btnText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* --- BLOQUE 4: BOTONES DE ACCIÓN FINAL --- */}
          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={removeAll}>
              <Text style={styles.btnText}>Eliminar todos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startBtn} onPress={onStart}>
              <Text style={styles.btnText}>Empezar Partida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    backgroundColor: "#fff",
    borderRadius: 10,
    width: 500,
    maxHeight: "80%",
    padding: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  addRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    marginRight: 10,
  },

  addBtn: {
    backgroundColor: "#C5A582",
    padding: 12,
  },

  list: {
    maxHeight: 300,
  },

  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  playerName: {
    fontSize: 16,
  },

  removeBtn: {
    backgroundColor: "#c55",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },

  clearBtn: {
    backgroundColor: "#777",
    padding: 12,
  },

  startBtn: {
    backgroundColor: "#C5A582",
    padding: 12,
  },

  btnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#C5A582",
    padding: 12,
    marginTop: 10,
    alignItems: "center",
    borderRadius: 6,
  },

  text: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 15,
  },
  topActions: {
    marginBottom: 15,
  },
  raffleBox: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    borderRadius: 6,
    minWidth: 120,
  },
  dangerButton: {
    backgroundColor: "#C94B4B",
    padding: 12,
    alignItems: "center",
    borderRadius: 6,
    minWidth: 120,
  },
  closeCorner: {
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 10,
    padding: 5,
  },
  closeText: {
    fontSize: 20,
    color: "#777",
    fontWeight: "bold",
  },
});
