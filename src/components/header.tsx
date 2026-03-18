"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between py-5">
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo.png"
          alt="theKickBack"
          width={180}
          height={60}
          className="h-10 w-auto md:h-[60px]"
          priority
        />
      </Link>

      {/* Desktop Nav */}
      <nav className="hidden items-center gap-8 md:flex">
        <a href="https://dash.thekickback.net" className="font-sans text-sm text-black/65 transition-colors hover:text-black">
          Dashboard
        </a>
        <a href="#how" className="font-sans text-sm text-black/65 transition-colors hover:text-black">
          How it works
        </a>
        <a href="#protocol" className="font-sans text-sm text-black/65 transition-colors hover:text-black">
          Protocol
        </a>
        <a href="#venues" className="font-sans text-sm text-black/65 transition-colors hover:text-black">
          Venues
        </a>
        <a href="#membership" className="font-sans text-sm text-black/65 transition-colors hover:text-black">
          Memberships
        </a>
      </nav>

      {/* Mobile Menu Button */}
      <button
        className="flex h-10 w-10 items-center justify-center md:hidden"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          {menuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Nav */}
      {menuOpen && (
        <nav className="absolute left-0 right-0 top-[72px] z-50 flex flex-col gap-4 border-b border-black/5 bg-white px-6 py-6 md:hidden">
          <a href="https://dash.thekickback.net" onClick={() => setMenuOpen(false)} className="font-sans text-sm text-black/65">Dashboard</a>
          <a href="#how" onClick={() => setMenuOpen(false)} className="font-sans text-sm text-black/65">How it works</a>
          <a href="#protocol" onClick={() => setMenuOpen(false)} className="font-sans text-sm text-black/65">Protocol</a>
          <a href="#venues" onClick={() => setMenuOpen(false)} className="font-sans text-sm text-black/65">Venues</a>
          <a href="#membership" onClick={() => setMenuOpen(false)} className="font-sans text-sm text-black/65">Memberships</a>
        </nav>
      )}
    </header>
  );
}
