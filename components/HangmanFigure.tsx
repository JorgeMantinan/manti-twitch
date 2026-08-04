import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  misses: number;
};

const PARTS = ["head", "body", "armLeft", "armRight", "legLeft", "legRight"] as const;

export default function HangmanFigure({ misses }: Props) {
  const visible = PARTS.filter((_, i) => i < misses);

  return (
    <View style={styles.wrapper}>
      <View style={styles.figure}>
        <View style={styles.base} />
        <View style={styles.pole} />
        <View style={styles.topBar} />
        <View style={styles.rope} />
        {visible.includes("head") && <View style={styles.head} />}
        {visible.includes("body") && <View style={styles.body} />}
        {visible.includes("armLeft") && <View style={styles.armLeft} />}
        {visible.includes("armRight") && <View style={styles.armRight} />}
        {visible.includes("legLeft") && <View style={styles.legLeft} />}
        {visible.includes("legRight") && <View style={styles.legRight} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    marginVertical: 10,
  },

  figure: {
    width: 180,
    height: 215,
    position: "relative",
  },

  base: {
    position: "absolute",
    bottom: 15,
    left: 30,
    width: 120,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#6b4f3a",
  },

  pole: {
    position: "absolute",
    top: 15,
    left: 45,
    width: 8,
    height: 190,
    backgroundColor: "#6b4f3a",
  },

  topBar: {
    position: "absolute",
    top: 7,
    left: 45,
    width: 100,
    height: 8,
    borderRadius: 3,
    backgroundColor: "#6b4f3a",
  },

  rope: {
    position: "absolute",
    top: 15,
    left: 137,
    width: 6,
    height: 22,
    backgroundColor: "#8a6b4f",
  },

  head: {
    position: "absolute",
    top: 37,
    left: 123,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e8b88a",
  },

  body: {
    position: "absolute",
    top: 71,
    left: 136,
    width: 8,
    height: 62,
    borderRadius: 3,
    backgroundColor: "#c94b4b",
  },

  armLeft: {
    position: "absolute",
    top: 82,
    left: 104,
    width: 34,
    height: 7,
    borderRadius: 3,
    backgroundColor: "#c94b4b",
    transform: [{ rotate: "25deg" }],
  },

  armRight: {
    position: "absolute",
    top: 82,
    left: 138,
    width: 34,
    height: 7,
    borderRadius: 3,
    backgroundColor: "#c94b4b",
    transform: [{ rotate: "-25deg" }],
  },

  legLeft: {
    position: "absolute",
    top: 122,
    left: 116,
    width: 34,
    height: 7,
    borderRadius: 3,
    backgroundColor: "#c94b4b",
    transform: [{ rotate: "45deg" }],
  },

  legRight: {
    position: "absolute",
    top: 122,
    left: 128,
    width: 34,
    height: 7,
    borderRadius: 3,
    backgroundColor: "#c94b4b",
    transform: [{ rotate: "-45deg" }],
  },
});
