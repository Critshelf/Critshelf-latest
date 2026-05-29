import React from "react";
import { Link } from "react-router-dom";

const logo = "/logo.png?v=3";

const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center justify-center py-8">
      <Link
        to="/"
        className="flex flex-col items-center gap-3 group transition-transform hover:scale-105 duration-300"
      >
        <div className="relative w-24 h-24 flex items-center justify-center bg-white rounded-3xl shadow-inner overflow-hidden border border-white/10">
          <img
            src={logo}
            alt="CritShelf Logo"
            loading="eager"
            style={{ mixBlendMode: "multiply" as any }}
            className="w-full h-full object-contain contrast-[1.1]"
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-accent to-gold-accent drop-shadow-sm">
          CritShelf
        </h1>
      </Link>
      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2">
        Your Tabletop Legacy
      </p>
    </header>
  );
};

export default Header;
