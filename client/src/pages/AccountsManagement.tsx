import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, DollarSign, Loader2 } from 'lucide-react';

export default function AccountsManagement() {
  const { data: accounts, isLoading, refetch } = trpc.account.list.useQuery();
  const createMutation = trpc.account.create.useMutation();
  const updateMutation = trpc.account.update.useMutation();
  const updateBalanceMutation = trpc.account.updateBalance.useMutation();
  const deleteMutation = trpc.account.delete.useMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // Form states
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('checking');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountColor, setNewAccountColor] = useState('#3B82F6');

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('checking');
  const [editColor, setEditColor] = useState('#3B82F6');

  const [balanceValue, setBalanceValue] = useState('');

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      toast.error('Nome da conta é obrigatório');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: newAccountName,
        type: newAccountType as any,
        balance: parseFloat(newAccountBalance || '0'),
        initialBalance: parseFloat(newAccountBalance || '0'),
        color: newAccountColor,
      });
      toast.success('Conta criada com sucesso!');
      setNewAccountName('');
      setNewAccountType('checking');
      setNewAccountBalance('');
      setNewAccountColor('#3B82F6');
      setShowCreateDialog(false);
      refetch();
    } catch (error) {
      toast.error('Erro ao criar conta');
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedAccount.id,
        name: editName,
        type: editType as any,
        color: editColor,
      });
      toast.success('Conta atualizada com sucesso!');
      setShowEditDialog(false);
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar conta');
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedAccount || !balanceValue) {
      toast.error('Valor do saldo é obrigatório');
      return;
    }

    try {
      await updateBalanceMutation.mutateAsync({
        id: selectedAccount.id,
        balance: parseFloat(balanceValue),
      });
      toast.success('Saldo atualizado com sucesso!');
      setShowBalanceDialog(false);
      setBalanceValue('');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar saldo');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar esta conta?')) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Conta deletada com sucesso!');
      refetch();
    } catch (error) {
      toast.error('Erro ao deletar conta');
    }
  };

  const openEditDialog = (account: any) => {
    setSelectedAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditColor(account.color || '#3B82F6');
    setShowEditDialog(true);
  };

  const openBalanceDialog = (account: any) => {
    setSelectedAccount(account);
    setBalanceValue(account.balance.toString());
    setShowBalanceDialog(true);
  };

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contas</h1>
          <p className="text-muted-foreground mt-1">Gerenciar suas contas bancárias e saldos</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Conta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Nome da Conta
                </label>
                <Input
                  placeholder="Ex: Conta Corrente"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Tipo
                </label>
                <Select value={newAccountType} onValueChange={setNewAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Saldo Inicial
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Cor
                </label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newAccountColor === color ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewAccountColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateAccount} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts Grid */}
      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account: any) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: account.color || '#3B82F6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{account.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {account.type === 'checking'
                          ? 'Conta Corrente'
                          : account.type === 'savings'
                          ? 'Poupança'
                          : 'Investimento'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Saldo Atual</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {parseFloat(account.balance).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => openBalanceDialog(account)}
                  >
                    <DollarSign className="w-4 h-4" />
                    Ajustar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(account)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteAccount(account.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma conta criada ainda</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Conta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Nome
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Tipo
              </label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Cor
              </label>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      editColor === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateAccount} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Balance Dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Saldo - {selectedAccount?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Novo Saldo
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={balanceValue}
                onChange={(e) => setBalanceValue(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBalanceDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateBalance} disabled={updateBalanceMutation.isPending}>
                {updateBalanceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
