import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  player: string;
  onClose: () => void;
  onReplay?: () => void;
};

export default function BingoWinModal({
  visible,
  title,
  player,
  onClose,
  onReplay,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.player}>{player}</Text>

          <View style={styles.buttonRow}>
            {onReplay && (
              <TouchableOpacity style={styles.button} onPress={onReplay}>
                <Text style={{ color: "#fff" }}>Reproducir audio</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={{ color: "#fff" }}>Cerrar</Text>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    backgroundColor: "#fff",
    padding: 80,
    borderRadius: 10,
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
  },

  player: {
    fontSize: 22,
    marginVertical: 20,
  },

  button: {
    backgroundColor: "#C5A582",
    padding: 12,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
});
