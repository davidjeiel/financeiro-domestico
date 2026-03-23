import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

interface DashboardLayoutCustomProps {
  children: React.ReactNode;
  title?: string;
}

export default function DashboardLayoutCustom({
  children,
  title = "Controle Financeiro",
}: DashboardLayoutCustomProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Controle Financeiro</h1>
          <p className="text-muted-foreground mb-8">Gerencie suas finanças com elegância</p>
          <a href={getLoginUrl()}>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Entrar com Google
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-card border-r border-border transition-all duration-300 flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h2 className="text-xl font-bold text-foreground">Financeiro</h2>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavLink href="/" icon="📊" label="Dashboard" open={sidebarOpen} />
          <NavLink href="/transactions" icon="💳" label="Lançamentos" open={sidebarOpen} />
          <NavLink href="/cards" icon="🏦" label="Cartões" open={sidebarOpen} />
          <NavLink href="/invoices" icon="📄" label="Faturas" open={sidebarOpen} />
          <NavLink href="/calendar" icon="📅" label="Calendário" open={sidebarOpen} />
          <NavLink href="/reports" icon="📈" label="Relatórios" open={sidebarOpen} />
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border space-y-2">
          {sidebarOpen && (
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg transition-colors text-foreground"
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm">Configurações</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-8 py-6 sticky top-0 z-10">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        </header>

        {/* Content */}
        <div className="p-8">{children}</div>
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
  const isActive = location === href;

  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {open && <span className="text-sm font-medium">{label}</span>}
    </a>
  );
}
