"use client";
import Link from "next/link";
import { I } from "./Icons";
import { initials } from "@/lib/squares";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="MasterClass Executive Map — home">
      <span className="mc">MasterClass</span>
      <span className="ex">Executive</span>
      <span className="mp">Map</span>
    </Link>
  );
}

// "SUBJECTS ▢▢▢▢▢"-style meter: five boxes fill up as the number grows.
function Meter({ label, value, steps }: { label: string; value: number; steps: number[] }) {
  const on = steps.filter((s) => value >= s).length;
  return (
    <div className="meter" title={`${value} ${label.toLowerCase()}`}>
      <span>{label}</span>
      <span className="boxes">
        {steps.map((s, i) => <span key={s} className={i < on ? "on" : ""} />)}
      </span>
      <b>{value}</b>
    </div>
  );
}

type Props = {
  name?: string;
  photo?: string | null;
  members?: number;
  countries?: number;
  onDirectory?: () => void;
  onGlobe?: () => void;
  onSignOut?: () => void;
};

export function TopBar({ name, photo, members, countries, onDirectory, onGlobe, onSignOut }: Props) {
  return (
    <header className="topbar">
      <Logo href="/map" />
      {members !== undefined && (
        <div className="meters">
          <Meter label="Members" value={members} steps={[1, 50, 200, 500, 900]} />
          <Meter label="Countries" value={countries || 0} steps={[1, 5, 15, 30, 50]} />
        </div>
      )}
      <nav className="top-actions">
        {onGlobe && <button className="icon-btn optional" onClick={onGlobe} aria-label="Globe view" title="Globe"><I.globe /></button>}
        {onDirectory && <button className="icon-btn" onClick={onDirectory} aria-label="Open directory" title="Directory"><I.book /></button>}
        <Link className="icon-btn optional" href="/profile" aria-label="Edit my profile" title="My profile"><I.user /></Link>
        {onSignOut && <button className="icon-btn optional" onClick={onSignOut} aria-label="Sign out" title="Sign out"><I.logout /></button>}
        {name && (
          <Link className={`avatar ${photo ? "has-photo" : ""}`} href="/profile" title="My profile">
            {photo ? <img className="photo" src={photo} alt="" /> : initials(name) || "ME"}
          </Link>
        )}
      </nav>
    </header>
  );
}
