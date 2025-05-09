import RunnerFormWithTerminal from "@/components/runner/RunnerFormwithTerminal";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export default function AddRunnerPage() {
  const breadcrumbItems = [
    { label: "Runners", href: "/runners" },
    { label: "Add Runner" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <RunnerFormWithTerminal />
    </AdminPageLayout>
  );
}