"use client";

import type { AdminActivityPoint } from "@/lib/types";

const seriesConfig = [
  { key: "answers", label: "Answers", stroke: "#111827", fill: "rgba(17,24,39,0.08)" },
  { key: "players", label: "Players", stroke: "rgba(17,24,39,0.55)", fill: "transparent" },
  { key: "messages", label: "Messages", stroke: "rgba(17,24,39,0.24)", fill: "transparent" }
] as const;

function buildPoints(values: number[], width: number, height: number, maxValue: number) {
  const len = Math.max(values.length, 1);
  const stepX = len > 1 ? width / (len - 1) : 0;

  return values.map((value, index) => ({
    x: index * stepX,
    y: height - (value / maxValue) * height
  }));
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number) {
  if (points.length === 0) {
    return "";
  }

  return `${buildLinePath(points)} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
}

export function ActivityChart({
  data,
  totalPlayers
}: {
  data: AdminActivityPoint[];
  totalPlayers?: number;
}) {
  const chartWidth = 760;
  const chartHeight = 240;
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.players, item.messages, item.answers]));
  const totals = {
    answers: data.reduce((sum, item) => sum + item.answers, 0),
    players: typeof totalPlayers === "number" ? totalPlayers : data.reduce((sum, item) => sum + item.players, 0),
    messages: data.reduce((sum, item) => sum + item.messages, 0)
  };
  const series = seriesConfig.map((item) => {
    const values = data.map((point) => point[item.key]);
    const points = buildPoints(values, chartWidth, chartHeight, maxValue);

    return {
      ...item,
      values,
      points,
      linePath: buildLinePath(points),
      areaPath: item.fill !== "transparent" ? buildAreaPath(points, chartHeight) : "",
      total: totals[item.key]
    };
  });
  const answersSeries = series[0];

  return (
    <div className="rounded-[32px] border border-black/8 bg-white/86 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-black/42">Last 7 Days</div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-black">Activity graph</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-black/48">
            One clean read of answer volume, player activation, and message flow without the old pulse blocks.
          </p>
        </div>

        <div className="flex flex-wrap gap-5">
          {series.map((item) => (
            <div key={item.key} className="min-w-[112px]">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-black/42">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.stroke }} />
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-black">{item.total}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border border-black/6 bg-[linear-gradient(180deg,rgba(15,23,42,0.015),rgba(15,23,42,0.04))] p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 34}`} className="min-w-full">
            {Array.from({ length: 4 }, (_, index) => {
              const y = (chartHeight / 3) * index;
              return (
                <line
                  key={index}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="rgba(15,23,42,0.08)"
                  strokeDasharray="5 8"
                />
              );
            })}

            {series.map((item) =>
              item.areaPath ? <path key={`${item.key}-area`} d={item.areaPath} fill={item.fill} /> : null
            )}

            {series.map((item) => (
              <path
                key={item.key}
                d={item.linePath}
                fill="none"
                stroke={item.stroke}
                strokeWidth={item.key === "answers" ? 3.5 : 2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {answersSeries.points.map((point, index) => (
              <g key={data[index]?.date ?? index}>
                <circle cx={point.x} cy={point.y} r="5.5" fill="white" stroke="#111827" strokeWidth="2" />
                <text
                  x={point.x}
                  y={chartHeight + 24}
                  textAnchor="middle"
                  className="fill-black/45 text-[11px] font-bold"
                >
                  {data[index]?.date.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.map((point) => (
            <div key={point.date} className="border-l border-black/8 pl-3 first:border-l-0 first:pl-0">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-black/38">{point.date}</div>
              <div className="mt-1 text-sm font-bold text-black/58">
                {point.answers} answers, {point.players} players, {point.messages} messages
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
