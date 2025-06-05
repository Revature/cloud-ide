"use client";

import React from "react";
import { Navigation, Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

interface WithControlProps {
  children?: React.ReactNode;
  slidesPerView?: number; // Number of slides visible at a time
  spaceBetween?: number; // Space between slides
}

export default function WithControl({
  children,
  slidesPerView = 3,
  spaceBetween = 20,
}: WithControlProps) {
  return (
    <div className="relative border border-gray-200 rounded-lg carouselTwo dark:border-gray-800">
      <Swiper
        modules={[Navigation, Autoplay]}
        autoplay={{
          delay: 20000, // Automatically cycle every 20 seconds
          disableOnInteraction: false, // Keep autoplay active even after user interaction
        }}
        navigation={{
          nextEl: ".next-style-one.swiper-button-next",
          prevEl: ".prev-style-one.swiper-button-prev",
        }}
        slidesPerView={slidesPerView}
        spaceBetween={spaceBetween}
      >
        {/* Render children as slides */}
        {React.Children.map(children, (child, index) => (
          <SwiperSlide key={index} className="p-2">
            {child}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Navigation buttons */}
      <div className="swiper-button-prev prev-style-one">
        <svg
          className="w-auto h-auto stroke-current"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15.25 6L9 12.25L15.25 18.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="swiper-button-next next-style-one">
        <svg
          className="stroke-current"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8.75 19L15 12.75L8.75 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}