"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BLOG_POSTS, type BlogPost } from "@/lib/blog-data";

/* ── Category colors ────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
    Connection: "#f97316",
    Access: "#a78bfa",
    Discovery: "#4ade80",
    Score: "#f97316",
    Operators: "#facc15",
    Community: "#4ade80",
    Trust: "#a78bfa",
};

/* ── Blog Index Page ────────────────────────────────────── */
export default function BlogPage() {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const categories = Array.from(new Set(BLOG_POSTS.map((p) => p.category)));
    const filtered = activeCategory
        ? BLOG_POSTS.filter((p) => p.category === activeCategory)
        : BLOG_POSTS;

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#000",
                color: "#fff",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            {/* ── Header ──────────────────────────── */}
            <header
                style={{
                    padding: "48px 24px 32px",
                    maxWidth: 900,
                    margin: "0 auto",
                    textAlign: "center",
                }}
            >
                <Link
                    href="/"
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 3,
                        color: "rgba(255,255,255,0.35)",
                        textDecoration: "none",
                        display: "block",
                        marginBottom: 24,
                    }}
                >
                    THEKICKBACK
                </Link>
                <h1
                    style={{
                        fontSize: "clamp(28px, 5vw, 44px)",
                        fontWeight: 800,
                        margin: "0 0 12px",
                        letterSpacing: -1,
                        lineHeight: 1.1,
                    }}
                >
                    The Score &amp; The City
                </h1>
                <p
                    style={{
                        fontSize: 16,
                        color: "rgba(255,255,255,0.45)",
                        margin: "0 0 8px",
                        maxWidth: 520,
                        marginLeft: "auto",
                        marginRight: "auto",
                        lineHeight: 1.5,
                    }}
                >
                    Real research. Real stories. What happens when every gathering place
                    gets a voice.
                </p>
                <p
                    style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.25)",
                        margin: "0 0 32px",
                    }}
                >
                    Sourced from{" "}
                    <a
                        href="https://uk.craftthefuture.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#f97316", textDecoration: "underline" }}
                    >
                        Craft The Future Research
                    </a>
                </p>

                {/* ── Category Pills ────────────────── */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        onClick={() => setActiveCategory(null)}
                        style={{
                            padding: "6px 16px",
                            borderRadius: 50,
                            border: "1px solid",
                            borderColor: !activeCategory
                                ? "#f97316"
                                : "rgba(255,255,255,0.1)",
                            background: !activeCategory
                                ? "rgba(249,115,22,0.15)"
                                : "transparent",
                            color: !activeCategory ? "#f97316" : "rgba(255,255,255,0.4)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() =>
                                setActiveCategory(activeCategory === cat ? null : cat)
                            }
                            style={{
                                padding: "6px 16px",
                                borderRadius: 50,
                                border: "1px solid",
                                borderColor:
                                    activeCategory === cat
                                        ? CAT_COLORS[cat] || "#f97316"
                                        : "rgba(255,255,255,0.1)",
                                background:
                                    activeCategory === cat
                                        ? `${CAT_COLORS[cat] || "#f97316"}22`
                                        : "transparent",
                                color:
                                    activeCategory === cat
                                        ? CAT_COLORS[cat] || "#f97316"
                                        : "rgba(255,255,255,0.4)",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.2s",
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            {/* ── Post Grid ───────────────────────── */}
            <section
                style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    padding: "0 24px 80px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 20,
                }}
            >
                <AnimatePresence mode="popLayout">
                    {filtered.map((post, i) => (
                        <PostCard key={post.slug} post={post} index={i} />
                    ))}
                </AnimatePresence>
            </section>

            {/* ── Footer ──────────────────────────── */}
            <footer
                style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    padding: "32px 24px",
                    textAlign: "center",
                }}
            >
                <p
                    style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.15)",
                        margin: "0 0 4px",
                    }}
                >
                    powered by theKickBack
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.1)", margin: 0 }}>
                    Research:{" "}
                    <a
                        href="https://uk.craftthefuture.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "rgba(255,255,255,0.2)", textDecoration: "underline" }}
                    >
                        uk.craftthefuture.xyz
                    </a>
                </p>
            </footer>
        </main>
    );
}

/* ── Post Card Component ────────────────────────────────── */

function PostCard({ post, index }: { post: BlogPost; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const [imageHovered, setImageHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const catColor = CAT_COLORS[post.category] || "#f97316";

    const handleCopyImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        const fullUrl = `${window.location.origin}${post.image}`;
        navigator.clipboard.writeText(fullUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                gridColumn: expanded ? "1 / -1" : undefined,
            }}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Image */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: expanded ? 260 : 180,
                    overflow: "hidden",
                    transition: "height 0.3s",
                }}
                onMouseEnter={() => setImageHovered(true)}
                onMouseLeave={() => setImageHovered(false)}
            >
                <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    style={{ objectFit: "cover", opacity: 0.85 }}
                />
                {/* Copy image URL button */}
                {imageHovered && (
                    <button
                        onClick={handleCopyImage}
                        style={{
                            position: "absolute",
                            top: 44,
                            left: 12,
                            zIndex: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fff",
                            background: "rgba(0,0,0,0.45)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 50,
                            padding: "4px 12px",
                            cursor: "pointer",
                            transition: "background 0.2s",
                        }}
                    >
                        {copied ? "Copied!" : "Copy"}
                    </button>
                )}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)",
                    }}
                />
                {/* Category Badge */}
                <span
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        color: catColor,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(8px)",
                        padding: "4px 10px",
                        borderRadius: 50,
                        textTransform: "uppercase",
                    }}
                >
                    {post.category}
                </span>
                {/* Read Time */}
                <span
                    style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        fontSize: 10,
                        color: "rgba(255,255,255,0.4)",
                        background: "rgba(0,0,0,0.5)",
                        padding: "4px 8px",
                        borderRadius: 50,
                    }}
                >
                    {post.readTime}
                </span>
            </div>

            {/* Content */}
            <div style={{ padding: "16px 20px 20px" }}>
                <h2
                    style={{
                        fontSize: expanded ? 22 : 17,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        lineHeight: 1.25,
                        transition: "font-size 0.3s",
                        color: "#fff",
                    }}
                >
                    {post.title}
                </h2>
                <p
                    style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.4)",
                        margin: "0 0 12px",
                        lineHeight: 1.4,
                    }}
                >
                    {post.subtitle}
                </p>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35 }}
                            style={{ overflow: "hidden" }}
                        >
                            <div
                                style={{
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                    paddingTop: 16,
                                    marginTop: 4,
                                }}
                            >
                                {post.body.map((para, pi) => (
                                    <p
                                        key={pi}
                                        style={{
                                            fontSize: 15,
                                            lineHeight: 1.7,
                                            color: "rgba(255,255,255,0.7)",
                                            margin: "0 0 14px",
                                        }}
                                    >
                                        {para}
                                    </p>
                                ))}
                                <div
                                    style={{
                                        borderTop: "1px solid rgba(255,255,255,0.06)",
                                        paddingTop: 12,
                                        marginTop: 8,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "rgba(255,255,255,0.2)",
                                        }}
                                    >
                                        Craft The Future Research •{" "}
                                        <a
                                            href="https://uk.craftthefuture.xyz"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: "rgba(255,255,255,0.3)",
                                                textDecoration: "underline",
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            uk.craftthefuture.xyz
                                        </a>
                                    </span>
                                    <a
                                        href="https://join.thekickback.net/map"
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "#f97316",
                                            textDecoration: "none",
                                            padding: "6px 16px",
                                            border: "1px solid rgba(249,115,22,0.3)",
                                            borderRadius: 50,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Open the map →
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!expanded && (
                    <span
                        style={{
                            fontSize: 12,
                            color: "#f97316",
                            fontWeight: 600,
                        }}
                    >
                        Read more →
                    </span>
                )}
            </div>
        </motion.article>
    );
}
