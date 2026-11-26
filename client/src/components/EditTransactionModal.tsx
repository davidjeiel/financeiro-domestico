'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { TransferTransactionsDialog } from '@/components/workspace/TransferTransactionsDialog';
import TransactionLinksManager from '@/components/TransactionLinksManager';
import { ResponsibleSelect } from '@/components/workspace/ResponsibleSelect';
import { useActiveWorkspaceId } from '@/components/workspace/useWorkspaces';
import {
  IncomeCommitments,
  IncomeLinksEditor,
  type IncomeLink,
} from '@/components/allocation/IncomeLinksEditor';

/** Rótulo de campo: menor, em caixa alta e na cor secundária (distinto do campo). */
const FIELD_LABEL = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'diária',
  weekly: 'semanal',
  biweekly: 'quinzenal',
  monthly: 'mensal',
  quarterly: 'trimestral',
  annual: 'anual',
};

interface EditTransactionModalProps {
  isOpen: boolean;
  transactionId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({
  isOpen,
  transactionId,
  onClose,
  onSuccess,
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    transactionDate: '',
    dueDate: '',
    notes: '',
    category: '__placeholder__',
    responsibleUserId: null as number | null,
    fixed: false,
    amountConfirmed: true,
    applyToNext: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  const { data: transaction, isLoading: isFetching } = trpc.transaction.get.useQuery(
    { id: transactionId || 0 },
    { enabled: isOpen && transactionId !== null }
  );

  const { data: typologies = [], isLoading: isLoadingTypologies, refetch: refetchTypologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const setRecurrenceMutation = trpc.transaction.setRecurrence.useMutation();
  const applyFromMutation = trpc.recurrence.applyFrom.useMutation();
  const endRecurrenceMutation = trpc.recurrence.end.useMutation();
  // Regra de recorrência deste lançamento (se ele for uma ocorrência).
  const { data: recurrenceInfo } = trpc.recurrence.ofTransaction.useQuery(
    { transactionId: transactionId || 0 },
    { enabled: isOpen && transactionId !== null }
  );

  const handleEndRecurrence = async () => {
    if (!recurrenceInfo || !transaction) return;
    const when = new Date(transaction.transactionDate).toLocaleDateString('pt-BR');
    if (!window.confirm(`Encerrar a recorrência depois de ${when}? Os lançamentos futuros ainda não pagos serão removidos.`)) return;
    try {
      const d = new Date(transaction.transactionDate);
      const lastDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const { removed } = await endRecurrenceMutation.mutateAsync({ groupKey: recurrenceInfo.groupKey, lastDate });
      await Promise.all([utils.transaction.invalidate(), utils.invoice.invalidate(), utils.recurrence.invalidate()]);
      toast.success(removed ? `Recorrência encerrada; ${removed} lançamento(s) futuro(s) removido(s).` : 'Recorrência encerrada.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar');
    }
  };
  const setAllocationsMutation = trpc.allocation.set.useMutation();
  const workspaceId = useActiveWorkspaceId();
  const { data: allocation } = trpc.allocation.forTransaction.useQuery(
    { transactionId: transactionId || 0, workspaceId: workspaceId ?? '' },
    { enabled: isOpen && transactionId !== null && !!workspaceId }
  );
  // Receitas que pagam esta despesa (editadas aqui, gravadas ao salvar).
  const [incomeLinks, setIncomeLinks] = useState<IncomeLink[]>([]);
  const [incomeLinksDirty, setIncomeLinksDirty] = useState(false);

  useEffect(() => {
    if (allocation?.role === 'expense' && !incomeLinksDirty) {
      setIncomeLinks(
        allocation.links
          .filter((l) => l.counterpart)
          .map((l) => ({ incomeId: l.counterpart!.id, amount: Number(l.amount).toFixed(2) }))
      );
    }
  }, [allocation, incomeLinksDirty]);

  useEffect(() => {
    if (!isOpen) setIncomeLinksDirty(false);
  }, [isOpen]);
  const createTypologyMutation = trpc.typology.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (transaction) {
      const formatDateForInput = (date: Date | string | null | undefined) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('pt-BR').split('/').reverse().join('-');
      };
      
      setFormData({
        description: transaction.description || '',
        amount: (transaction.amount || 0).toString(),
        transactionDate: formatDateForInput(transaction.transactionDate),
        dueDate: formatDateForInput(transaction.dueDate),
        notes: transaction.notes || '',
        category: transaction.category || '__placeholder__',
        responsibleUserId: transaction.responsibleUserId ?? null,
        fixed: !!transaction.recurrence,
        amountConfirmed: !transaction.isEstimated,
        applyToNext: false,
      });
    }
  }, [transaction]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    try {
      await createTypologyMutation.mutateAsync({
        name: newCategoryName,
        type: 'expense',
        color: newCategoryColor,
      });

      await refetchTypologies();
      setFormData({ ...formData, category: newCategoryName });
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      toast.success('Categoria criada com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar categoria');
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    if (!formData.amount) {
      toast.error('Valor é obrigatório');
      return;
    }

    if (!formData.transactionDate) {
      toast.error('Data da transação é obrigatória');
      return;
    }

    if (formData.category === '__placeholder__') {
      toast.error('Categoria é obrigatória');
      return;
    }

    setIsLoading(true);
    try {
      await updateMutation.mutateAsync({
        id: transactionId || 0,
        category: formData.category,
        description: formData.description,
        amount: formData.amount,
        transactionDate: formData.transactionDate, // Enviar como string YYYY-MM-DD
        dueDate: formData.dueDate, // Enviar como string YYYY-MM-DD
        notes: formData.notes,
        responsibleUserId: formData.responsibleUserId,
        ...(transaction?.isEstimated ? { isEstimated: !formData.amountConfirmed } : {}),
      });

      // "Aplicar aos próximos meses": muda a regra e as próximas não pagas.
      if (recurrenceInfo && formData.applyToNext) {
        await applyFromMutation.mutateAsync({
          transactionId: transactionId || 0,
          amount: formData.amount,
          description: formData.description,
          category: formData.category,
          responsibleUserId: formData.responsibleUserId,
        });
        utils.recurrence.invalidate();
      }

      if (!recurrenceInfo && transaction && formData.fixed !== !!transaction.recurrence) {
        await setRecurrenceMutation.mutateAsync({
          ids: [transaction.id],
          frequency: formData.fixed
            ? ((transaction.recurrence as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | null) ?? 'monthly')
            : null,
        });
      }

      if (incomeLinksDirty && transaction?.type !== 'income') {
        try {
          await setAllocationsMutation.mutateAsync({
            expenseId: transactionId || 0,
            links: incomeLinks,
            workspaceId: workspaceId ?? '',
          });
        } catch (error) {
          utils.transaction.list.invalidate();
          toast.error(
            `Lançamento salvo, mas os vínculos não: ${error instanceof Error ? error.message : 'erro desconhecido'}`
          );
          return;
        }
      }

      await utils.transaction.list.invalidate();

      utils.allocation.invalidate();

      utils.invoice.invalidate();
      toast.success('Transação atualizada com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar transação');
    } finally {
      setIsLoading(false);
    }
  };

  const colorOptions = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh] gap-0 p-0 overflow-hidden">
        {/* Header fixo */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/10 bg-black/20 shrink-0">
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Corpo rolável */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Descrição */}
              <div>
                <Label htmlFor="description" className={FIELD_LABEL}>Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Compra no supermercado"
                />
              </div>

              {/* Valor */}
              <div>
                <Label htmlFor="amount" className={FIELD_LABEL}>Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: e.target.value,
                      // Mudar o valor de uma estimativa é informar o valor real.
                      amountConfirmed: transaction?.isEstimated ? true : formData.amountConfirmed,
                    })
                  }
                  placeholder="0.00"
                />
                {transaction?.isEstimated === 1 && (
                  <label className="mt-2 flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4"
                      checked={formData.amountConfirmed}
                      onChange={(e) => setFormData({ ...formData, amountConfirmed: e.target.checked })}
                    />
                    <span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">Valor estimado pela recorrência.</span>
                      <span className="block text-xs text-muted-foreground">
                        Informe o valor real e marque para confirmar (marcar como pago também confirma).
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {/* Data da Transação */}
              <div>
                <Label htmlFor="transactionDate" className={FIELD_LABEL}>Data da Transação</Label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                />
              </div>

              {/* Data de Vencimento */}
              <div>
                <Label htmlFor="dueDate" className={FIELD_LABEL}>Data de Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              {/* Recorrência (ocorrência gerada por uma regra) */}
              {recurrenceInfo && (
                <div className="rounded-md border border-border p-3 space-y-2 text-sm">
                  <p className="font-medium">
                    Recorrente · {FREQUENCY_LABELS[recurrenceInfo.frequency] ?? recurrenceInfo.frequency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(recurrenceInfo.startDate).toLocaleDateString('pt-BR')}
                    {recurrenceInfo.endDate
                      ? ` até ${new Date(recurrenceInfo.endDate).toLocaleDateString('pt-BR')}`
                      : ' · sem data final'}
                    {' · '}gerado com 1 ano de antecedência
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4"
                      checked={formData.applyToNext}
                      onChange={(e) => setFormData({ ...formData, applyToNext: e.target.checked })}
                    />
                    <span>
                      Aplicar valor, descrição, categoria e responsável aos próximos meses
                      <span className="block text-xs text-muted-foreground">Lançamentos já pagos não mudam.</span>
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={handleEndRecurrence}
                    disabled={endRecurrenceMutation.isPending}
                  >
                    Encerrar recorrência após este lançamento
                  </Button>
                </div>
              )}

              {/* Natureza: fixa (recorrente) ou variável — só para lançamentos sem regra */}
              {!recurrenceInfo && (
              <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4"
                  checked={formData.fixed}
                  onChange={(e) => setFormData({ ...formData, fixed: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-medium">
                    {transaction?.type === 'income' ? 'Receita fixa (recorrente)' : 'Despesa fixa (recorrente)'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Lançamentos criados como recorrentes já vêm marcados. Entra como fixa no comparativo dos relatórios.
                  </span>
                </span>
              </label>
              )}

              {/* Responsável */}
              <div>
                <Label htmlFor="responsibleUserId" className={FIELD_LABEL}>
                  {transaction?.type === 'income' ? 'Quem recebe' : 'Responsável pelo pagamento'}
                </Label>
                <ResponsibleSelect
                  id="responsibleUserId"
                  className="flex h-9 w-full rounded-md border border-input bg-field hover:bg-field-hover px-3 py-1 text-sm shadow-xs"
                  value={formData.responsibleUserId}
                  onChange={(value) => setFormData({ ...formData, responsibleUserId: value })}
                />
              </div>

              {/* Categoria */}
              <div>
                <Label htmlFor="category" className={FIELD_LABEL}>Categoria</Label>
                {!showNewCategoryInput ? (
                  <Select value={formData.category} onValueChange={(value) => {
                    if (value === '__new__') {
                      setShowNewCategoryInput(true);
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const topLevel = typologies
                          .filter((t) => t.parentId == null)
                          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
                        const items: React.ReactNode[] = [];
                        for (const parent of topLevel) {
                          items.push(
                            <SelectItem key={parent.id} value={parent.name}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: parent.color || '#3b82f6' }}
                                />
                                {parent.name}
                              </div>
                            </SelectItem>
                          );
                          const children = typologies
                            .filter((t) => t.parentId === parent.id)
                            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
                          for (const child of children) {
                            items.push(
                              <SelectItem key={child.id} value={child.name}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: child.color || '#3b82f6' }}
                                  />
                                  {"  ↳ "}{child.name}
                                </div>
                              </SelectItem>
                            );
                          }
                        }
                        items.push(
                          <SelectItem key="__new__" value="__new__">
                            <div className="flex items-center gap-2 text-primary">
                              <Plus className="w-4 h-4" />
                              Criar nova categoria
                            </div>
                          </SelectItem>
                        );
                        return items;
                      })()}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nome da categoria"
                      autoFocus
                    />
                    <div className="flex gap-2 flex-wrap">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded-full border-2 ${
                            newCategoryColor === color ? 'border-foreground' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewCategoryColor(color)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateCategory} disabled={createTypologyMutation.isPending}>
                        Criar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Vínculo com receitas */}
              {transaction && transaction.type !== 'income' && (
                <div>
                  <Label className={FIELD_LABEL}>Pago com a receita</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    De qual receita sai o dinheiro desta despesa. Pode dividir entre várias.
                  </p>
                  <IncomeLinksEditor
                    expenseId={transaction.id}
                    expenseAmount={formData.amount}
                    value={incomeLinks}
                    onChange={(links) => {
                      setIncomeLinks(links);
                      setIncomeLinksDirty(true);
                    }}
                  />
                </div>
              )}
              {transaction && transaction.type === 'income' && (
                <div>
                  <Label className={FIELD_LABEL}>Despesas pagas com esta receita</Label>
                  <div className="mt-2">
                    <IncomeCommitments incomeId={transaction.id} />
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <Label htmlFor="notes" className={FIELD_LABEL}>Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Adicione observações sobre esta transação"
                  rows={3}
                />
              </div>

              {/* Links */}
              {transactionId && (
                <div className="border-t pt-4">
                  <TransactionLinksManager transactionId={transactionId} />
                </div>
              )}
            </div>

            {/* Footer fixo */}
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-white/10 bg-black/20 shrink-0">
              {transactionId && (
                <Button
                  variant="ghost"
                  className="mr-auto"
                  title="Transferir para outra área de trabalho"
                  onClick={() => setShowTransfer(true)}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Transferir
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
      <TransferTransactionsDialog
        open={showTransfer}
        ids={transactionId ? [transactionId] : []}
        onClose={() => setShowTransfer(false)}
        onDone={() => {
          onSuccess();
          onClose();
        }}
      />
    </Dialog>
  );
}
