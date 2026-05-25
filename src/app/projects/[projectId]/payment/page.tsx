import { redirect } from "next/navigation";
import { PaymentStep } from "@/components/payment-step";
import { WizardShell } from "@/components/wizard-shell";
import { getProjectRoute } from "@/lib/projects/flow";
import { getProjectDetail } from "@/lib/projects/load-project";

export default async function PaymentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  if (!project.analysis || !project.preference) {
    redirect(getProjectRoute(project.id, project.status));
  }

  const canonicalRoute = getProjectRoute(project.id, project.status);
  const paymentRoute = `/projects/${project.id}/payment`;
  const allowPaymentEntry = project.status === "INTERVIEW_COMPLETE" || project.status === "BRIEF_READY";
  if (!allowPaymentEntry && canonicalRoute !== paymentRoute) {
    redirect(canonicalRoute);
  }

  return (
    <WizardShell
      currentStep="generating"
      title="确认并支付"
      description="确认订单信息并完成支付，支付成功后即可开始生成。"
    >
      <PaymentStep project={JSON.parse(JSON.stringify(project))} />
    </WizardShell>
  );
}
