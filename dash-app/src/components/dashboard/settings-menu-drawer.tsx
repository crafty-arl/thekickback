"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { addMenuItem, toggleMenuItemStock, deleteMenuItem } from "@/app/settings/actions";

// ─── Types ───────────────────────────────────────────────────────

interface MenuItem {
    id: string;
    category: string;
    name: string;
    description: string | null;
    price_cents: number;
    in_stock: boolean;
    inventory_count: number | null;
}

interface SettingsMenuDrawerProps {
    venueId: string;
    initialMenuItems: MenuItem[];
    onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────

export function SettingsMenuDrawer({
    venueId,
    initialMenuItems,
    onClose,
}: SettingsMenuDrawerProps) {
    const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    // Add form state
    const [category, setCategory] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [inventoryCount, setInventoryCount] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Group items by category
    const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
        const cat = item.category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});
    const categories = Object.keys(grouped).sort();

    function toggleCategory(cat: string) {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }

    async function handleAdd() {
        if (!name.trim()) return;
        setSaving(true);
        setMsg("");
        const result = await addMenuItem({
            category: category.trim() || "General",
            name: name.trim(),
            description: description.trim() || undefined,
            price_cents: Math.round(parseFloat(price || "0") * 100),
            inventory_count: inventoryCount ? parseInt(inventoryCount) : undefined,
        });
        if (result.error) {
            setMsg(result.error);
        } else {
            // Optimistic: add a placeholder item — page reload will get real id
            const newItem: MenuItem = {
                id: `temp-${Date.now()}`,
                category: category.trim() || "General",
                name: name.trim(),
                description: description.trim() || null,
                price_cents: Math.round(parseFloat(price || "0") * 100),
                in_stock: true,
                inventory_count: inventoryCount ? parseInt(inventoryCount) : null,
            };
            setItems((prev) => [...prev, newItem]);
            setMsg("Added!");
            setName("");
            setDescription("");
            setPrice("");
            setInventoryCount("");
            setTimeout(() => setMsg(""), 2000);
        }
        setSaving(false);
    }

    async function handleToggleStock(id: string, currentStock: boolean) {
        setTogglingId(id);
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, in_stock: !currentStock } : i)));
        await toggleMenuItemStock(id, !currentStock);
        setTogglingId(null);
    }

    async function handleDelete(id: string) {
        setDeletingId(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        await deleteMenuItem(id);
        setDeletingId(null);
    }

    return (
        <>
            <motion.div
                key="menu-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/30"
            />
            <motion.div
                key="menu-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="font-sans text-[16px] font-bold text-gray-900">Menu Items</p>
                        <p className="font-sans text-[12px] text-gray-400">Food, drinks, merch — anything you sell</p>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-5">
                    {/* Add item form */}
                    <div className="rounded-xl border border-black/[0.06] bg-gray-50 p-4 space-y-3">
                        <p className="font-sans text-[13px] font-semibold text-gray-700">Add item</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Category (e.g. Drinks)"
                                className="col-span-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                            />
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Item name *"
                                className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                            />
                            <input
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="Price ($)"
                                type="number"
                                step="0.01"
                                min="0"
                                className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                            />
                        </div>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (optional)"
                            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        />
                        <div className="flex items-center gap-2">
                            <input
                                value={inventoryCount}
                                onChange={(e) => setInventoryCount(e.target.value)}
                                placeholder="Inventory count (optional)"
                                type="number"
                                min="0"
                                className="flex-1 rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-300"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={saving || !name.trim()}
                                className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 font-sans text-[13px] font-bold text-white transition active:scale-95 disabled:opacity-50"
                            >
                                {saving ? "..." : "Add"}
                            </button>
                        </div>
                        {msg && (
                            <p className="font-sans text-[12px]" style={{ color: msg.includes("Added") ? "#16A34A" : "#EF4444" }}>{msg}</p>
                        )}
                    </div>

                    {/* Empty state */}
                    {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
                            <p className="font-sans text-[14px] font-medium text-gray-400">No menu items yet</p>
                            <p className="font-sans text-[12px] text-gray-300 mt-1">Add your first item above — food, drinks, merch, anything</p>
                        </div>
                    )}

                    {/* Grouped items */}
                    {categories.map((cat) => {
                        const catItems = grouped[cat];
                        const collapsed = collapsedCategories.has(cat);
                        return (
                            <div key={cat}>
                                <button
                                    onClick={() => toggleCategory(cat)}
                                    className="flex w-full items-center justify-between py-2"
                                >
                                    <span className="font-sans text-[13px] font-semibold text-gray-600">{cat} ({catItems.length})</span>
                                    <svg
                                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                        className={`text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                {!collapsed && (
                                    <div className="space-y-2">
                                        {catItems.map((item) => (
                                            <div key={item.id} className="rounded-xl border border-black/[0.06] bg-white px-4 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-sans text-[13px] font-medium text-gray-800 truncate">{item.name}</p>
                                                            <span className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold ${item.in_stock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                                                                {item.in_stock ? "In stock" : "Out"}
                                                            </span>
                                                            {item.inventory_count !== null && (
                                                                <span className="shrink-0 font-sans text-[10px] text-gray-400">
                                                                    qty: {item.inventory_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className="font-sans text-[11px] text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                                                        )}
                                                        <p className="font-sans text-[12px] font-semibold text-gray-600 mt-1">
                                                            ${(item.price_cents / 100).toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => handleToggleStock(item.id, item.in_stock)}
                                                            disabled={togglingId === item.id}
                                                            className={`rounded-lg border px-2.5 py-1.5 font-sans text-[11px] font-medium transition active:scale-95 disabled:opacity-50 ${
                                                                item.in_stock
                                                                    ? "border-red-200 text-red-500 hover:bg-red-50"
                                                                    : "border-green-200 text-green-600 hover:bg-green-50"
                                                            }`}
                                                        >
                                                            {item.in_stock ? "Mark out" : "Restock"}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            disabled={deletingId === item.id}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 transition disabled:opacity-50"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </>
    );
}
