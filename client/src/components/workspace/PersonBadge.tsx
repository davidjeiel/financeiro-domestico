type PersonLike = { name: string; color: string; isMe?: boolean; status?: string };

/** Bolinha colorida + nome da pessoa. */
export function PersonBadge({
  person,
  fallback = "—",
  className = "",
}: {
  person?: PersonLike | null;
  fallback?: string;
  className?: string;
}) {
  if (!person) return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: person.color }}
        aria-hidden
      />
      <span className={person.status === "removed" ? "line-through text-muted-foreground" : ""}>
        {person.isMe ? `${person.name} (você)` : person.name}
      </span>
    </span>
  );
}
