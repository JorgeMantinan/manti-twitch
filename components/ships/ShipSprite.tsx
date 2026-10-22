import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Path,
  Circle,
  Rect,
  G,
  Ellipse,
  Line,
} from "react-native-svg";

import type { ShipClassKey } from "../../utils/ships/engine";

type ShipArtProps = {
  cls: ShipClassKey;
  isSub?: boolean;
  length: number;
  width: number;
  hpRatio?: number;
  sunk?: number;
};

type TurretArtProps = {
  cls: ShipClassKey;
  isSub?: boolean;
  size: number;
};

const HULL_TINT: Record<ShipClassKey, [string, string]> = {
  fragata: ["#4a6c8f", "#1d3450"],
  destructor: ["#5a7f9e", "#20394f"],
  acorazado: ["#42607f", "#16293f"],
  submarino: ["#3c5a75", "#152636"],
};

const DECK = "#cfd8de";
const DECK_DARK = "#9fb0bd";
const OXIDE = "#8c3b2f";

const hullPath = (len: number, wid: number) => {
  const hl = len / 2;
  const hw = wid / 2;
  const bow = hl;
  const stern = -hl;
  return [
    `M ${stern},${-hw * 0.6}`,
    `L ${bow * 0.5},${-hw}`,
    `C ${bow * 0.78},${-hw * 0.95} ${bow * 0.95},${-hw * 0.4} ${bow},0`,
    `C ${bow * 0.95},${hw * 0.4} ${bow * 0.78},${hw * 0.95} ${bow * 0.5},${hw}`,
    `L ${stern},${hw * 0.6}`,
    `C ${stern - len * 0.07},${hw * 0.28} ${stern - len * 0.07},${-hw * 0.28} ${stern},${-hw * 0.6}`,
    "Z",
  ].join(" ");
};

const deckPath = (len: number, wid: number) => {
  const hl = len / 2;
  const hw = wid / 2;
  return [
    `M ${-hl * 0.88},${-hw * 0.42}`,
    `L ${hl * 0.44},${-hw * 0.72}`,
    `C ${hl * 0.7},${-hw * 0.66} ${hl * 0.82},${-hw * 0.28} ${hl * 0.86},0`,
    `C ${hl * 0.82},${hw * 0.28} ${hl * 0.7},${hw * 0.66} ${hl * 0.44},${hw * 0.72}`,
    `L ${-hl * 0.88},${hw * 0.42}`,
    "Z",
  ].join(" ");
};

export function TurretSprite({ cls, isSub, size }: TurretArtProps) {
  const [, c2] = HULL_TINT[cls];
  const r = size / 2;

  return (
    <Svg width={size} height={size} viewBox="-14 -14 28 28">
      <Defs>
        <RadialGradient id={`turret-${cls}`} cx="35%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#f2f7fa" />
          <Stop offset="0.6" stopColor="#b9c7d2" />
          <Stop offset="1" stopColor="#6b7c8c" />
        </RadialGradient>
      </Defs>

      <G>
        {/* Anillo de la torreta */}
        <Circle r={r * 0.62} fill={c2} opacity={0.9} />
        <Circle r={r * 0.52} fill={`url(#turret-${cls})`} />
        <Circle
          r={r * 0.52}
          stroke={isSub ? "#f2c14e" : "#41586e"}
          strokeWidth={0.9}
          fill="none"
          opacity={0.8}
        />

        {/* Canon */}
        <Rect
          x={r * 0.2}
          y={-r * 0.16}
          width={r * 0.92}
          height={r * 0.32}
          rx={r * 0.12}
          fill="#2b3b4d"
        />
        <Rect
          x={r * 0.86}
          y={-r * 0.1}
          width={r * 0.3}
          height={r * 0.2}
          rx={r * 0.06}
          fill="#16222f"
        />

        {isSub && (
          <Circle r={r * 0.16} fill="#f2c14e" opacity={0.9} />
        )}
      </G>
    </Svg>
  );
}

export default function ShipSprite({
  cls,
  isSub,
  length,
  width,
  hpRatio = 1,
  sunk = 0,
}: ShipArtProps) {
  const [c1, c2] = HULL_TINT[cls];
  const isSubmarine = cls === "submarino";
  const hl = length / 2;
  const hw = width / 2;

  const damage = 1 - Math.max(0, Math.min(1, hpRatio));
  const sinkOffset = sunk * length * 0.35;
  const sinkRotate = sunk * 26;

  return (
    <Svg
      width={length}
      height={width}
      viewBox={`${-hl} ${-hw} ${length} ${width}`}
      style={{ opacity: 1 - sunk * 0.65 }}
    >
      <Defs>
        <LinearGradient id={`hull-${cls}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="0.5" stopColor={c2} />
          <Stop offset="1" stopColor={c1} />
        </LinearGradient>
        <LinearGradient id={`wake-${cls}`} x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      <G transform={`rotate(${sinkRotate}) translate(0, ${sinkOffset})`}>
        {/* Estela */}
        {!isSubmarine && (
          <G opacity={0.75}>
            <Path
              d={`M ${-hl * 0.92},${-hw * 0.42} C ${-hl * 1.5},${-hw * 0.95} ${-hl * 1.9},${-hw * 1.3} ${-hl * 2.5},${-hw * 1.5}
                  L ${-hl * 2.5},${-hw * 0.95} C ${-hl * 1.9},${-hw * 0.8} ${-hl * 1.45},${-hw * 0.5} ${-hl * 0.92},${-hw * 0.2} Z`}
              fill={`url(#wake-${cls})`}
            />
            <Path
              d={`M ${-hl * 0.92},${hw * 0.42} C ${-hl * 1.5},${hw * 0.95} ${-hl * 1.9},${hw * 1.3} ${-hl * 2.5},${hw * 1.5}
                  L ${-hl * 2.5},${hw * 0.95} C ${-hl * 1.9},${hw * 0.8} ${-hl * 1.45},${hw * 0.5} ${-hl * 0.92},${hw * 0.2} Z`}
              fill={`url(#wake-${cls})`}
            />
          </G>
        )}

        {/* Casco */}
        <Path d={hullPath(length, width)} fill={`url(#hull-${cls})`} />
        <Path
          d={hullPath(length, width)}
          stroke={isSub ? "#f2c14e" : OXIDE}
          strokeWidth={width * 0.055}
          strokeOpacity={isSub ? 0.75 : 0.5}
          fill="none"
        />

        {/* Cubierta */}
        <Path d={deckPath(length, width)} fill={DECK} opacity={0.9} />
        <Path
          d={deckPath(length, width)}
          stroke={DECK_DARK}
          strokeWidth={0.8}
          fill="none"
          opacity={0.9}
        />

        {/* Lineas de cubierta */}
        <G stroke={DECK_DARK} strokeWidth={0.7} opacity={0.75}>
          <Lineish x1={hl * 0.2} y1={-hw * 0.45} x2={hl * 0.2} y2={hw * 0.45} />
          <Lineish x1={-hl * 0.3} y1={-hw * 0.5} x2={-hl * 0.3} y2={hw * 0.5} />
        </G>

        {isSubmarine ? (
          <>
            {/* Torre de mando */}
            <Rect
              x={-hl * 0.1}
              y={-hw * 0.28}
              width={hl * 0.26}
              height={hw * 0.56}
              rx={hw * 0.12}
              fill={DECK}
              stroke={DECK_DARK}
              strokeWidth={0.8}
            />
            <Rect
              x={-hl * 0.02}
              y={-hw * 0.16}
              width={hl * 0.08}
              height={hw * 0.32}
              rx={1}
              fill="#7fe3ff"
              opacity={0.85}
            />
          </>
        ) : (
          <>
            {/* Superestructura */}
            <Rect
              x={-hl * 0.2}
              y={-hw * 0.42}
              width={hl * 0.42}
              height={hw * 0.84}
              rx={hw * 0.16}
              fill={DECK}
              stroke={DECK_DARK}
              strokeWidth={0.9}
            />
            {/* Puente */}
            <Rect
              x={hl * 0.1}
              y={-hw * 0.3}
              width={hl * 0.16}
              height={hw * 0.6}
              rx={hw * 0.1}
              fill="#e9eff3"
              stroke={DECK_DARK}
              strokeWidth={0.8}
            />
            <Rect
              x={hl * 0.12}
              y={-hw * 0.2}
              width={hl * 0.07}
              height={hw * 0.4}
              rx={1}
              fill="#7fe3ff"
              opacity={0.9}
            />
            {/* Chimenea */}
            <Rect
              x={-hl * 0.4}
              y={-hw * 0.26}
              width={hl * 0.18}
              height={hw * 0.52}
              rx={hw * 0.1}
              fill="#33475c"
              stroke={isSub ? "#f2c14e" : "#1c2b3a"}
              strokeWidth={0.9}
            />
            <Ellipse
              cx={-hl * 0.31}
              cy={0}
              rx={hl * 0.04}
              ry={hw * 0.2}
              fill="#101b26"
              opacity={0.85}
            />
          </>
        )}

        {/* Mástil y bandera */}
        <G>
          <Circle cx={-hl * 0.02} cy={-hw * 0.62} r={width * 0.035} fill="#e9eff3" />
          <Lineish
            x1={-hl * 0.02}
            y1={-hw * 0.62}
            x2={-hl * 0.02}
            y2={-hw * 0.62 - width * 0.16}
            stroke="#e9eff3"
            strokeWidth={width * 0.02}
          />
          <Path
            d={`M ${-hl * 0.02},${-hw * 0.62 - width * 0.16} l ${width * 0.12},${width * 0.05} l ${-width * 0.12},${width * 0.05} Z`}
            fill={isSub ? "#f2c14e" : "#d9534f"}
          />
        </G>

        {/* Ondas de proa */}
        <G opacity={0.55}>
          <Path
            d={`M ${hl * 0.72},${-hw * 0.5} q ${hl * 0.16},${hw * 0.2} ${hl * 0.22},${hw * 0.5}`}
            stroke="#dff2fb"
            strokeWidth={width * 0.035}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={`M ${hl * 0.72},${hw * 0.5} q ${hl * 0.16},${-hw * 0.2} ${hl * 0.22},${-hw * 0.5}`}
            stroke="#dff2fb"
            strokeWidth={width * 0.035}
            fill="none"
            strokeLinecap="round"
          />
        </G>

        {/* Daño */}
        {damage > 0.15 && (
          <G>
            <Ellipse
              cx={hl * 0.18}
              cy={-hw * 0.25}
              rx={length * 0.09}
              ry={width * 0.13}
              fill="#15181c"
              opacity={Math.min(0.75, damage)}
            />
          </G>
        )}
        {damage > 0.45 && (
          <Ellipse
            cx={-hl * 0.12}
            cy={hw * 0.3}
            rx={length * 0.08}
            ry={width * 0.11}
            fill="#15181c"
            opacity={Math.min(0.7, damage - 0.2)}
          />
        )}
        {damage > 0.7 && (
          <Ellipse
            cx={hl * 0.34}
            cy={hw * 0.18}
            rx={length * 0.07}
            ry={width * 0.09}
            fill="#15181c"
            opacity={Math.min(0.6, damage - 0.4)}
          />
        )}
      </G>
    </Svg>
  );
}

function Lineish({
  x1,
  y1,
  x2,
  y2,
  stroke,
  strokeWidth,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} />;
}
