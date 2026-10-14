import React, { memo } from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image,
  Path,
  Text as SvgText,
  TextPath,
} from "react-native-svg";

export type WheelSlice = {
  label: string;
  real: string;
  avatar?: string;
};

const LIGHT_SLICES = [
  { fill: "#C5A582", text: "#FFFFFF" },
  { fill: "#F5EFE7", text: "#5A4632" },
  { fill: "#CE7B5B", text: "#FFFFFF" },
  { fill: "#EADCC6", text: "#5A4632" },
  { fill: "#A9866B", text: "#FFFFFF" },
  { fill: "#F7F1E8", text: "#5A4632" },
];

const DARK_SLICES = [
  { fill: "#8A6A4B", text: "#FFFFFF" },
  { fill: "#3A342C", text: "#E8DCC8" },
  { fill: "#B5654A", text: "#FFFFFF" },
  { fill: "#4A4034", text: "#E8DCC8" },
  { fill: "#6E5440", text: "#FFFFFF" },
  { fill: "#2E2A24", text: "#D8C8B0" },
];

const WHEEL_FONT = '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';

type Props = {
  slices: WheelSlice[];
  winner: string | null;
  size: number;
  dark: boolean;
};

export default memo(function WheelSvg({ slices, winner, size, dark }: Props) {
  const center = size / 2;
  const radius = center - 24;
  const palette = dark ? DARK_SLICES : LIGHT_SLICES;
  const slice = 360 / Math.max(slices.length, 1);

  const useArc = slices.length >= 4 && slices.length <= 16;
  const showAvatars = slices.length <= 12;

  const nodes = slices.map((p, i) => {
    const start = i * slice;
    const end = start + slice;
    const mid = start + slice / 2;

    const x1 = center + radius * Math.cos((Math.PI * start) / 180);
    const y1 = center + radius * Math.sin((Math.PI * start) / 180);
    const x2 = center + radius * Math.cos((Math.PI * end) / 180);
    const y2 = center + radius * Math.sin((Math.PI * end) / 180);

    const path = `
M ${center} ${center}
L ${x1} ${y1}
A ${radius} ${radius} 0 0 1 ${x2} ${y2}
Z
`;

    const colors = palette[i % palette.length];
    const isWinner = !!winner && p.real === winner;

    const avatarR = radius * 0.4;
    const ax = center + avatarR * Math.cos((Math.PI * mid) / 180);
    const ay = center + avatarR * Math.sin((Math.PI * mid) / 180);

    const textR = p.avatar && showAvatars ? radius * 0.72 : radius * 0.64;

    const fs =
      slices.length > 60 ? "10" : slices.length > 25 ? "13" : slices.length <= 4 ? "15" : "16";

    let labelNode;

    if (useArc && p.label.length <= 14) {
      const pad = Math.min(slice * 0.12, 8);
      const a1 = (mid - slice / 2 + pad) * (Math.PI / 180);
      const a2 = (mid + slice / 2 - pad) * (Math.PI / 180);
      const arcR = textR;
      const p1x = center + arcR * Math.cos(a1);
      const p1y = center + arcR * Math.sin(a1);
      const p2x = center + arcR * Math.cos(a2);
      const p2y = center + arcR * Math.sin(a2);
      const arcD = `M ${p1x} ${p1y} A ${arcR} ${arcR} 0 0 1 ${p2x} ${p2y}`;

      labelNode = (
        <>
          <Defs>
            <Path id={`mra-arc-${i}`} d={arcD} />
          </Defs>
          <SvgText
            fontSize={fs}
            fontFamily={WHEEL_FONT}
            fill={isWinner ? "#3A2F26" : colors.text}
            fontWeight="700"
          >
            <TextPath
              href={`#mra-arc-${i}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {p.label.toUpperCase()}
            </TextPath>
          </SvgText>
        </>
      );
    } else {
      const textAngle = mid;
      const tx = center + textR * Math.cos((Math.PI * textAngle) / 180);
      const ty = center + textR * Math.sin((Math.PI * textAngle) / 180);

      labelNode = (
        <SvgText
          x={tx}
          y={ty}
          fontSize={fs}
          fontFamily={WHEEL_FONT}
          fill={isWinner ? "#3A2F26" : colors.text}
          fontWeight="700"
          letterSpacing="0.5"
          textAnchor="middle"
          alignmentBaseline="middle"
          rotation={textAngle}
          origin={`${tx},${ty}`}
        >
          {p.label.toUpperCase()}
        </SvgText>
      );
    }

    return (
      <G key={`${p.real}-${i}`}>
        <Path
          d={path}
          fill={isWinner ? "#FFD700" : colors.fill}
          stroke={dark ? "#1C1C1E" : "#FFFFFF"}
          strokeWidth={1}
        />

        {p.avatar && showAvatars && (
          <>
            <Defs>
              <ClipPath id={`mra-clip-${i}`}>
                <Circle cx={ax} cy={ay} r={13} />
              </ClipPath>
            </Defs>
            <Circle cx={ax} cy={ay} r={14} fill={dark ? "#1C1C1E" : "#FFFFFF"} />
            <Image
              href={p.avatar}
              x={ax - 13}
              y={ay - 13}
              width={26}
              height={26}
              clipPath={`url(#mra-clip-${i})`}
            />
          </>
        )}

        {slices.length <= 120 && labelNode}
      </G>
    );
  });

  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id="mra-clip-none">
          <Circle cx={center} cy={center} r={0} />
        </ClipPath>
      </Defs>
      <Circle cx={center} cy={center} r={radius + 16} fill={dark ? "#2A2622" : "#EDE4D6"} />
      {nodes}
      <Circle
        cx={center}
        cy={center}
        r={radius + 8}
        fill="none"
        stroke="#C5A582"
        strokeWidth={10}
      />
      <Circle
        cx={center}
        cy={center}
        r={68}
        fill={dark ? "#24201C" : "#FAF7F2"}
        stroke="#C5A582"
        strokeWidth={4}
      />
    </Svg>
  );
});
