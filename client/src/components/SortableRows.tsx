import { createContext, useContext, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type HandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  disabled: boolean;
  disabledReason?: string;
};

const HandleContext = createContext<HandleProps | null>(null);

/**
 * Linha de tabela que pode ser arrastada (com dnd-kit). Sem `sortId`, é uma
 * linha comum. O arraste começa só pela alça (<DragHandle />), para não
 * atrapalhar o clique na linha nem a rolagem no celular.
 */
export function SortableTr({
  sortId,
  disabled = false,
  disabledReason,
  children,
  style,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & {
  sortId?: string;
  disabled?: boolean;
  disabledReason?: string;
  children: ReactNode;
}) {
  if (!sortId) {
    return (
      <tr className={className} style={style} {...rest}>
        {children}
      </tr>
    );
  }
  return (
    <SortableInner sortId={sortId} disabled={disabled} disabledReason={disabledReason} className={className} style={style} {...rest}>
      {children}
    </SortableInner>
  );
}

function SortableInner({
  sortId,
  disabled,
  disabledReason,
  children,
  style,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { sortId: string; disabled: boolean; disabledReason?: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
    disabled,
  });
  const rowStyle: CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <HandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef, disabled, disabledReason }}>
      <tr
        ref={setNodeRef}
        style={rowStyle}
        className={`${className ?? ""} ${isDragging ? "shadow-lg bg-card opacity-90" : ""}`}
        {...rest}
      >
        {children}
      </tr>
    </HandleContext.Provider>
  );
}

/** Alça de arrastar; fica dentro de uma <SortableTr sortId=…>. */
export function DragHandle() {
  const ctx = useContext(HandleContext);
  if (!ctx) return <span className="inline-block w-4" aria-hidden />;
  const { attributes, listeners, setActivatorNodeRef, disabled, disabledReason } = ctx;
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...(disabled ? {} : listeners)}
      aria-label="Arrastar para reordenar"
      title={disabled ? disabledReason ?? "Reordenação indisponível" : "Arraste para reordenar (ou use espaço e as setas)"}
      onClick={e => e.stopPropagation()}
      className={`p-0.5 rounded text-muted-foreground touch-none ${
        disabled ? "opacity-30 cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:text-foreground hover:bg-muted"
      }`}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}
