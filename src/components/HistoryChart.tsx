import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ReportV1 } from "@/reports/format";

/**
 * Overall score over time. Loaded lazily (Recharts). Exposed to assistive tech as one image with a
 * text equivalent; the list beside it carries the same data in full. Unscored scans are gaps, not zeros.
 */
export default function HistoryChart({ entries, formatDate }: { entries: ReportV1[]; formatDate: (ms: number) => string }) {
  const data = entries.map((r) => ({ t: r.createdAt, score: r.scores.overall }));
  const alt = `Line chart of overall score over time: ${entries.map((r) => `${formatDate(r.createdAt)} ${r.scores.overall ?? "no score"}`).join(", ")}.`;
  return (
    <div className="h-56 w-full" role="img" aria-label={alt}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} accessibilityLayer={false}>
          <CartesianGrid stroke="#3a2f4d" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => formatDate(v)}
            tick={{ fill: "#a89bb5", fontSize: 11 }} stroke="#3a2f4d" tickCount={5} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#a89bb5", fontSize: 11 }} stroke="#3a2f4d" />
          <Line type="monotone" dataKey="score" stroke="#a879ff" strokeWidth={3} dot={{ r: 4, fill: "#f1ddfe", stroke: "#a879ff" }}
            connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
