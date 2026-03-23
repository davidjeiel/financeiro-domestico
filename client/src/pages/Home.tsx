import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, CreditCard, BarChart3, Shield } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Financeiro</h1>
          </div>
          {isAuthenticated ? (
            <Button onClick={() => navigate("/dashboard")} variant="default">
              Ir para Dashboard
            </Button>
          ) : (
            <a href={getLoginUrl()}>
              <Button variant="default">Entrar</Button>
            </a>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Controle Financeiro <span className="text-primary">Elegante</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Gerencie suas finanças domésticas com sofisticação. Organize suas despesas por
            competências mensais, controle seus cartões de crédito com precisão e visualize
            seus gastos através de relatórios inteligentes.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Começar Agora
            </Button>
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card border-y border-border py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-foreground mb-16">
            Recursos Principais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<CreditCard className="w-8 h-8" />}
              title="Cartões de Crédito"
              description="Configure data de corte e fechamento para controlar suas faturas com precisão"
            />
            <FeatureCard
              icon={<TrendingUp className="w-8 h-8" />}
              title="Competências Mensais"
              description="Organize seus lançamentos por período contábil com flexibilidade total"
            />
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Relatórios Inteligentes"
              description="Visualize sua evolução financeira com gráficos e análises detalhadas"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Seguro e Privado"
              description="Autenticação Google segura e dados sincronizados com Google Drive"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-foreground mb-6">
            Pronto para organizar suas finanças?
          </h3>
          <p className="text-lg text-muted-foreground mb-8">
            Comece agora mesmo com sua conta Google e tenha acesso a todas as funcionalidades.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Entrar com Google
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2026 Controle Financeiro. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 rounded-xl border border-border bg-background hover:shadow-lg transition-shadow">
      <div className="text-primary mb-4">{icon}</div>
      <h4 className="text-lg font-semibold text-foreground mb-2">{title}</h4>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
