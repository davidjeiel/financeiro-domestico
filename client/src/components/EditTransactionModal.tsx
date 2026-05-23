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
import { Plus } from 'lucide-react';
import TransactionLinksManager from '@/components/TransactionLinksManager';

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
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  const { data: transaction, isLoading: isFetching } = trpc.transaction.get.useQuery(
    { id: transactionId || 0 },
    { enabled: isOpen && transactionId !== null }
  );

  const { data: typologies = [], isLoading: isLoadingTypologies, refetch: refetchTypologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const createTypologyMutation = trpc.typology.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (transaction) {
      setFormData({
        description: transaction.description || '',
        amount: (transaction.amount || 0).toString(),
        transactionDate: transaction.transactionDate
          ? new Date(transaction.transactionDate).toISOString().split('T')[0]
          : '',
        dueDate: transaction.dueDate
          ? new Date(transaction.dueDate).toISOString().split('T')[0]
          : '',
        notes: transaction.notes || '',
        category: transaction.category || '__placeholder__',
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
        description: formData.description,
        amount: formData.amount,
        transactionDate: new Date(formData.transactionDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        notes: formData.notes,
      });

      await utils.transaction.list.invalidate();
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Descrição */}
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Compra no supermercado"
              />
            </div>

            {/* Valor */}
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Data da Transação */}
            <div>
              <Label htmlFor="transactionDate">Data da Transação</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              />
            </div>

            {/* Data de Vencimento */}
            <div>
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {/* Categoria - Seletor Simples */}
            <div>
              <Label htmlFor="category">Categoria</Label>
              {!showNewCategoryInput ? (
                <div className="flex gap-2">
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
                      {typologies.map((typology) => (
                        <SelectItem key={typology.id} value={typology.name}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: typology.color || '#3b82f6' }}
                            />
                            {typology.name}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">
                        <div className="flex items-center gap-2 text-primary">
                          <Plus className="w-4 h-4" />
                          Criar nova categoria
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nome da categoria"
                    autoFocus
                  />
                  <div className="flex gap-2">
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
                    <Button
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={createTypologyMutation.isPending}
                    >
                      Criar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas</Label>
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

            {/* Botões */}
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
