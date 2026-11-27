import React, { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

interface DashboardLayoutCustomProps {
  children: React.ReactNode;
  title?: string;
}

/** Abaixo deste tamanho (celulares e tablets em pé) o menu vira uma gaveta. */
const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(DESKTOP_QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

function LoginScreen({ onLogin, error }: { onLogin: () => void; error: { message: string } | null }) {
  return (
    <div className="app-backdrop min-h-dvh flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 text-center space-y-4 max-w-md w-full">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Controle Financeiro</h1>
        <p className="text-muted-foreground">
          Seus dados ficam em uma planilha no seu Google Drive.
        </p>
        <Button
          onClick={onLogin}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Entrar com Google
        </Button>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/lancamentos", icon: "💳", label: "Lançamentos" },
  { href: "/todas-areas", icon: "🗂️", label: "Todas as áreas" },
  // As faturas ficam na tela de cartões (selecionar o cartão).
  { href: "/cards", icon: "🏦", label: "Cartões" },
  { href: "/calendar", icon: "📅", label: "Calendário" },
  { href: "/reports", icon: "📈", label: "Relatórios" },
  { href: "/export", icon: "⬇️", label: "Exportar" },
  { href: "/competency-config", icon: "📋", label: "Competência" },
  { href: "/workspaces", icon: "👥", label: "Áreas e pessoas" },
];

export default function DashboardLayoutCustom({
  children,
  title = "Controle Financeiro",
}: DashboardLayoutCustomProps) {
  const { user, logout, login, error, isAuthenticated, loading } = useAuth();
  const isDesktop = useIsDesktop();
  // No desktop o menu fica fixo e pode ser recolhido; no celular/tablet abre por cima.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location, navigate] = useLocation();

  // Fecha a gaveta ao trocar de página ou ao passar para a largura de desktop.
  useEffect(() => setDrawerOpen(false), [location, isDesktop]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Enquanto a sessão e a planilha carregam, evita o flash da tela de login.
  if (loading) {
    return (
      <div className="app-backdrop min-h-dvh flex items-center justify-center p-4">
        <p className="text-muted-foreground">Carregando seus dados da planilha…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} error={error} />;
  }

  const expanded = !isDesktop || sidebarOpen;

  return (
    <div className="app-backdrop flex h-dvh overflow-hidden">
      {/* Fundo escurecido atrás da gaveta (celular/tablet) */}
      {!isDesktop && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Menu principal"
        className={`flex flex-col border-r border-white/[0.07] bg-[oklch(0.14_0.012_280/0.72)] backdrop-blur-2xl transition-[width,transform] duration-300 ${
          isDesktop
            ? `relative ${sidebarOpen ? "w-64" : "w-20"}`
            : `fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] shadow-2xl ${
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              }`
        }`}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 lg:px-5 lg:py-5 border-b border-white/[0.07]">
          {expanded && <h2 className="text-xl font-bold text-foreground pl-1">Financeiro</h2>}
          <button
            type="button"
            onClick={() => (isDesktop ? setSidebarOpen(!sidebarOpen) : setDrawerOpen(false))}
            className={`p-2 hover:bg-white/5 rounded-lg transition-colors ${expanded ? "" : "mx-auto"}`}
            aria-label={isDesktop ? (sidebarOpen ? "Recolher menu" : "Expandir menu") : "Fechar menu"}
          >
            {!isDesktop ? (
              <X className="w-5 h-5" />
            ) : sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeftOpen className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Área de trabalho ativa */}
        <div className="px-4 pt-4">
          <WorkspaceSwitcher compact={!expanded} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto overscroll-contain">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} {...item} open={expanded} />
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-3 lg:p-4 border-t border-white/[0.07] space-y-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {expanded && (
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            title="Configurações"
            className={`w-full flex items-center gap-2 p-2.5 hover:bg-white/5 rounded-lg transition-colors text-foreground ${expanded ? "" : "justify-center"}`}
          >
            <Settings className="w-5 h-5" />
            {expanded && <span className="text-sm">Configurações</span>}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            className={`w-full flex items-center gap-2 p-2.5 hover:bg-destructive/10 rounded-lg transition-colors text-destructive ${expanded ? "" : "justify-center"}`}
          >
            <LogOut className="w-5 h-5" />
            {expanded && <span className="text-sm">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[oklch(0.13_0.012_280/0.6)] backdrop-blur-2xl px-4 py-3 sm:px-6 lg:px-8 lg:py-5">
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Abrir menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="min-w-0 truncate text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
        </header>

        {/* Content */}
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </main>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  open: boolean;
}

function NavLink({ href, icon, label, open }: NavLinkProps) {
  const [location] = useLocation();
  const isActive = location === href || (href === "/dashboard" && location === "/");

  return (
    <Link
      href={href}
      title={open ? undefined : label}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${open ? "" : "justify-center"} ${
        isActive
          ? "bg-primary/90 text-primary-foreground shadow-[0_4px_18px_-6px_var(--primary)]"
          : "text-foreground hover:bg-white/5"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {open && <span className="text-sm font-medium">{label}</span>}
    </Link>
  );
}
