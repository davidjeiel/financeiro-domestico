import { usePeople } from "./useWorkspaces";

/**
 * Select nativo com as pessoas da área de trabalho ativa.
 * `value` é o id da pessoa (linha da aba Usuarios) ou `null` (ninguém).
 */
export function ResponsibleSelect({
  value,
  onChange,
  id,
  className = "input-elegant w-full",
  allowEmpty = true,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  id?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const { selectable, byId, isLoading } = usePeople();
  const current = value != null ? byId.get(value) : undefined;
  // Mantém visível um responsável que já saiu da área.
  const options =
    current && current.status === "removed" ? [...selectable, current] : selectable;

  return (
    <select
      id={id}
      className={className}
      value={value ?? ""}
      disabled={isLoading}
      onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {allowEmpty && <option value="">Sem responsável</option>}
      {options.map(p => (
        <option key={p.id} value={p.id}>
          {p.isMe ? `${p.name} (você)` : p.name}
          {p.status === "invited" ? " — convite pendente" : ""}
          {p.status === "guest" ? " — sem acesso" : ""}
          {p.status === "removed" ? " — removida" : ""}
        </option>
      ))}
    </select>
  );
}
