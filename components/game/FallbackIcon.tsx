"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Bot, FlaskConical, Landmark, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function FallbackIcon({
  id,
  src,
  alt,
  className
}: {
  id: string;
  src?: string;
  alt?: string;
  className?: string;
}) {
  const Icon = id.includes("science") ? FlaskConical : id.includes("history") ? Landmark : id.includes("prize") ? Trophy : Bot;
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className={cn("overflow-hidden rounded-[26px] bg-white/82 shadow-bevel", className)}>
        <img
          src={src}
          alt={alt ?? "Icon"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("grid place-items-center rounded-[26px] bg-white/80 shadow-bevel", className)}>
      <Icon className="h-9 w-9 text-graphite" />
    </div>
  );
}
