"use client";

import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import Button from "@/components/ui/button/Button";

interface AdminPageLayoutProps {
  breadcrumbs: { label: string; href?: string }[];
  children: React.ReactNode;
}

export default function AdminPageLayout({
  breadcrumbs,
  children,
}: AdminPageLayoutProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back(); // Navigate to the last visited page
  };

  // Prepend the "Home" breadcrumb
  const fullBreadcrumbs = [{ label: "Home", href: "/home" }, ...breadcrumbs];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb items={fullBreadcrumbs} variant="withIcon" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="flex items-center"
        >
          <svg
            className="fill-current mr-2"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M2.58301 9.99868C2.58272 10.1909 2.65588 10.3833 2.80249 10.53L7.79915 15.5301C8.09194 15.8231 8.56682 15.8233 8.85981 15.5305C9.15281 15.2377 9.15297 14.7629 8.86018 14.4699L5.14009 10.7472L16.6675 10.7472C17.0817 10.7472 17.4175 10.4114 17.4175 9.99715C17.4175 9.58294 17.0817 9.24715 16.6675 9.24715L5.14554 9.24715L8.86017 5.53016C9.15297 5.23717 9.15282 4.7623 8.85983 4.4695C8.56684 4.1767 8.09197 4.17685 7.79917 4.46984L2.84167 9.43049C2.68321 9.568 2.58301 9.77087 2.58301 9.99715C2.58301 9.99766 2.58301 9.99817 2.58301 9.99868Z"
              fill=""
            />
          </svg>
          Back
        </Button>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05] rounded-xl p-6">
          {children}
        </div>
      </div>
    </div>
  );
}