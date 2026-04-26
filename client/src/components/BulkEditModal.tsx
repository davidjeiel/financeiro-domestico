'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Plus } from 'lucide-react';

interface BulkEditModalProps {
  isOpen: boolean;
  selectedIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkEditModal({
  isOpen,
  selectedIds,
  onClose,
  onSuccess,
}: BulkEditModalProps) {
  const [formData, setFormData] = useState({
    category: '__placeholder__',
    transactionDate: '',
    dueDate: '',
    notes: '',
  });

  const [updateFields, setUpdateFields] = useState({
    category: false,
    transactionDate: false,
    dueDate: false,
    notes: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

  const { data: typologies = [], refetch: refetchTypologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const createTypologyMutation = trpc.typology.create.useMutation();
  const utils = trpc.useUtils();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        category: '__placeholder__',
        transactionDate: '',
        dueDate: '',
        notes: '',
      });
      setUpdateFields({
        category: false,
        transactionDate: false,
        dueDate: false,
        notes: false,
      });
      setShowNewCategoryInput(false);
      setNewCategoryName('');
      setNewCategoryColor('#3b82f6');
    }
  }, [isOpen]);

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

  const handleBulkUpdate = async () => {
    const fieldsToUpdate = Object.keys(updateFields).filter(
      (key) => updateFields[key as keyof typeof updateFields]
    );

    if (fieldsToUpdate.length === 0) {
      toast.error('Selecione pelo menos um campo para atualizar');
      return;
    }

    if (updateFields.category && formData.category === '__placeholder__') {
      toast.error('Selecione uma categoria');
      return;
    }

    if (updateFields.transactionDate && !formData.transactionDate) {
      toast.error('Preencha a data da transação');
      return;
    }

    if (updateFields.dueDate && !formData.dueDate) {
      toast.error('Preencha a data de vencimento');
      return;
    }

    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        const updates: any = { id };

        if (updateFields.category && formData.category !== '__placeholder__') {
          updates.category = formData.category;
        }
        if (updateFields.transactionDate) {
          updates.transactionDate = new Date(formData.transactionDate);
        }
        if (updateFields.dueDate) {
          updates.dueDate = new Date(formData.dueDate);
        }
        if (updateFields.notes) {
          updates.notes = formData.notes;
        }

        await updateMutation.mutateAsync(updates);
      }

      await utils.transaction.list.invalidate();
      toast.success(`${selectedIds.length} transação(ões) atualizada(s) com sucesso!`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar transações');
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
          <DialogTitle>Editar {selectedIds.length} Transação(ões)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Marque os campos que deseja atualizar. Os campos não marcados não serão alterados.
          </p>

          {/* Categoria */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="updateCategory"
                checked={updateFields.category}
                onCheckedChange={(checked) =>
                  setUpdateFields({ ...updateFields, category: checked as boolean })
                }
              />
              <Label htmlFor="updateCategory" className="cursor-pointer">
                Atualizar Categoria
              </Label>
            </div>
            {updateFields.category && (
              !showNewCategoryInput ? (
                <div className="flex gap-2">
                  <Select value={formData.category} onValueChange={(value) => {
                    if (value === '__new__') {
                      setShowNewCategoryInput(true);
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}>
                    <SelectTrigger>
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
              )
            )}
          </div>

          {/* Data da Transação */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="updateTransactionDate"
                checked={updateFields.transactionDate}
                onCheckedChange={(checked) =>
                  setUpdateFields({ ...updateFields, transactionDate: checked as boolean })
                }
              />
              <Label htmlFor="updateTransactionDate" className="cursor-pointer">
                Atualizar Data da Transação
              </Label>
            </div>
            {updateFields.transactionDate && (
              <Input
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              />
            )}
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="updateDueDate"
                checked={updateFields.dueDate}
                onCheckedChange={(checked) =>
                  setUpdateFields({ ...updateFields, dueDate: checked as boolean })
                }
              />
              <Label htmlFor="updateDueDate" className="cursor-pointer">
                Atualizar Data de Vencimento
              </Label>
            </div>
            {updateFields.dueDate && (
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="updateNotes"
                checked={updateFields.notes}
                onCheckedChange={(checked) =>
                  setUpdateFields({ ...updateFields, notes: checked as boolean })
                }
              />
              <Label htmlFor="updateNotes" className="cursor-pointer">
                Adicionar Notas
              </Label>
            </div>
            {updateFields.notes && (
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Adicione observações"
                rows={3}
              />
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleBulkUpdate} disabled={isLoading}>
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
