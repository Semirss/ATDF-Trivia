"use client";

import { memo } from "react";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OptionKey } from "@/lib/types";

interface AnswerOptionProps {
  optionKey: OptionKey;
  text: string;
  disabled: boolean;
  selected: boolean;
  correct: boolean;
  reveal: boolean;
  onSelect: (key: OptionKey, element: HTMLButtonElement) => void;
}

function AnswerOptionComponent({ optionKey, text, disabled, selected, correct, reveal, onSelect }: AnswerOptionProps) {
  const stateClass = reveal
    ? correct
      ? "answer-option-correct"
      : selected
        ? "answer-option-wrong"
        : "answer-option-neutral"
    : "answer-option-idle";

  return (
    <motion.button
      type="button"
      data-analytics-id="answer-option"
      data-analytics-label={`Answer ${optionKey.toUpperCase()}`}
      disabled={disabled}
      onClick={(event) => onSelect(optionKey, event.currentTarget)}
      animate={
        reveal && selected && !correct
          ? { x: [0, -5, 5, -3, 0], scale: 1 }
          : reveal && correct
            ? { x: 0, scale: [1, 1.025, 1] }
            : { x: 0, scale: 1 }
      }
      transition={{ duration: reveal ? 0.32 : 0.18, ease: "easeOut" }}
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.965 } : undefined}
      className={cn(
        "answer-option relative flex w-full items-center overflow-hidden border text-left transition",
        stateClass
      )}
    >
      <span className="answer-option-badge relative z-10 grid shrink-0 place-items-center text-xs font-black uppercase">
        {optionKey}
      </span>
      <span className="answer-option-text relative z-10 min-w-0 flex-1 font-black leading-tight">{text}</span>
      {reveal && correct ? <Check className="relative z-10 h-5 w-5 shrink-0 text-emerald-700" /> : null}
      {reveal && selected && !correct ? <X className="relative z-10 h-5 w-5 shrink-0 text-red-600" /> : null}
    </motion.button>
  );
}

export const AnswerOption = memo(AnswerOptionComponent);
