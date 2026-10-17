"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { uploadAdminAsset } from "@/lib/admin-client";

interface AssetUploaderProps {
  label: string;
  value: string;
  folder: string;
  onChange: (value: string) => void;
  description?: string;
  compact?: boolean;
}

export function AssetUploader({ label, value, folder, onChange, description, compact = false }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    setIsUploading(true);
    setError("");

    try {
      const uploaded = await uploadAdminAsset(file, folder);
      onChange(uploaded.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  }

  return (
    <div className="grid gap-2 text-sm font-bold">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-[11px] font-black uppercase text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void uploadFile(file);
            } else {
              setIsDragging(false);
            }
          }}
          className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center transition ${
            compact ? "min-h-24 py-3" : "min-h-40"
          } ${
            isDragging ? "border-black bg-black/[0.05]" : "border-black/15 bg-black/[0.02]"
          }`}
        >
          {isUploading ? <LoaderCircle className="mb-3 h-6 w-6 animate-spin" /> : <ImagePlus className="mb-3 h-6 w-6" />}
          <div className="text-sm font-black">{isUploading ? "Uploading..." : "Drag and drop an image here"}</div>
          <div className="mt-1 text-xs font-bold text-black/55">
            {description ?? "Upload from this device or click to browse your files."}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-black uppercase">
            <Upload className="h-3.5 w-3.5" />
            Choose image
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadFile(file);
            }
          }}
        />
        <div className="mt-3 grid gap-2">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://..."
            className="h-11 rounded-xl border border-black/10 bg-black/[0.02] px-3 text-sm font-bold"
          />
          {value ? (
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
              <img src={value} alt={label} className={compact ? "h-24 w-full object-cover" : "h-44 w-full object-cover"} />
            </div>
          ) : null}
          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
