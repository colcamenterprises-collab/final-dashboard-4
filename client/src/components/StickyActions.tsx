import React from "react";

export default function StickyActions({
  onNext,
  onSaveDraft,
  nextLabel = "Next",
  disableNext = false,
}: {
  onNext: () => void;
  onSaveDraft: () => void;
  nextLabel?: string;
  disableNext?: boolean;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onSaveDraft}
          className="h-10 rounded-lg border border-gray-300 px-4 font-medium text-gray-700 hover:bg-gray-50"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disableNext}
          className="h-10 rounded-lg bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}