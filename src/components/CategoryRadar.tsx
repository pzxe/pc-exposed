import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { CategoryScore } from "@/engine/types";

/**
 * Radar of the categories that could be scored (unscored categories are omitted, not zeroed).
 * Loaded lazily because it is the only user of Recharts. The chart is exposed to assistive
 * tech as one image with a text equivalent, and Recharts' own keyboard layer is turned off
 * (it created a focusable SVG inside an aria-hidden region).
 */
export default function CategoryRadar({ categories }: { categories: CategoryScore[] }) {
  const scored = categories.filter((c) => c.score !== null);
  const data = scored.map((c) => ({ subject: c.label, value: c.score as number }));
  if (data.length < 3) return <p className="text-sm text-muted">Not enough scored categories for a chart.</p>;
  const alt = `Radar chart of category scores: ${scored.map((c) => `${c.label} ${c.score}`).join(", ")}.`;
  return (
    <div className="h-64 w-full" role="img" aria-label={alt}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%" accessibilityLayer={false}>
          <PolarGrid stroke="#3a2f4d" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#a89bb5", fontSize: 11 }} />
          <Radar dataKey="value" stroke="#a879ff" fill="#a879ff" fillOpacity={0.35} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
