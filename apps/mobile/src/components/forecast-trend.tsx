import {
  areaPath,
  barsFor,
  extentOf,
  formatHourMinute,
  linePath,
  nowAsNaiveIsoTimestamp,
  pointsFor,
  type Box,
  type HourlyForecastEntry,
} from "@weather-app/core";
import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

const HOURS = 24;

/**
 * Where the next day is going, as two plots rather than one.
 *
 * Same reasoning as the web component, and the same geometry module underneath
 * - temperature and chance of rain do not share a scale, and one chart with two
 * axes makes every crossing look like an event when it is an artefact of where
 * the axes were put.
 *
 * What differs from web is the reading affordance. There is no hover on a
 * touch screen, and a scrub gesture here would fight the horizontal pager this
 * sits inside - a drag along the chart is the same drag that changes place. So
 * the extremes are labelled directly instead: the high, the low, and the wettest
 * hour are what a reader looks for, and they are on the chart without asking.
 */
export function ForecastTrend({
  entries,
  now = new Date(),
}: {
  entries: HourlyForecastEntry[];
  now?: Date;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme !== "light";

  const nowLocal = nowAsNaiveIsoTimestamp(now);
  const upcoming = entries.filter((entry) => entry.time >= nowLocal).slice(0, HOURS);

  if (upcoming.length < 2) return null;

  const ink = dark ? "#E6ECF5" : "#0F1826";
  const muted = dark ? "#8A94A6" : "#5A6474";

  return (
    <View className="gap-4">
      <TemperaturePlot entries={upcoming} ink={ink} muted={muted} />
      <RainPlot entries={upcoming} muted={muted} />
    </View>
  );
}

const BOX: Box = {
  width: 320,
  height: 96,
  padding: { top: 16, right: 8, bottom: 16, left: 8 },
};

const LINE = "#38A6E8";

function TemperaturePlot({
  entries,
  ink,
  muted,
}: {
  entries: HourlyForecastEntry[];
  ink: string;
  muted: string;
}) {
  const values = entries.map((entry) => entry.temperatureCelsius);
  const extent = extentOf(values);
  const points = pointsFor(values, extent, BOX);

  const highest = values.indexOf(Math.max(...values));
  const lowest = values.indexOf(Math.min(...values));

  return (
    <View className="gap-1">
      <Caption label="Temperatura" unit="°C" colour={muted} />

      <Svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} width="100%" height={BOX.height}>
        <Path d={areaPath(points, BOX)} fill={LINE} fillOpacity={0.12} />
        <Path
          d={linePath(points)}
          stroke={LINE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {[highest, lowest].map((index) => (
          <Marker
            key={index}
            x={points[index]!.x}
            y={points[index]!.y}
            label={`${Math.round(values[index]!)}°`}
            ink={ink}
            // Above the high and below the low, so neither label sits on the
            // line it belongs to.
            below={index === lowest}
          />
        ))}
      </Svg>

      <Hours entries={entries} colour={muted} />
    </View>
  );
}

function RainPlot({ entries, muted }: { entries: HourlyForecastEntry[]; muted: string }) {
  const values = entries.map((entry) => entry.precipitationProbabilityPercent);
  // An amount, so the axis starts at zero - bars floating off a baseline of 20%
  // would read as "no rain" for the driest hour on the chart.
  const extent = extentOf(values, { includeZero: true });
  const bars = barsFor(values, extent, BOX);

  return (
    <View className="gap-1">
      <Caption label="Szansa opadu" unit="%" colour={muted} />

      <Svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} width="100%" height={BOX.height}>
        {bars.map((bar, index) => (
          <Rect
            key={index}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={2}
            fill={LINE}
            fillOpacity={0.55}
          />
        ))}
      </Svg>
    </View>
  );
}

function Marker({
  x,
  y,
  label,
  ink,
  below,
}: {
  x: number;
  y: number;
  label: string;
  ink: string;
  below: boolean;
}) {
  return (
    <>
      {/* The ring is the surface colour rather than a lighter blue: it makes the
          dot read as sitting on the line instead of as a hole through it. */}
      <Circle cx={x} cy={y} r={3.5} fill={LINE} stroke={ink} strokeWidth={0} />
      <SvgText
        x={x}
        y={below ? y + 13 : y - 7}
        fill={ink}
        fontSize={11}
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}

function Caption({ label, unit, colour }: { label: string; unit: string; colour: string }) {
  return (
    <Text className="text-[13px] font-semibold" style={{ color: colour }}>
      {label} <Text className="font-normal">({unit})</Text>
    </Text>
  );
}

/**
 * Hours under the plot, every sixth plus the last.
 *
 * A flex row rather than SVG labels: they wear the app's font and its themed
 * ink without restating either, and spacing them evenly is close enough when
 * the readings they mark are themselves evenly spaced.
 */
function Hours({ entries, colour }: { entries: HourlyForecastEntry[]; colour: string }) {
  const shown = entries.filter(
    (_, index) => index % 6 === 0 || index === entries.length - 1,
  );

  return (
    <View className="flex-row justify-between px-1">
      {shown.map((entry) => (
        <Text key={entry.time} className="text-[10px]" style={{ color: colour }}>
          {formatHourMinute(entry.time)}
        </Text>
      ))}
    </View>
  );
}
