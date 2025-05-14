"use client";

import React, { useState, useMemo } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import WithControl from "../ui/carousel/WithControl";
import { Image } from "@/types/images";
import { useCloudConnectorsForItems } from "@/hooks/type-query/useCloudConnectors";
import Label from "../form/Label";

interface BaseImageSelectionProps {
  images: Image[];
  onSelect: (image: Image) => void;
}

const BaseImageSelection: React.FC<BaseImageSelectionProps> = ({ images, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null); // Track the selected image ID
  const { resourcesById: connectorsById } = useCloudConnectorsForItems(images);

  const enrichedImages = useMemo(
    () =>
      images.map((image) => {
        const matchingConnector = image.cloudConnectorId ? connectorsById[image.cloudConnectorId] : null;

        return {
          ...image,
          cloudConnector: matchingConnector || undefined,
        };
      }),
    [connectorsById]
  );

  const [processedImages] = useState(() => {
    // Process images only once when the component is mounted
    return enrichedImages.map((image) => {
      return {
        ...image,
        latency: Math.floor(Math.random() * 200), // Random latency between 0-200ms
        tags: ["Java", "Spring", "Angular", "React", "Node.js"]
          .sort(() => 0.5 - Math.random())
          .slice(0, 3), // Randomly select 3 tags
      };
    });
  });

  // Filter images based on search term
  const filteredImages = useMemo(() => {
    return processedImages.filter((image) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        image.name.toLowerCase().includes(searchLower) ||
        image.description.toLowerCase().includes(searchLower) ||
        image.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    });
  }, [processedImages, searchTerm]);

  // Handle image selection
  const handleSelectImage = (image: Image) => {
    setSelectedImageId(image.id); // Update the selected image ID
    onSelect(image); // Trigger the onSelect callback
  };

  // Render latency icon
  const renderLatencyIcon = (latency: number) => {
    const bars = latency <= 75 ? 3 : latency <= 150 ? 2 : 1;
    const colorClass = latency <= 75 ? "text-green-500" : latency <= 150 ? "text-orange-500" : "text-red-500";

    return (
      <div className="absolute top-2 right-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className={`w-6 h-6 ${colorClass}`}
        >
          {/* Left Bar */}
          <rect
            x="3"
            y="12"
            width="4"
            height="9"
            rx="1"
            className={bars >= 1 ? "" : "opacity-20"}
          />
          {/* Middle Bar */}
          <rect
            x="10"
            y={bars >= 2 ? "6" : "20"} // Reduce height for medium/high latency
            width="4"
            height={bars >= 2 ? "15" : "1"} // Tiny rectangle for high latency
            rx="1"
            className={bars >= 2 ? "" : "opacity-20"}
          />
          {/* Right Bar */}
          <rect
            x="17"
            y={bars >= 3 ? "3" : "20"} // Reduce height for medium/high latency
            width="4"
            height={bars >= 3 ? "18" : "1"} // Tiny rectangle for medium/high latency
            rx="1"
            className={bars >= 3 ? "" : "opacity-20"}
          />
        </svg>
      </div>
    );
  };

  if (filteredImages.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No images match your search.</p>;
  }

  return (
    <>
      {/* Search Bar */}
      <div className="mb-4 flex justify-between items-center">
        <Label>Base Image</Label>

        <form onSubmit={(e) => e.preventDefault()} className="relative">
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-5 h-5 text-gray-400 dark:text-gray-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 1 0-10.6 0 7.5 7.5 0 0 0 10.6 0z"
              />
            </svg>
          </div>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search images..."
            className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
    </div>

      {/* Carousel */}
        <WithControl slidesPerView={3} spaceBetween={15}>
          {filteredImages.map((image) => (
            <div
              key={image.id}
              onClick={() => handleSelectImage(image)} // Handle card selection
              className={`relative cursor-pointer transition-transform duration-300 ${
                selectedImageId === image.id
                  ? "border-green-500 scale-100 opacity-100" // Highlight selected card
                  : "border-transparent scale-85 opacity-50" // Dim and scale down non-selected cards
              } border rounded-lg flex flex-col`} // Use Flexbox for consistent alignment
            >
              <Card className="h-full flex flex-col">
                {/* Latency Icon */}
                {renderLatencyIcon(image.latency)}
          
                {/* Image Details */}
                <CardTitle className="text-lg font-bold">{image.name}</CardTitle>
                <CardDescription className="mb-4">{image.description}</CardDescription>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <strong>Identifier:</strong> {image.identifier}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <strong>Cloud Provider:</strong> {image.cloudConnector?.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <strong>Last Updated:</strong> {image.updatedOn}
                </p>
          
                {/* Tags */}
                <div className="mt-auto flex flex-wrap gap-2">
                  {image.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
              
              {/* Green Checkmark for Selected Card */}
              {selectedImageId === image.id && (
                <div className="absolute bottom-2 right-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-6 h-6 text-green-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </WithControl>
    </>
  );
};

export default BaseImageSelection;