import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/orgs", label: "Organizations" },
  { href: "/projects", label: "Projects" },
];

export function Nav() {
  return (
    <header className="border-b">
      <nav className="container mx-auto max-w-6xl flex items-center gap-6 p-4">
        <Link href="/" className="font-semibold">
          Funding Advisor
        </Link>
        <ul className="flex gap-4 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
