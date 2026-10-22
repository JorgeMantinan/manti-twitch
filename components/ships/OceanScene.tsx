import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Ellipse,
  G,
  Rect,
  Line,
} from "react-native-svg";

type Props = {
  width: number;
  height: number;
};

/**
 * Fondo de carta naval: vista cenital del mar.
 * Capas: gradiente radial (luz central), oleaje en parallax, destellos de
 * sol, isolíneas batimétricas, rejilla tactica y rosa de los vientos.
 */

const buildWave = (
  w: number,
  h: number,
  amp: number,
  wavelength: number,
  phase: number,
  close = false,
) => {
  const steps = 48;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y =
      h / 2 +
      Math.sin((x / wavelength) * Math.PI * 2 + phase) * amp +
      Math.sin((x / (wavelength * 2.3)) * Math.PI * 2 + phase * 1.7) * amp * 0.35;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const line = `M0,${h / 2} L${points.join(" L")}`;
  if (!close) return line;
  return `${line} L${w},${h} L0,${h} Z`;
};

export default function OceanScene({ width, height }: Props) {
  const scrollA = useRef(new Animated.Value(0)).current;
  const scrollB = useRef(new Animated.Value(0)).current;
  const scrollC = useRef(new Animated.Value(0)).current;

  const wl = Math.max(width, 320);
  const layers = useMemo(
    () => [
      {
        amp: height * 0.012,
        wavelength: wl * 0.42,
        phase: 0.4,
        speed: 26000,
        opacity: 0.16,
        stroke: "#7fc7e8",
        width: 1.6,
        fill: "transparent",
      },
      {
        amp: height * 0.018,
        wavelength: wl * 0.6,
        phase: 1.9,
        speed: 17000,
        opacity: 0.13,
        stroke: "#5fa8cf",
        width: 2.4,
        fill: "transparent",
      },
      {
        amp: height * 0.026,
        wavelength: wl * 0.85,
        phase: 3.3,
        speed: 11000,
        opacity: 0.1,
        stroke: "#3f7fa8",
        width: 3.4,
        fill: "transparent",
      },
    ],
    [height, wl],
  );

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(scrollA, {
          toValue: -layers[0].wavelength,
          duration: layers[0].speed,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ),
      Animated.loop(
        Animated.timing(scrollB, {
          toValue: -layers[1].wavelength,
          duration: layers[1].speed,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ),
      Animated.loop(
        Animated.timing(scrollC, {
          toValue: -layers[2].wavelength,
          duration: layers[2].speed,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ),
    ];

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [layers, scrollA, scrollB, scrollC]);

  const glints = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      out.push({
        x: width * (0.62 + t * 0.3) + Math.sin(i * 2.1) * width * 0.05,
        y: height * (0.06 + t * 0.52),
        r: 2 + ((i * 7) % 5),
        // Destellos casi invisibles: solo un susurro de luz sobre el agua.
        o: 0.012 + ((i * 3) % 4) * 0.005,
      });
    }
    return out;
  }, [width, height]);

  const gridStep = Math.max(width, height) / 12;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID="ocean-scene"
    >
      {/* Base: mar profundo con luz central */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sea" cx="50%" cy="42%" r="78%">
            <Stop offset="0" stopColor="#12506e" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#0a2e49" stopOpacity={1} />
            <Stop offset="1" stopColor="#030d18" stopOpacity={1} />
          </RadialGradient>
          <LinearGradient id="stormFog" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0b1a2e" stopOpacity={0} />
            <Stop offset="1" stopColor="#0b1a2e" stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sea)" />

        {/* Isolíneas batimétricas */}
        <G opacity={0.5}>
          <Ellipse
            cx={width * 0.5}
            cy={height * 0.46}
            rx={width * 0.42}
            ry={height * 0.4}
            stroke="#ffffff"
            strokeOpacity={0.05}
            strokeWidth={1.5}
            fill="none"
          />
          <Ellipse
            cx={width * 0.5}
            cy={height * 0.46}
            rx={width * 0.3}
            ry={height * 0.28}
            stroke="#ffffff"
            strokeOpacity={0.045}
            strokeWidth={1.5}
            fill="none"
          />
          <Ellipse
            cx={width * 0.5}
            cy={height * 0.46}
            rx={width * 0.17}
            ry={height * 0.16}
            stroke="#ffffff"
            strokeOpacity={0.04}
            strokeWidth={1.5}
            fill="none"
          />
        </G>

        {/* Rejilla tactica */}
        <G>
          {Array.from({ length: 13 }).map((_, i) => (
            <Line
              key={`gx${i}`}
              x1={(i * gridStep) % width}
              y1={0}
              x2={(i * gridStep) % width}
              y2={height}
              stroke="#9fd8ee"
              strokeOpacity={0.05}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 13 }).map((_, i) => (
            <Line
              key={`gy${i}`}
              x1={0}
              y1={(i * gridStep) % height}
              x2={width}
              y2={(i * gridStep) % height}
              stroke="#9fd8ee"
              strokeOpacity={0.05}
              strokeWidth={1}
            />
          ))}
        </G>

        {/* Destellos de sol */}
        <G>
          {glints.map((g, i) => (
            <Ellipse
              key={`gl${i}`}
              cx={g.x}
              cy={g.y}
              rx={g.r * 3.2}
              ry={g.r * 1.1}
              fill="#ffe6b0"
              opacity={g.o}
            />
          ))}
        </G>

        {/* Rosa de los vientos */}
        <G
          opacity={0.22}
          transform={`translate(${width - 54}, ${height - 54})`}
        >
          <Circle r={26} stroke="#9fd8ee" strokeWidth={1} fill="none" />
          <Circle r={19} stroke="#9fd8ee" strokeWidth={0.6} fill="none" />
          <Path
            d="M0,-24 L5,0 L0,24 L-5,0 Z"
            fill="#9fd8ee"
            fillOpacity={0.55}
          />
          <Path
            d="M-24,0 L0,-4 L24,0 L0,4 Z"
            fill="#9fd8ee"
            fillOpacity={0.25}
          />
          <Circle r={3} fill="#9fd8ee" fillOpacity={0.8} />
        </G>
      </Svg>

      {/* Oleaje en parallax */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: scrollA }] },
        ]}
      >
        <Svg width={width * 2} height={height} style={styles.waveLayer}>
          <Path
            d={buildWave(width * 2, height, layers[0].amp, layers[0].wavelength, layers[0].phase)}
            stroke={layers[0].stroke}
            strokeOpacity={layers[0].opacity}
            strokeWidth={layers[0].width}
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: scrollB }] },
        ]}
      >
        <Svg width={width * 2} height={height} style={styles.waveLayer}>
          <Path
            d={buildWave(width * 2, height, layers[1].amp, layers[1].wavelength, layers[1].phase)}
            stroke={layers[1].stroke}
            strokeOpacity={layers[1].opacity}
            strokeWidth={layers[1].width}
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: scrollC }] },
        ]}
      >
        <Svg width={width * 2} height={height} style={styles.waveLayer}>
          <Path
            d={buildWave(width * 2, height, layers[2].amp, layers[2].wavelength, layers[2].phase)}
            stroke={layers[2].stroke}
            strokeOpacity={layers[2].opacity}
            strokeWidth={layers[2].width}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Bruma baja */}
      <Svg width={width} height={height} style={styles.fog}>
        <Rect x={0} y={0} width={width} height={height} fill="url(#stormFog)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  waveLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  fog: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
