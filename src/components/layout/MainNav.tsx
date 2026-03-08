import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/inbox", label: "Inbox" },
  { to: "/cases", label: "Cases" },
  { to: "/timeline", label: "Timeline" },
  { to: "/exports", label: "Exports" },
];

export function MainNav() {
  return (
    <nav className="border-r border-zinc-800 bg-zinc-950/80 p-3">
      <div className="mb-3 px-2 text-xs uppercase tracking-widest text-zinc-500">Navigation</div>
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  "block rounded-md px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
