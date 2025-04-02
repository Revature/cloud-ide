import ProxyImage from "@/components/ui/images/ProxyImage";
import React from "react";

export default function TwoColumnImageGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <ProxyImage
          src="images/grid-image/image-02.png"
          alt=" grid"
          className="w-full border border-gray-200 rounded-xl dark:border-gray-800"
          width={517}
          height={295}
        />
      </div>

      <div>
        <ProxyImage
          src="images/grid-image/image-03.png"
          alt=" grid"
          className="w-full border border-gray-200 rounded-xl dark:border-gray-800"
          width={517}
          height={295}
        />
      </div>
    </div>
  );
}
