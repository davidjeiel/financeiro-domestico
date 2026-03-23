import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, Sheet } from "lucide-react";
import { exportToXLSX, exportToCSV, prepareExportData } from "@/lib/exportHelpers";
import { toast } from "sonner";

export default function Export() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );

  const [isExporting, setIsExporting] = useState(false);

  const handleExportXLSX = async () => {
    try {
      if (!transactions || !currentCompetency) return;
      
      setIsExporting(true);
      const data = prepareExportData(
        transactions.map(t => ({
          ...t,
          description: t.description || undefined,
          notes: t.notes || undefined,
        })),
        currentCompetency.name,
        currentCompetency.year,
        currentCompetency.month
      );
      
      exportToXLSX(data);
      toast.success("Arquivo XLSX exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar XLSX:", error);
      toast.error("Erro ao exportar arquivo XLSX");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      if (!transactions || !currentCompetency) return;
      
      setIsExporting(true);
      const data = prepareExportData(
        transactions.map(t => ({
          ...t,
          description: t.description || undefined,
          notes: t.notes || undefined,
        })),
        currentCompetency.name,
        currentCompetency.year,
        currentCompetency.month
      );
      
      exportToCSV(data);
      toast.success("Arquivo CSV exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar arquivo CSV");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Exportar Dados">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Competência: {currentCompetency?.name}
          </h2>
          <p className="text-muted-foreground mb-6">
            Exporte seus dados financeiros em diferentes formatos. Total de lançamentos: {transactions?.length || 0}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* XLSX Export */}
            <div className="p-6 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-all">
              <div className="flex items-center gap-3 mb-4">
                <Sheet className="w-8 h-8 text-green-500" />
                <div>
                  <h3 className="font-semibold text-foreground">Exportar como XLSX</h3>
                  <p className="text-sm text-muted-foreground">Excel com múltiplas abas</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Inclui: Transações, Resumo e Distribuição por Categoria
              </p>
              <Button
                onClick={handleExportXLSX}
                disabled={isExporting || !transactions || transactions.length === 0}
                className="w-full bg-green-600 text-white hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar XLSX
              </Button>
            </div>

            {/* CSV Export */}
            <div className="p-6 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-all">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-8 h-8 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-foreground">Exportar como CSV</h3>
                  <p className="text-sm text-muted-foreground">Arquivo de texto separado por vírgula</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Compatível com qualquer planilha ou software
              </p>
              <Button
                onClick={handleExportCSV}
                disabled={isExporting || !transactions || transactions.length === 0}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-primary/10 border border-primary/20">
          <h3 className="font-semibold text-foreground mb-2">Informações de Exportação</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ Todos os lançamentos da competência serão inclusos</li>
            <li>✓ Dados são exportados em tempo real</li>
            <li>✓ Nenhum dado é enviado para servidores externos</li>
            <li>✓ Arquivo é salvo diretamente no seu computador</li>
          </ul>
        </Card>

        {/* Preview Card */}
        {transactions && transactions.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Prévia dos Dados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-foreground">Data</th>
                    <th className="text-left py-2 px-2 font-medium text-foreground">Descrição</th>
                    <th className="text-left py-2 px-2 font-medium text-foreground">Categoria</th>
                    <th className="text-left py-2 px-2 font-medium text-foreground">Tipo</th>
                    <th className="text-right py-2 px-2 font-medium text-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 5).map((t) => (
                    <tr key={t.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-2 px-2 text-muted-foreground">
                        {new Date(t.transactionDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-2 text-foreground">{t.description || "-"}</td>
                      <td className="py-2 px-2 text-foreground">{t.category}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            t.type === "income"
                              ? "bg-green-500/10 text-green-500"
                              : t.type === "expense"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {t.type === "income"
                            ? "Receita"
                            : t.type === "expense"
                            ? "Despesa"
                            : "Cartão"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-foreground font-medium">
                        {typeof t.amount === "string"
                          ? `R$ ${parseFloat(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `R$ ${(t.amount as any).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 5 && (
                <p className="text-sm text-muted-foreground mt-4">
                  ... e mais {transactions.length - 5} lançamentos
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}
