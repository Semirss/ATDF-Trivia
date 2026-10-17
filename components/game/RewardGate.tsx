"use client";

import { RewardProfileModal } from "@/components/game/RewardProfileModal";
import { usePlayerStore } from "@/store/playerStore";

export function RewardGate({
  categoryId,
  onClose,
  onComplete
}: {
  categoryId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const clearActiveSessionsForCategory = usePlayerStore((state) => state.clearActiveSessionsForCategory);

  return (
    <RewardProfileModal
      onClose={onClose}
      onComplete={() => {
        clearActiveSessionsForCategory(categoryId);
        onComplete();
      }}
    />
  );
}
