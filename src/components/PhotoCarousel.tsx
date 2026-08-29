"use client";

import { useState } from "react";
import type { ItemPhoto } from "@/lib/types";

export function PhotoCarousel({ photos }: { photos: ItemPhoto[] }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-blush-50 text-5xl text-blush-200">
        ◇
      </div>
    );
  }
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
      >
        {photos.map((p) => (
          <div key={p.id} className="w-full flex-shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="aspect-square w-full object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
          {photos.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 w-1.5 rounded-full ${
                idx === i ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
