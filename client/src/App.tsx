import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import TransactionsEnhanced from "./pages/TransactionsEnhanced";
import CreditCards from "@/pages/CreditCards";
import Invoices from "@/pages/Invoices";
import InvoicesEnhanced from "@/pages/InvoicesEnhanced";
import Reports from "@/pages/Reports";
import Calendar from "@/pages/Calendar";
import Settings from "@/pages/Settings";
import Export from "@/pages/Export";
import Filters from "@/pages/Filters";
import CompetencyConfig from "@/pages/CompetencyConfig";
import RecurringAndInstallments from "@/pages/RecurringAndInstallments";
import AccountsManagement from "@/pages/AccountsManagement";
import CategoriesManagement from "@/pages/CategoriesManagement";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Remove trailing slash so wouter receives "" (root) or "/financeiro-domestico"
const routerBase = (import.meta.env.VITE_BASE_URL ?? "/").replace(/\/$/, "");

function AppRouter() {
  return (
    <Router base={routerBase}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path="/lancamentos" component={TransactionsEnhanced} />
        <Route path={"/cards"} component={CreditCards} />
        <Route path={"/invoices"} component={InvoicesEnhanced} />
        <Route path={"/calendar"} component={Calendar} />
        <Route path={"/reports"} component={Reports} />
        <Route path={"/export"} component={Export} />
        <Route path={"/filters"} component={Filters} />
        <Route path={"/competency-config"} component={CompetencyConfig} />
        <Route path={"/recurring-installments"} component={RecurringAndInstallments} />
        <Route path={"/accounts"} component={AccountsManagement} />
        <Route path={"/categories"} component={CategoriesManagement} />
        <Route path={"/workspaces"} component={WorkspacesPage} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
