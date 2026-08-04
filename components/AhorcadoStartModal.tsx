import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

type Role = "viewer" | "mod" | "streamer";

type Props = {
  visible: boolean;
  role: Role;
  streamer: string;
  setStreamer: (v: string) => void;
  subsOnly: boolean;
  setSubsOnly: (v: boolean) => void;
  onStart: () => void;
  onClose: () => void;
};

export default function AhorcadoStartModal({
  visible,
  role,
  streamer,
  setStreamer,
  subsOnly,
  setSubsOnly,
  onStart,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeCorner} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Ahorcado</Text>

          <Text style={styles.hint}>
            Escribe !ahorcado &quot;la frase&quot; en el chat del canal para
            adivinar
          </Text>

          {role === "mod" && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Canal del Streamer:</Text>
              <TextInput
                style={styles.inputFull}
                placeholder="Nombre del canal"
                value={streamer}
                onChangeText={setStreamer}
              />
            </View>
          )}

          {role === "streamer" && (
            <TouchableOpacity
              style={[styles.subsBtn, subsOnly && styles.subsBtnOn]}
              onPress={() => setSubsOnly(!subsOnly)}
            >
              <Text style={styles.btnText}>
                {subsOnly ? "SOLO SUBS: ACTIVADO" : "OBTENER SUBS"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomRow}>
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

  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  hint: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 15,
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

  inputFull: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 4,
    width: "100%",
  },

  subsBtn: {
    backgroundColor: "#C5A582",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 15,
  },

  subsBtnOn: {
    backgroundColor: "#4CAF50",
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 5,
  },

  startBtn: {
    backgroundColor: "#C5A582",
    padding: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: "center",
  },

  btnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
