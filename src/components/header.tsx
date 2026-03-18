export function Header() {
  return (
    <header className="flex items-center justify-between py-5">
      {/* Logo Group */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5">
          <div className="h-2.5 w-2.5 rounded-[5px] bg-orange" />
        </div>
        <div className="flex flex-col">
          <span className="font-sans text-lg font-semibold tracking-tight text-black">
            theKickBack
          </span>
          <span className="font-sans text-[10px] font-medium tracking-[2.4px] text-black/50">
            TEXT TO ENTER
          </span>
        </div>
      </div>

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
