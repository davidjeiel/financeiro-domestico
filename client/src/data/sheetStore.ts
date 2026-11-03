/**
 * Armazenamento dos dados em uma planilha Google do próprio usuário.
 *
 * - A planilha é criada pelo app no Drive do usuário (escopo `drive.file`, o app
 *   só enxerga os arquivos que ele mesmo criou) e é encontrada de novo pelas
 *   `appProperties`.
 * - Cada tabela é uma aba; a linha 1 tem os nomes das colunas.
 * - Todos os dados são carregados em memória no login. Cada alteração atualiza
 *   a memória e reescreve as abas modificadas na planilha.
 */
import { googleFetch } from "./google";
import {
  NOW,
  tables,
  type ColumnDef,
  type Insert,
  type RowTypes,
  type TableDef,
  type TableName,
} from "./schema";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const APP_PROPERTY_KEY = "financeiroDomestico";
const APP_PROPERTY_VALUE = "v1";
const SPREADSHEET_TITLE = "Financeiro Doméstico";
const CACHE_KEY = "fd.spreadsheetId";

type Cell = string | number | boolean | null;

type TableState<T> = {
  def: TableDef;
  rows: T[];
  /** Linhas/colunas ocupadas na aba na última leitura/escrita (para limpar sobras). */
  sheetRows: number;
  sheetCols: number;
};

const tableNames = Object.keys(tables) as TableName[];

const quote = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

// ─── Conversão célula <-> valor ──────────────────────────────────────────────

/** Converte o número de série de data do Sheets (dias desde 30/12/1899). */
const serialToDate = (serial: number) => new Date(Math.round((serial - 25569) * 86400000));

function fromCell(value: Cell | undefined, col: ColumnDef): unknown {
  if (value === undefined || value === null || value === "") return null;
  switch (col.type) {
    case "int": {
      const n = Number(value);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case "decimal": {
      const n = Number(String(value).replace(",", "."));
      return Number.isFinite(n) ? n.toFixed(2) : null;
    }
    case "date": {
      const d = typeof value === "number" ? serialToDate(value) : new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    default:
      return String(value);
  }
}

function toCell(value: unknown, col: ColumnDef): Cell {
  if (value === undefined || value === null) return "";
  switch (col.type) {
    case "int":
    case "decimal": {
      const n = Number(value);
      return Number.isFinite(n) ? n : "";
    }
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? "" : d.toISOString();
    }
    default:
      return String(value);
  }
}

function defaultFor(col: ColumnDef) {
  if (col.default === NOW) return new Date();
  return col.default ?? null;
}

// Cópia profunda simples (Date preservado) para que quem lê não altere a memória.
function clone<T>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    out[k] = v instanceof Date ? new Date(v.getTime()) : v;
  }
  return out as T;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export class SheetStore {
  private state = new Map<TableName, TableState<any>>();
  private dirty = new Set<TableName>();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(readonly spreadsheetId: string) {}

  get url() {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
  }

  /** Garante que todas as abas existem e carrega os dados para a memória. */
  async load() {
    await this.ensureSheets();

    const params = new URLSearchParams({
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    for (const name of tableNames) params.append("ranges", quote(tables[name].sheet));

    const res = await googleFetch<{ valueRanges: { values?: Cell[][] }[] }>(
      `${SHEETS_API}/${this.spreadsheetId}/values:batchGet?${params}`
    );

    this.state.clear();
    this.dirty.clear();
    tableNames.forEach((name, i) => {
      const def: TableDef = tables[name];
      const values = res.valueRanges[i]?.values ?? [];
      const header = (values[0] ?? []).map(h => String(h ?? "").trim());
      const rows: any[] = [];

      for (const line of values.slice(1)) {
        const row: Record<string, unknown> = {};
        for (const [key, col] of Object.entries(def.columns)) {
          const idx = header.indexOf(key);
          row[key] = idx >= 0 ? fromCell(line[idx], col) : defaultFor(col);
        }
        if (typeof row.id === "number") rows.push(row);
      }

      const expectedHeader = Object.keys(def.columns);
      if (expectedHeader.some((key, idx) => header[idx] !== key)) this.dirty.add(name);

      this.state.set(name, {
        def,
        rows,
        sheetRows: values.length,
        sheetCols: values.reduce((max, line) => Math.max(max, line.length), 0),
      });
    });

    // Cabeçalhos ausentes/desatualizados são reescritos já no carregamento.
    await this.commit();
  }

  private async ensureSheets() {
    const meta = await googleFetch<{
      sheets: { properties: { sheetId: number; title: string } }[];
    }>(`${SHEETS_API}/${this.spreadsheetId}?fields=sheets.properties(sheetId,title)`);

    const existing = meta.sheets.map(s => s.properties);
    const wanted = tableNames.map(name => tables[name].sheet);
    const missing = wanted.filter(title => !existing.some(s => s.title === title));
    if (missing.length === 0) return;

    const requests: object[] = missing.map(title => ({
      addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
    }));
    // Planilha recém-criada: remove a aba padrão vazia ("Página1"/"Sheet1").
    if (existing.length === 1 && !wanted.includes(existing[0].title)) {
      requests.push({ deleteSheet: { sheetId: existing[0].sheetId } });
    }

    await googleFetch(`${SHEETS_API}/${this.spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  private table<N extends TableName>(name: N): TableState<RowTypes[N]> {
    const t = this.state.get(name);
    if (!t) throw new Error(`Dados ainda não carregados (${name})`);
    return t;
  }

  // ─── Leitura ───────────────────────────────────────────────────────────────

  select<N extends TableName>(
    name: N,
    where?: (row: RowTypes[N]) => boolean
  ): RowTypes[N][] {
    const rows = this.table(name).rows;
    return (where ? rows.filter(where) : rows).map(clone);
  }

  find<N extends TableName>(
    name: N,
    where: (row: RowTypes[N]) => boolean
  ): RowTypes[N] | null {
    const row = this.table(name).rows.find(where);
    return row ? clone(row) : null;
  }

  // ─── Escrita (em memória; persistida por `commit`) ─────────────────────────

  insert<N extends TableName>(name: N, values: Insert<N>): RowTypes[N] {
    const t = this.table(name);
    const nextId = t.rows.reduce((max, r: any) => Math.max(max, r.id), 0) + 1;
    const row: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(t.def.columns)) {
      const v = (values as Record<string, unknown>)[key];
      row[key] = v === undefined ? defaultFor(col) : v;
    }
    row.id = nextId;
    t.rows.push(row as RowTypes[N]);
    this.dirty.add(name);
    return clone(row as RowTypes[N]);
  }

  /** Atualiza as linhas que satisfazem `where`. Campos `undefined` são ignorados. */
  update<N extends TableName>(
    name: N,
    where: (row: RowTypes[N]) => boolean,
    patch: Insert<N>
  ): number {
    const t = this.table(name);
    const changes = Object.entries(patch).filter(
      ([key, v]) => v !== undefined && key !== "id" && key in t.def.columns
    );
    let count = 0;
    for (const row of t.rows) {
      if (!where(row)) continue;
      for (const [key, v] of changes) (row as Record<string, unknown>)[key] = v;
      if ("updatedAt" in t.def.columns) (row as Record<string, unknown>).updatedAt = new Date();
      count++;
    }
    if (count > 0) this.dirty.add(name);
    return count;
  }

  delete<N extends TableName>(name: N, where: (row: RowTypes[N]) => boolean): number {
    const t = this.table(name);
    const before = t.rows.length;
    t.rows = t.rows.filter(row => !where(row));
    const count = before - t.rows.length;
    if (count > 0) this.dirty.add(name);
    return count;
  }

  /** Grava na planilha as abas alteradas. As gravações são feitas em fila. */
  commit(): Promise<void> {
    const run = this.writeChain.then(() => this.flush());
    // Uma falha não deve travar as próximas gravações.
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async flush() {
    if (this.dirty.size === 0) return;
    const names = Array.from(this.dirty);
    this.dirty.clear();

    const data = names.map(name => {
      const t = this.table(name);
      const columns = Object.entries(t.def.columns);
      const width = Math.max(columns.length, t.sheetCols);
      const pad = (line: Cell[]) => line.concat(Array(width - line.length).fill(""));

      const values: Cell[][] = [
        pad(columns.map(([key]) => key)),
        ...t.rows.map(row =>
          pad(columns.map(([key, col]) => toCell((row as Record<string, unknown>)[key], col)))
        ),
      ];
      // Linhas que sobraram de uma versão maior da aba são apagadas.
      while (values.length < t.sheetRows) values.push(pad([]));
      return { name, range: `${quote(t.def.sheet)}!A1`, values };
    });

    try {
      await googleFetch(`${SHEETS_API}/${this.spreadsheetId}/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: data.map(({ range, values }) => ({ range, values })),
        }),
      });
    } catch (error) {
      names.forEach(name => this.dirty.add(name));
      throw error;
    }

    for (const { name, values } of data) {
      const t = this.table(name);
      t.sheetRows = t.rows.length + 1;
      t.sheetCols = values[0].length;
    }
  }
}

// ─── Localização / criação da planilha ───────────────────────────────────────

function cacheKey(ownerSub: string) {
  return `${CACHE_KEY}.${ownerSub}`;
}

async function spreadsheetExists(id: string) {
  try {
    const file = await googleFetch<{ trashed?: boolean }>(
      `${DRIVE_API}/${id}?fields=id,trashed`
    );
    return !file.trashed;
  } catch {
    return false;
  }
}

/** Encontra a planilha do app no Drive do usuário ou cria uma nova. */
export async function findOrCreateSpreadsheet(ownerSub: string): Promise<string> {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(cacheKey(ownerSub));
  } catch {
    // sem cache
  }
  if (cached && (await spreadsheetExists(cached))) return cached;

  const q =
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }` +
    ` and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const list = await googleFetch<{ files: { id: string }[] }>(
    `${DRIVE_API}?${new URLSearchParams({
      q,
      spaces: "drive",
      orderBy: "createdTime",
      fields: "files(id)",
    })}`
  );

  let id = list.files[0]?.id;
  if (!id) {
    const created = await googleFetch<{ id: string }>(`${DRIVE_API}?fields=id`, {
      method: "POST",
      body: JSON.stringify({
        name: SPREADSHEET_TITLE,
        mimeType: "application/vnd.google-apps.spreadsheet",
        appProperties: { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE },
      }),
    });
    id = created.id;
  }

  try {
    localStorage.setItem(cacheKey(ownerSub), id);
  } catch {
    // sem cache
  }
  return id;
}
