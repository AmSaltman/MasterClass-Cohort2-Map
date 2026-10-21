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

// Expected cohort size: the members meter is full at this many people.
export const COHORT_SIZE = 1000;

// "SUBJECTS ▢▢▢▢▢"-style meter. Five boxes, each worth max/5; boxes fill
// proportionally (e.g. 800 of 1000 members = 4 full boxes, 500 = 2½).
function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const per = max / 5;
  return (
    <div className="meter" title={`${value} ${label.toLowerCase()}`}>
      <span>{label}</span>
      <span className="boxes">
        {[0, 1, 2, 3, 4].map((i) => {
          // At least a sliver as soon as there's one, so a new cohort isn't empty.
          const fill = Math.min(1, Math.max(0, (value - i * per) / per));
          const shown = value > 0 && i === 0 ? Math.max(fill, 0.15) : fill;
          return <span key={i}><i style={{ width: `${shown * 100}%` }} /></span>;
        })}
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
          <Meter label="Members" value={members} max={COHORT_SIZE} />
          <Meter label="Countries" value={countries || 0} max={50} />
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
