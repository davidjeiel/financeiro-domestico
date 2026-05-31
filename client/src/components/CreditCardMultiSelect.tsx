import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';

interface CreditCard {
  id: number;
  name: string;
  lastDigits?: string;
  color?: string;
}

interface CreditCardMultiSelectProps {
  creditCards: CreditCard[];
  selectedIds: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  disabled?: boolean;
}

export default function CreditCardMultiSelect({
  creditCards,
  selectedIds,
  onSelectionChange,
  disabled = false,
}: CreditCardMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleToggleCard = (cardId: number) => {
    if (selectedIds.includes(cardId)) {
      onSelectionChange(selectedIds.filter(id => id !== cardId));
    } else {
      onSelectionChange([...selectedIds, cardId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === creditCards.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(creditCards.map(c => c.id));
    }
  };

  const selectedCards = creditCards.filter(c => selectedIds.includes(c.id));
  const displayText = selectedIds.length === 0 
    ? 'Selecionar cartões...'
    : selectedIds.length === creditCards.length
    ? 'Todos os cartões'
    : `${selectedIds.length} cartão${selectedIds.length !== 1 ? 'ões' : ''} selecionado${selectedIds.length !== 1 ? 's' : ''}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || creditCards.length === 0}
          className="w-full justify-between"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Cartões de Crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center space-x-2 p-2 border rounded-lg bg-muted/50">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === creditCards.length && creditCards.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              Selecionar Todos
            </label>
          </div>

          {/* Individual Cards */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {creditCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Checkbox
                  id={`card-${card.id}`}
                  checked={selectedIds.includes(card.id)}
                  onCheckedChange={() => handleToggleCard(card.id)}
                />
                <div className="flex-1 flex items-center gap-2">
                  {card.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: card.color }}
                    />
                  )}
                  <label
                    htmlFor={`card-${card.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {card.name}
                    {card.lastDigits && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ****{card.lastDigits}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="pt-2 border-t text-sm text-muted-foreground">
            {selectedIds.length === 0
              ? 'Nenhum cartão selecionado'
              : selectedIds.length === creditCards.length
              ? `Todos os ${creditCards.length} cartão${creditCards.length !== 1 ? 's' : ''} selecionado${creditCards.length !== 1 ? 's' : ''}`
              : `${selectedIds.length} de ${creditCards.length} cartão${creditCards.length !== 1 ? 's' : ''} selecionado${selectedIds.length !== 1 ? 's' : ''}`}
          </div>

          {/* Close Button */}
          <Button
            onClick={() => setOpen(false)}
            className="w-full"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
