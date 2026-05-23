import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link2, Plus, Trash2, Edit2, ExternalLink } from "lucide-react";

interface TransactionLink {
  url: string;
  title?: string;
  description?: string;
}

interface TransactionLinksManagerProps {
  transactionId: number;
  onLinksChange?: (links: TransactionLink[]) => void;
}

export default function TransactionLinksManager({
  transactionId,
  onLinksChange,
}: TransactionLinksManagerProps) {
  const [links, setLinks] = useState<TransactionLink[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<TransactionLink>({
    url: "",
    title: "",
    description: "",
  });

  const { data: fetchedLinks, isLoading } = trpc.transactionLinks.list.useQuery(
    { transactionId },
    { enabled: transactionId > 0 }
  );

  const addMutation = trpc.transactionLinks.add.useMutation();
  const updateMutation = trpc.transactionLinks.update.useMutation();
  const deleteMutation = trpc.transactionLinks.delete.useMutation();
  const setAllMutation = trpc.transactionLinks.setAll.useMutation();

  useEffect(() => {
    if (fetchedLinks) {
      setLinks(fetchedLinks);
    }
  }, [fetchedLinks]);

  const handleAddLink = async () => {
    if (!formData.url.trim()) {
      toast.error("URL é obrigatória");
      return;
    }

    try {
      // Validate URL format
      new URL(formData.url);
    } catch {
      toast.error("URL inválida");
      return;
    }

    try {
      if (editingIndex !== null) {
        // Update existing link
        await updateMutation.mutateAsync({
          transactionId,
          linkIndex: editingIndex,
          link: {
            url: formData.url,
            title: formData.title || undefined,
            description: formData.description || undefined,
          },
        });

        const updatedLinks = [...links];
        updatedLinks[editingIndex] = {
          url: formData.url,
          title: formData.title || undefined,
          description: formData.description || undefined,
        };
        setLinks(updatedLinks);
        toast.success("Link atualizado com sucesso!");
      } else {
        // Add new link
        await addMutation.mutateAsync({
          transactionId,
          link: {
            url: formData.url,
            title: formData.title || undefined,
            description: formData.description || undefined,
          },
        });

        const newLink: TransactionLink = {
          url: formData.url,
          title: formData.title || undefined,
          description: formData.description || undefined,
        };
        setLinks([...links, newLink]);
        toast.success("Link adicionado com sucesso!");
      }

      // Notify parent component
      onLinksChange?.(links);

      // Reset form
      setFormData({ url: "", title: "", description: "" });
      setEditingIndex(null);
      setShowDialog(false);
    } catch (error) {
      toast.error("Erro ao salvar link");
    }
  };

  const handleEditLink = (index: number) => {
    setEditingIndex(index);
    setFormData(links[index]);
    setShowDialog(true);
  };

  const handleDeleteLink = async (index: number) => {
    if (!confirm("Tem certeza que deseja deletar este link?")) return;

    try {
      await deleteMutation.mutateAsync({
        transactionId,
        linkIndex: index,
      });

      const updatedLinks = links.filter((_, i) => i !== index);
      setLinks(updatedLinks);
      onLinksChange?.(updatedLinks);
      toast.success("Link deletado com sucesso!");
    } catch (error) {
      toast.error("Erro ao deletar link");
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setFormData({ url: "", title: "", description: "" });
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">Links Relacionados</label>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setEditingIndex(null);
                setFormData({ url: "", title: "", description: "" });
              }}
            >
              <Plus className="w-4 h-4" />
              Adicionar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null ? "Editar Link" : "Adicionar Link"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  URL *
                </label>
                <Input
                  type="url"
                  placeholder="https://exemplo.com"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Título
                </label>
                <Input
                  type="text"
                  placeholder="Título do link"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descrição
                </label>
                <Input
                  type="text"
                  placeholder="Descrição breve"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLink}>
                  {editingIndex !== null ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Links List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando links...</div>
      ) : links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 p-3 bg-muted rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate"
                  >
                    {link.title || link.url}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
                {link.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {link.description}
                  </p>
                )}
                {!link.title && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {link.url}
                  </p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditLink(index)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteLink(index)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4">
          Nenhum link adicionado
        </div>
      )}
    </div>
  );
}
