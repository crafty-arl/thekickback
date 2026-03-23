"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────

interface OfferingDetailDrawerProps {
  offering: {
    id: string;
    name: string;
    type: string;
    price_cents: number;
    description?: string;
  };
  drawerSaving: boolean;
  onSave: (form: { name: string; description: string; price_cents: number; type: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function OfferingDetailDrawer({
  offering,
  drawerSaving,
  onSave,
  onDelete,
  onClose,
}: OfferingDetailDrawerProps) {
  const [offeringForm, setOfferingForm] = useState({
    name: offering.name,
    description: offering.description || "",
    price_cents: offering.price_cents,
    type: offering.type,
  });

  return (
    <>
      <motion.div
        key="offering-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30"
      />
      <motion.div
        key="offering-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <p className="font-sans text-[16px] font-bold text-gray-900">Edit Offering</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-orange-50 px-3 py-1 font-sans text-[11px] font-semibold capitalize text-orange-600">
              {offeringForm.type}
            </span>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-wider text-gray-400">Name</label>
            <input
              value={offeringForm.name}
              onChange={(e) => setOfferingForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-wider text-gray-400">Description</label>
            <textarea
              value={offeringForm.description}
              onChange={(e) => setOfferingForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-wider text-gray-400">Price</label>
            <div className="flex items-center gap-2">
              <span className="font-sans text-[16px] font-bold text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                value={(offeringForm.price_cents / 100).toFixed(2)}
                onChange={(e) => setOfferingForm((f) => ({ ...f, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4 space-y-2" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => onSave(offeringForm)}
            disabled={drawerSaving || !offeringForm.name.trim()}
            className="flex w-full items-center justify-center rounded-xl py-3 font-sans text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {drawerSaving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onDelete}
            disabled={drawerSaving}
            className="flex w-full items-center justify-center rounded-xl border border-red-200 py-3 font-sans text-[13px] font-medium text-red-500 transition active:scale-[0.98] disabled:opacity-50"
          >
            {drawerSaving ? "Deleting..." : "Delete Offering"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
