"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface GalleryImage {
    id: string;
    image_url: string;
    caption: string | null;
    sort_order: number;
}

interface Props {
    gallery: GalleryImage[];
    themeColor?: string;
}

export function VenueGallery({ gallery, themeColor = "#F97316" }: Props) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    if (!gallery || gallery.length === 0) return null;

    return (
        <>
            {/* Section header */}
            <div>
                <p
                    className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px]"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                >
                    GALLERY
                </p>

                {/* Horizontal scrolling strip */}
                <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto pb-2"
                    style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
                >
                    {gallery.map((img, i) => (
                        <motion.button
                            key={img.id}
                            onClick={() => setLightboxIndex(i)}
                            whileTap={{ scale: 0.95 }}
                            className="relative shrink-0 overflow-hidden rounded-xl"
                            style={{
                                width: 140,
                                height: 100,
                                border: "1px solid rgba(255,255,255,0.08)",
                            }}
                        >
                            <Image
                                src={img.image_url}
                                alt={img.caption || "Venue photo"}
                                fill
                                className="object-cover"
                                sizes="140px"
                            />
                            {/* Subtle gradient overlay */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background:
                                        "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)",
                                }}
                            />
                            {img.caption && (
                                <span className="absolute bottom-1.5 left-2 right-2 truncate font-sans text-[9px] text-white/60">
                                    {img.caption}
                                </span>
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Fullscreen Lightbox */}
            <AnimatePresence>
                {lightboxIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
                        style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
                        onClick={() => setLightboxIndex(null)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setLightboxIndex(null)}
                            className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            >
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Image counter */}
                        <div
                            className="absolute top-[max(16px,env(safe-area-inset-top))] left-4 rounded-full px-3 py-1 font-sans text-[11px] font-medium text-white/50"
                            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        >
                            {lightboxIndex + 1} / {gallery.length}
                        </div>

                        {/* Main image */}
                        <motion.div
                            key={lightboxIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative mx-4 max-h-[70vh] max-w-[90vw] overflow-hidden rounded-2xl"
                            style={{ aspectRatio: "auto" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={gallery[lightboxIndex].image_url}
                                alt={gallery[lightboxIndex].caption || "Venue photo"}
                                width={800}
                                height={600}
                                className="h-auto max-h-[70vh] w-auto rounded-2xl object-contain"
                                sizes="90vw"
                                priority
                            />
                        </motion.div>

                        {/* Caption */}
                        {gallery[lightboxIndex].caption && (
                            <p className="mt-4 px-8 text-center font-sans text-[13px] text-white/50">
                                {gallery[lightboxIndex].caption}
                            </p>
                        )}

                        {/* Navigation arrows */}
                        <div
                            className="absolute inset-y-0 left-0 flex w-16 items-center justify-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(
                                    lightboxIndex > 0
                                        ? lightboxIndex - 1
                                        : gallery.length - 1
                                );
                            }}
                        >
                            {gallery.length > 1 && (
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        className="opacity-50"
                                    >
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        <div
                            className="absolute inset-y-0 right-0 flex w-16 items-center justify-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(
                                    lightboxIndex < gallery.length - 1
                                        ? lightboxIndex + 1
                                        : 0
                                );
                            }}
                        >
                            {gallery.length > 1 && (
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        className="opacity-50"
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Dot indicators */}
                        {gallery.length > 1 && (
                            <div className="mt-4 flex gap-1.5">
                                {gallery.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxIndex(i);
                                        }}
                                        className="h-1.5 rounded-full transition-all"
                                        style={{
                                            width: i === lightboxIndex ? 16 : 6,
                                            backgroundColor:
                                                i === lightboxIndex
                                                    ? themeColor
                                                    : "rgba(255,255,255,0.2)",
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hide scrollbar */}
            <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
        </>
    );
}
