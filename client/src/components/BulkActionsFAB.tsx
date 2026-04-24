import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionsFABProps {
  selectedCount: number;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BulkActionsFAB({
  selectedCount,
  onEdit,
  onDelete,
}: BulkActionsFABProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
      {/* Badge com contagem */}
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold">
          {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
        </div>
      </div>

      {/* Botão de Edição */}
      <Button
        onClick={onEdit}
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center p-0"
        title="Editar selecionados"
      >
        <Edit3 className="w-6 h-6" />
      </Button>

      {/* Botão de Exclusão */}
      <Button
        onClick={onDelete}
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all bg-red-600 hover:bg-red-700 text-white flex items-center justify-center p-0"
        title="Deletar selecionados"
      >
        <Trash2 className="w-6 h-6" />
      </Button>
    </div>
  );
}
