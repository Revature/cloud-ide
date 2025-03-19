import ProxyImage from "@/components/ui/images/ProxyImage";
import React from "react";

export default function ThreeColumnImageGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <ProxyImage
          src="/images/grid-image/image-04.png"
          alt=" grid"
          className="w-full border border-gray-200 rounded-xl dark:border-gray-800"
          width={338}
          height={192}
        />
      </div>

      <div>
        <ProxyImage
          src="/images/grid-image/image-05.png"
          alt=" grid"
          className="w-full border border-gray-200 rounded-xl dark:border-gray-800"
          width={338}
          height={192}
        />
      </div>

      <div>
        <ProxyImage
          src="/images/grid-image/image-06.png"
          alt=" grid"
          className="w-full border border-gray-200 rounded-xl dark:border-gray-800"
          width={338}
          height={192}
        />
      </div>
    </div>
  );
}
