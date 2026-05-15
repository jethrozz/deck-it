type BriefPreviewProps = {
  project: {
    analysis?: { analysisJson: unknown } | null;
    preference?: { profileJson: unknown } | null;
    designPlan?: { planJson: unknown } | null;
    renderings: Array<{ id: string; spaceType: string; imageUrl: string | null; status: string }>;
    briefExports: Array<{ id: string; status: string; fileUrl: string | null; createdAt?: string }>;
  };
};

export function BriefPreview({ project }: BriefPreviewProps) {
  const readyRenderings = project.renderings.filter(
    (asset) => asset.status === "READY" && typeof asset.imageUrl === "string"
  );

  const latestBrief = project.briefExports[0];

  return (
    <section className="grid gap-4 rounded-md border border-[var(--line)] bg-[#fcfbf8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">方案预览</h3>
        <p className="text-xs text-[var(--muted)]">
          效果图 {readyRenderings.length}/{project.renderings.length} | PDF{" "}
          {latestBrief ? latestBrief.status : "未生成"}
        </p>
      </div>

      <pre className="max-h-80 overflow-auto rounded-md bg-[#f3f0e8] p-3 text-xs leading-relaxed">
        {JSON.stringify(
          {
            analysis: project.analysis?.analysisJson ?? null,
            preference: project.preference?.profileJson ?? null,
            plan: project.designPlan?.planJson ?? null,
            renderings: project.renderings,
            brief: latestBrief ?? null
          },
          null,
          2
        )}
      </pre>
    </section>
  );
}
