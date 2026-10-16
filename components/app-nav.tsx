import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/interviews/new", label: "New interview" },
  { href: "/interviewers", label: "Interviewers" },
  { href: "/studio", label: "Avatar studio" },
  { href: "/coachv2", label: "Coach v2" },
  { href: "/rpq", label: "RPQ demo" },
];

export function AppNav({ active }: { active?: string }) {
  return (
    <header className="masthead">
      <div className="brand-lockup">
        <Link className="brand-wordmark" href="/">
          Capco
        </Link>
        <div className="brand-divider" aria-hidden />
        <div className="brand-copy">
          <p className="eyebrow">Hiring</p>
          <h1>LiveAvatar Interviews</h1>
        </div>
      </div>
      <nav className="app-nav" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={active === link.href ? "is-active" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
