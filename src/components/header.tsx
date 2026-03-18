import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between py-5">
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo.png"
          alt="theKickBack"
          width={180}
          height={60}
          priority
        />
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-8">
        <a
          href="#how"
          className="font-sans text-sm text-black/65 transition-colors hover:text-black"
        >
          How it works
        </a>
        <a
          href="#protocol"
          className="font-sans text-sm text-black/65 transition-colors hover:text-black"
        >
          Protocol
        </a>
        <a
          href="#venues"
          className="font-sans text-sm text-black/65 transition-colors hover:text-black"
        >
          Venues
        </a>
        <a
          href="#membership"
          className="font-sans text-sm text-black/65 transition-colors hover:text-black"
        >
          Memberships
        </a>
      </nav>
    </header>
  );
}
