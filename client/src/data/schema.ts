/**
 * Definição das "tabelas" do aplicativo.
 *
 * Cada tabela corresponde a uma aba da planilha Google do usuário. A primeira
 * linha de cada aba guarda os nomes das colunas (as chaves abaixo) e cada
 * linha seguinte é um registro.
 */

export type ColumnType = "int" | "decimal" | "text" | "date";

/** Valor padrão especial: data/hora atual no momento da inserção. */
export const NOW = Symbol("now");

export type ColumnDef = {
  type: ColumnType;
  default?: unknown;
};

export type TableDef = {
  /** Título da aba na planilha. */
  sheet: string;
  columns: Record<string, ColumnDef>;
};

const id: ColumnDef = { type: "int" };
const int = (def?: number): ColumnDef => ({ type: "int", default: def });
const decimal = (def?: string): ColumnDef => ({ type: "decimal", default: def });
const text = (def?: string): ColumnDef => ({ type: "text", default: def });
const date = (def?: typeof NOW): ColumnDef => ({ type: "date", default: def });
const timestamps = { createdAt: date(NOW), updatedAt: date(NOW) };

export const tables = {
  users: {
    sheet: "Usuarios",
    columns: {
      id,
      openId: text(),
      name: text(),
      email: text(),
      loginMethod: text(),
      role: text("user"),
      competencyStartDay: int(1),
      competencyEndDay: int(0),
      ...timestamps,
      lastSignedIn: date(NOW),
    },
  },
  competencies: {
    sheet: "Competencias",
    columns: {
      id,
      userId: int(),
      year: int(),
      month: int(),
      name: text(),
      status: text("open"),
      ...timestamps,
    },
  },
  creditCards: {
    sheet: "Cartoes",
    columns: {
      id,
      userId: int(),
      name: text(),
      lastDigits: text(),
      cutoffDay: int(),
      dueDay: int(),
      limit: decimal(),
      color: text("#3B82F6"),
      isActive: int(1),
      ...timestamps,
    },
  },
  transactions: {
    sheet: "Lancamentos",
    columns: {
      id,
      userId: int(),
      competencyId: int(),
      creditCardId: int(),
      type: text(),
      category: text(),
      description: text(),
      amount: decimal(),
      transactionDate: date(),
      dueDate: date(),
      installments: int(1),
      currentInstallment: int(1),
      notes: text(),
      links: text(),
      isPaid: int(0),
      paidDate: date(),
      ...timestamps,
    },
  },
  invoices: {
    sheet: "Faturas",
    columns: {
      id,
      userId: int(),
      creditCardId: int(),
      competencyId: int(),
      closingDate: date(),
      dueDate: date(),
      totalAmount: decimal(),
      paidAmount: decimal("0.00"),
      status: text("open"),
      ...timestamps,
    },
  },
  typologies: {
    sheet: "Categorias",
    columns: {
      id,
      userId: int(),
      name: text(),
      type: text(),
      description: text(),
      icon: text(),
      color: text("#3B82F6"),
      isActive: int(1),
      sortOrder: int(0),
      parentId: int(),
      links: text(),
      ...timestamps,
    },
  },
  savedFilters: {
    sheet: "FiltrosSalvos",
    columns: {
      id,
      userId: int(),
      name: text(),
      startDate: date(),
      endDate: date(),
      categories: text(),
      types: text(),
      minAmount: decimal(),
      maxAmount: decimal(),
      isDefault: int(0),
      ...timestamps,
    },
  },
  accounts: {
    sheet: "Contas",
    columns: {
      id,
      userId: int(),
      name: text(),
      type: text("checking"),
      balance: decimal("0.00"),
      initialBalance: decimal("0.00"),
      color: text("#3B82F6"),
      isActive: int(1),
      ...timestamps,
    },
  },
  workspaces: {
    sheet: "Workspaces",
    columns: {
      id,
      ownerId: int(),
      name: text(),
      description: text(),
      type: text("personal"),
      isActive: int(1),
      ...timestamps,
    },
  },
  workspaceMembers: {
    sheet: "MembrosWorkspace",
    columns: {
      id,
      workspaceId: int(),
      userId: int(),
      role: text("viewer"),
      joinedAt: date(NOW),
      invitedBy: int(),
      invitedAt: date(),
      status: text("active"),
      ...timestamps,
    },
  },
  workspaceInvites: {
    sheet: "Convites",
    columns: {
      id,
      workspaceId: int(),
      email: text(),
      token: text(),
      role: text("viewer"),
      invitedBy: int(),
      expiresAt: date(),
      acceptedAt: date(),
      acceptedBy: int(),
      status: text("pending"),
      ...timestamps,
    },
  },
  sharedAccounts: {
    sheet: "ContasCompartilhadas",
    columns: {
      id,
      accountId: int(),
      workspaceId: int(),
      shareType: text("shared"),
      ...timestamps,
    },
  },
  transactionResponsibilities: {
    sheet: "Responsabilidades",
    columns: {
      id,
      transactionId: int(),
      userId: int(),
      percentage: decimal("100.00"),
      notes: text(),
      ...timestamps,
    },
  },
  auditLog: {
    sheet: "Auditoria",
    columns: {
      id,
      workspaceId: int(),
      userId: int(),
      action: text(),
      entityType: text(),
      entityId: int(),
      changes: text(),
      createdAt: date(NOW),
    },
  },
} satisfies Record<string, TableDef>;

export type TableName = keyof typeof tables;

// ─── Tipos dos registros ──────────────────────────────────────────────────────

type Timestamps = { createdAt: Date; updatedAt: Date };

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  competencyStartDay: number;
  competencyEndDay: number;
  lastSignedIn: Date;
} & Timestamps;

export type Competency = {
  id: number;
  userId: number;
  year: number;
  month: number;
  name: string;
  status: "open" | "closed";
} & Timestamps;

export type CreditCard = {
  id: number;
  userId: number;
  name: string;
  lastDigits: string | null;
  cutoffDay: number;
  dueDay: number;
  limit: string | null;
  color: string | null;
  isActive: number;
} & Timestamps;

export type TransactionType = "income" | "expense" | "credit_card";

export type Transaction = {
  id: number;
  userId: number;
  competencyId: number;
  creditCardId: number | null;
  type: TransactionType;
  category: string;
  description: string | null;
  amount: string;
  transactionDate: Date;
  dueDate: Date | null;
  installments: number | null;
  currentInstallment: number | null;
  notes: string | null;
  links: string | null;
  isPaid: number;
  paidDate: Date | null;
} & Timestamps;

export type Invoice = {
  id: number;
  userId: number;
  creditCardId: number;
  competencyId: number;
  closingDate: Date;
  dueDate: Date;
  totalAmount: string;
  paidAmount: string | null;
  status: "open" | "partial" | "paid";
} & Timestamps;

export type Typology = {
  id: number;
  userId: number;
  name: string;
  type: TransactionType;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: number;
  sortOrder: number | null;
  parentId: number | null;
  links: string | null;
} & Timestamps;

export type SavedFilter = {
  id: number;
  userId: number;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  categories: string | null;
  types: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  isDefault: number;
} & Timestamps;

export type Account = {
  id: number;
  userId: number;
  name: string;
  type: "checking" | "savings" | "investment";
  balance: string;
  initialBalance: string;
  color: string | null;
  isActive: number;
} & Timestamps;

export type Workspace = {
  id: number;
  ownerId: number;
  name: string;
  description: string | null;
  type: "personal" | "family" | "business";
  isActive: number;
} & Timestamps;

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type WorkspaceMember = {
  id: number;
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  joinedAt: Date;
  invitedBy: number | null;
  invitedAt: Date | null;
  status: "active" | "pending" | "declined";
} & Timestamps;

export type WorkspaceInvite = {
  id: number;
  workspaceId: number;
  email: string;
  token: string;
  role: WorkspaceRole;
  invitedBy: number;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  acceptedBy: number | null;
  status: "pending" | "accepted" | "declined" | "expired";
} & Timestamps;

export type SharedAccount = {
  id: number;
  accountId: number;
  workspaceId: number;
  shareType: "individual" | "joint" | "shared";
} & Timestamps;

export type TransactionResponsibility = {
  id: number;
  transactionId: number;
  userId: number;
  percentage: string | null;
  notes: string | null;
} & Timestamps;

export type AuditLog = {
  id: number;
  workspaceId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: string | null;
  createdAt: Date;
};

export type RowTypes = {
  users: User;
  competencies: Competency;
  creditCards: CreditCard;
  transactions: Transaction;
  invoices: Invoice;
  typologies: Typology;
  savedFilters: SavedFilter;
  accounts: Account;
  workspaces: Workspace;
  workspaceMembers: WorkspaceMember;
  workspaceInvites: WorkspaceInvite;
  sharedAccounts: SharedAccount;
  transactionResponsibilities: TransactionResponsibility;
  auditLog: AuditLog;
};

/** Campos que podem ser omitidos ao inserir (id, padrões e anuláveis). */
export type Insert<T extends TableName> = Partial<RowTypes[T]>;
