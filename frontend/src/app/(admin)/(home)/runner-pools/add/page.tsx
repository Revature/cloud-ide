import RunnerPoolForm from "@/components/runner-pool/RunnerPoolForm";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export default function AddRunnerPoolPage() {
  const breadcrumbItems = [
    { label: "Runner Pools", href: "/runner-pools" },
    { label: "Add Runner Pool" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems}>
      <RunnerPoolForm />
    </AdminPageLayout>
  );
}