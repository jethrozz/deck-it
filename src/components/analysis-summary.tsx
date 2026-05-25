import type { ReactNode } from "react";
import React from "react";
import { AlertCircle, BedDouble, Home, Lamp, Route } from "lucide-react";
import { roomLabels } from "@/lib/projects/labels";
import { cx, Surface } from "@/components/ui/primitives";
import type { FloorPlanAnalysis } from "@/lib/domain/schemas";

const issueLabels = {
  lighting: "采光分析",
  circulation: "动线分析",
  storage: "收纳需求",
  layout: "布局建议",
  unclear: "待确认项"
} as const;

export function AnalysisSummary({
  analysis,
  className
}: {
  analysis: FloorPlanAnalysis;
  className?: string;
}) {
  const roomSummary = analysis.rooms.reduce<Record<string, number>>((accumulator, room) => {
    const label = roomLabels[room.type];
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <Surface className={cx("grid gap-4 p-4 md:gap-5 md:p-5", className)}>
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">分析摘要</h2>
        <SummaryRow
          icon={<Home size={16} />}
          title="空间组成"
          body={Object.entries(roomSummary)
            .map(([label, count]) => `${count} 个${label}`)
            .join(" / ")}
        />
        <SummaryRow
          icon={<Lamp size={16} />}
          title="空间关系"
          body={analysis.relationships.join("，") || "已识别户型主要关系。"}
        />
        {analysis.issues.slice(0, 3).map((issue) => (
          <SummaryRow
            key={`${issue.type}-${issue.description}`}
            icon={issue.type === "storage" ? <BedDouble size={16} /> : <Route size={16} />}
            title={issueLabels[issue.type]}
            body={issue.description}
          />
        ))}
        {analysis.uncertainItems.length > 0 ? (
          <SummaryRow
            icon={<AlertCircle size={16} />}
            title="建议确认"
            body={analysis.uncertainItems.join("，")}
          />
        ) : null}
      </div>
    </Surface>
  );
}

function SummaryRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--accent)]">{icon}</span>
        {title}
      </div>
      <p className="pl-9 text-sm leading-6 text-[var(--muted)]">{body}</p>
    </div>
  );
}
