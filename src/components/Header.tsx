import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, LogOut, Shield, UserRound, Menu, Home, Library, ChevronDown, X, Settings, CalendarDays, Users, Bell, History, Bookmark, AtSign, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuickSearch } from "./QuickSearch";
import { AccountAvatar } from "./AccountAvatar";

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"><span className="h-3 w-0.5 bg-primary" />{children}<span className="flex-1 border-t border-dashed border-border" /></div>;
}

function MenuLink({ to, icon: Icon, active, onClick, children }: { to: "/" | "/browse" | "/admin" | "/my-list" | "/settings"; icon: LucideIcon; active: boolean; onClick: () => void; children: ReactNode }) {
  return <Button asChild variant="ghost" className={`h-11 w-full justify-start gap-3 ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><Link to={to} onClick={onClick} aria-current={active ? "page" : undefined}><span className="flex h-6 w-6 items-center justify-center border border-border bg-muted/40"><Icon className="h-4 w-4" /></span>{children}</Link></Button>;
}

export function Header() {
  const { user, username, isAdmin, openAuth } = useAuth();
  const { halloween } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const home = pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-3 bg-background px-4 py-3 sm:px-6">
      {halloween && <div className="halloween-web pointer-events-none absolute left-0 top-0 h-24 w-24" />}
      <div className="relative shrink-0">
        <Button variant="ghost" size="icon" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="text-muted-foreground hover:text-foreground">
          {menuOpen ? <X /> : <Menu />}
        </Button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <nav aria-label="Main navigation" className="panel-pattern absolute left-0 top-12 z-50 w-56 overflow-hidden rounded-sm border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-md">
              <MenuLabel>Browse</MenuLabel>
              <MenuLink to="/" icon={Home} active={home} onClick={() => setMenuOpen(false)}>Home</MenuLink>
              <MenuLink to="/browse" icon={Search} active={pathname === "/browse"} onClick={() => setMenuOpen(false)}>Search</MenuLink>
              <MenuLink to="/browse" icon={Library} active={pathname === "/browse"} onClick={() => setMenuOpen(false)}>All series</MenuLink>
              <div className="my-1 border-t border-border/40" />
              <Link to="/schedule" onClick={() => setMenuOpen(false)} className={`flex h-11 items-center gap-3 rounded px-3 text-sm hover:bg-primary/10 hover:text-primary ${pathname === "/schedule" ? "text-primary" : "text-muted-foreground"}`}><CalendarDays className="h-4 w-4" />Weekly Schedule</Link>
              <Link to="/news" onClick={() => setMenuOpen(false)} className={`flex h-11 items-center gap-3 rounded px-3 text-sm hover:bg-primary/10 hover:text-primary ${pathname === "/news" ? "text-primary" : "text-muted-foreground"}`}><Bell className="h-4 w-4" />News & Updates</Link>
              <Link to="/watch-together" onClick={() => setMenuOpen(false)} className={`flex h-11 items-center gap-3 rounded px-3 text-sm hover:bg-primary/10 hover:text-primary ${pathname.startsWith("/watch-together") ? "text-primary" : "text-muted-foreground"}`}><Users className="h-4 w-4" />Watch Together</Link>
              <MenuLink to="/my-list" icon={Library} active={pathname === "/my-list"} onClick={() => setMenuOpen(false)}>My list</MenuLink>
              <MenuLink to="/settings" icon={Settings} active={pathname === "/settings"} onClick={() => setMenuOpen(false)}>Settings</MenuLink>
              {isAdmin && (
                <>
                  <MenuLabel>Admin</MenuLabel>
                  <MenuLink to="/admin" icon={Shield} active={pathname === "/admin"} onClick={() => setMenuOpen(false)}>Dashboard</MenuLink>
                </>
              )}
            </nav>
          </>
        )}
      </div>
      <Logo />
      <Button variant="outline" aria-label="Search series" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => { setMenuOpen(false); setSearchOpen(true); }} className="order-3 h-10 w-full justify-start bg-overlay/60 px-3 text-sm text-muted-foreground backdrop-blur md:order-none md:w-64 md:flex-none lg:w-72"><Search />Search series...</Button>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-11 gap-2 px-1.5 text-sm hover:text-foreground" aria-label="Account menu">
                <AccountAvatar />
                <span className="hidden max-w-28 truncate font-semibold sm:inline">{username}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="max-h-[min(85vh,700px)] w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
              <DropdownMenuLabel className="mb-2 flex items-center gap-3 rounded-lg bg-primary/10 p-3"><AccountAvatar size="lg" /><span className="min-w-0"><strong className="block truncate text-base text-foreground">{username}</strong><span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>{user.created_at && <span className="mt-1 flex items-center gap-1 text-xs font-normal text-primary"><CalendarDays className="h-3 w-3" />Joined {new Date(user.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>}</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem asChild><Link to="/admin"><Shield /> Admin dashboard</Link></DropdownMenuItem>
              )}
              <DropdownMenuItem asChild><Link to="/profile"><UserRound /> Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/public-profile"><AtSign /> Public Profile</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/watchlist"><Bookmark /> Watchlist</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/my-list"><Library /> My List</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/friends"><Users /> Friends</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/continue-watching"><History /> Continue Watching</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/notifications"><Bell /> Notifications</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/settings"><Settings /> Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await qc.cancelQueries();
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="text-destructive" /> <span className="text-destructive">Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={() => openAuth("signin")}
            className="clip-slant rounded-none px-6 text-xs font-extrabold uppercase tracking-wider"
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
