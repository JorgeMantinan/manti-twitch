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

type Props = {
  visible: boolean;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  onStart: () => void;
};

export default function ParticipantsModal({
  visible,
  participants,
  setParticipants,
  onStart,
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
          <Text style={styles.title}>Participantes</Text>

          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="username"
            />

            <TouchableOpacity style={styles.addBtn} onPress={add}>
              <Text style={styles.btnText}>Añadir</Text>
            </TouchableOpacity>
          </View>

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

          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={removeAll}>
              <Text style={styles.btnText}>Eliminar todos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startBtn} onPress={onStart}>
              <Text style={styles.btnText}>Empezar</Text>
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
});
