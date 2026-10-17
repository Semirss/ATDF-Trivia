"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { toast } from "sonner";
import { AssetUploader } from "@/components/admin/AssetUploader";
import { ColorField } from "@/components/admin/ColorField";
import { categoryFormSchema } from "@/lib/validators";
import type { Category, CategoryFormValues } from "@/lib/types";

const defaults: CategoryFormValues = {
  title: "",
  iconUrl: "",
  difficulty: "easy",
  colorHex: "#56bdd7",
  isRewardBased: false,
  isActive: true,
  description: "",
  mapBackgroundUrl: "",
  levelPodiumUrl: ""
};

export function CategoryForm({
  category,
  submitLabel,
  onSubmit
}: {
  category?: Category;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void;
}) {
  const [values, setValues] = useState<CategoryFormValues>(
    category
      ? {
          title: category.title,
          iconUrl: category.iconUrl,
          difficulty: category.difficulty,
          colorHex: category.colorHex,
          isRewardBased: category.isRewardBased,
          isActive: category.isActive,
          description: category.description,
          mapBackgroundUrl: category.mapBackgroundUrl,
          levelPodiumUrl: category.levelPodiumUrl
        }
      : defaults
  );

  function setValue<Key extends keyof CategoryFormValues>(key: Key, value: CategoryFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = categoryFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the category fields");
      return;
    }

    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
          Title
            <input className="h-11 rounded-xl border border-black/15 px-3" value={values.title} onChange={(event) => setValue("title", event.target.value)} />
          </label>
          <ColorField label="Theme color" value={values.colorHex} onChange={(nextValue) => setValue("colorHex", nextValue)} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-bold">
              <input type="checkbox" checked={values.isRewardBased} onChange={(event) => setValue("isRewardBased", event.target.checked)} />
              Reward based
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-bold">
              <input type="checkbox" checked={values.isActive} onChange={(event) => setValue("isActive", event.target.checked)} />
              Active
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Description
            <textarea className="min-h-32 rounded-2xl border border-black/15 p-3" value={values.description} onChange={(event) => setValue("description", event.target.value)} />
          </label>
        </div>
        <div className="grid gap-4">
          <AssetUploader
            label="Category icon"
            value={values.iconUrl}
            folder="categories/icons"
            description="Upload a square icon from your computer or phone, or paste a hosted image URL."
            onChange={(nextValue) => setValue("iconUrl", nextValue)}
          />
          <AssetUploader
            label="Map background"
            value={values.mapBackgroundUrl}
            folder="categories/backgrounds"
            description="Best for tall, vertical level-map artwork."
            onChange={(nextValue) => setValue("mapBackgroundUrl", nextValue)}
          />
          <AssetUploader
            label="Level podium"
            value={values.levelPodiumUrl}
            folder="categories/podiums"
            description="Upload the node or podium artwork used on the level path."
            onChange={(nextValue) => setValue("levelPodiumUrl", nextValue)}
          />
          <div className="grid gap-4 rounded-2xl border border-black/10 bg-black/[0.03] p-4">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-black/45">Game card preview</div>
              <div className="rounded-[24px] p-4 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${values.colorHex}, ${values.colorHex}BB)` }}>
                <div className="flex items-center gap-3">
                  {values.iconUrl ? <img src={values.iconUrl} alt={values.title || "Category icon"} className="h-14 w-14 rounded-2xl bg-white/10 object-cover p-2" /> : null}
                  <div>
                    <div className="text-xl font-black">{values.title || "Category name"}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm font-bold text-white/80">{values.description || "Your category description preview appears here."}</p>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-black/45">Level map preview</div>
              <div
                className="relative h-80 overflow-hidden rounded-[28px] border border-white/70 shadow-engine"
                style={{
                  backgroundImage: values.mapBackgroundUrl
                    ? `linear-gradient(rgba(220,227,225,0.18), rgba(220,227,225,0.18)), url(${values.mapBackgroundUrl})`
                    : `radial-gradient(circle at 72% 16%, ${values.colorHex}66, transparent 14rem), radial-gradient(circle at 20% 72%, rgba(255,180,200,0.28), transparent 12rem), linear-gradient(180deg,#e7f1ef,#d8e3e0)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <div className="absolute inset-x-4 top-4 rounded-[20px] border border-white/60 bg-white/62 px-4 py-3 backdrop-blur-md">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45">Level map</div>
                  <div className="mt-1 flex items-center gap-3">
                    {values.iconUrl ? <img src={values.iconUrl} alt={values.title || "Category icon"} className="h-10 w-10 rounded-2xl bg-white/70 object-cover p-1.5" /> : null}
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black">{values.title || "Category name"}</div>
                      <div className="text-xs font-bold text-black/55">Difficulty is assigned on levels</div>
                    </div>
                  </div>
                </div>

                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 320" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M92 250 C118 205 178 205 206 164 C230 129 178 104 144 74" fill="none" stroke="rgba(87,67,70,0.24)" strokeWidth="12" strokeLinecap="round" />
                  <path d="M92 250 C118 205 178 205 206 164 C230 129 178 104 144 74" fill="none" stroke={values.colorHex} strokeWidth="5" strokeLinecap="round" />
                </svg>

                {[
                  { left: "28%", top: "72%", label: "L1", active: true },
                  { left: "62%", top: "48%", label: "L2", active: false },
                  { left: "42%", top: "22%", label: "L3", active: false }
                ].map((node) => (
                  <div key={node.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: node.left, top: node.top }}>
                    <div
                      className="relative grid h-[62px] w-[62px] place-items-center rounded-full border-[3px] shadow-engine"
                      style={{
                        borderColor: node.active ? values.colorHex : "rgba(0,0,0,0.14)",
                        background: node.active ? "linear-gradient(180deg,#ffffff,#eef0eb)" : "rgba(255,255,255,0.72)"
                      }}
                    >
                      <div className="absolute -bottom-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-black uppercase text-white">
                        {node.label}
                      </div>
                    </div>
                    <div
                      className="absolute left-1/2 top-[78%] h-8 w-24 -translate-x-1/2 rounded-[50%] border border-white/45"
                      style={{
                        backgroundImage: values.levelPodiumUrl
                          ? `url(${values.levelPodiumUrl})`
                          : "linear-gradient(180deg,#6d6f77,#252630 45%,#ec6d94 46%,#ec6d94 72%,#46395a 73%)",
                        backgroundSize: "cover",
                        backgroundPosition: "center"
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <button type="submit" className="mt-5 min-h-12 rounded-xl bg-black px-5 text-sm font-black uppercase text-white">
        {submitLabel}
      </button>
    </form>
  );
}
