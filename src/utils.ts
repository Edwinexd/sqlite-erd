import { QueryExecResult, SqlValue } from "sql.js";

export const sqliteInfoToIntermediate = (_result: unknown) => {
  return "TODO";
};

interface Column {
  name: string;
  type: number | string | Uint8Array;
  nullable: boolean;
  default: SqlValue;
}

interface Table {
  name: string;
  columns: Column[];
}

class Index {
  columns: Column[];
  unique: boolean;
  primaryKey: boolean;

  constructor(columns: Column[], unique: boolean, primaryKey: boolean) {
    this.columns = columns;
    this.unique = unique;
    this.primaryKey = primaryKey;
  }

  // Ideally should prob deal with hashcodes and such but we will be dealing with very small datasets
  public equals(other: Index): boolean {
    if (this.columns.length !== other.columns.length) {
      return false;
    }
    for (let i = 0; i < this.columns.length; i++) {
      if (this.columns[i].name !== other.columns[i].name) {
        return false;
      }
    }
    return this.unique === other.unique && this.primaryKey === other.primaryKey;
  }
}

type FN_ACTION = "CASCADE" | "RESTRICT" | "TODO WRITE THEM ALL";

interface ForeignKey {
  from: Table;
  fromColumns: Column[];
  // not the complete types as they aren't available at the time of FN upsert
  to: string;
  toColumns: string[];
  onUpdate: FN_ACTION;
  onDelete: FN_ACTION;
}

const typeResult = <T>(result: QueryExecResult): T[] => {
  if (result === undefined) {
    throw new Error("Result is undefined");
  }
  return result.values.map((row) => {
    const obj: { [key: string]: SqlValue } = {};
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj as T;
  });
};

// PRAGMA table_info(table)
export const tableFromResult = (tableName: string, result: QueryExecResult): { table: Table, primaryKey: Index } => {
  const typedResult = typeResult<{ cid: number, name: string, type: string, notnull: number, dflt_value: SqlValue, pk: number }>(result);
  console.log(typedResult);
  const columns: (Column & { pk: boolean })[] = typedResult.map((row) => {
    return {
      name: row.name,
      type: row.type,
      nullable: !(row.notnull === 1),
      default: row.dflt_value,
      pk: row.pk > 0
    };
  });

  const primaryKey: Index = new Index(columns.filter((col) => col.pk), true, true);

  return {
    table: { name: tableName, columns },
    primaryKey
  };
};

// PRAGMA foreign_key_list(table)
export const foreignKeysFromResult = (table: Table, result: QueryExecResult): ForeignKey[] => {
  const typedResult = typeResult<{ id: number, seq: number, table: string, from: string, to: string, on_update: string, on_delete: string, match: string }>(result);
  const partialForeignKeys: { [id: number]: { toTable: string, onUpdate: FN_ACTION, onDelete: FN_ACTION, columns: { from: string, to: string }[] } } = {};
  for (const row of typedResult) {
    const id = row.id;
    if (!partialForeignKeys[id]) {
      partialForeignKeys[id] = {
        toTable: row.table,
        onUpdate: row.on_update as FN_ACTION,
        onDelete: row.on_delete as FN_ACTION,
        columns: []
      };
    }

    partialForeignKeys[id].columns.push({
      from: row.from,
      to: row.to
    });
  }

  const foreignKeys: ForeignKey[] = Object.values(partialForeignKeys).map((fk) => {
    return {
      from: table,
      fromColumns: fk.columns.map((col) => table.columns.find((c) => c.name === col.from)!),
      to: fk.toTable,
      toColumns: fk.columns.map((col) => col.to),
      onUpdate: fk.onUpdate,
      onDelete: fk.onDelete
    };
  });

  return foreignKeys;
};

// PRAGMA index_list(table)
// PRAGMA index_info(index)
export const indexesFromResult = (table: Table, indexListResult: QueryExecResult, indexInfoResult: { [indexName: string]: QueryExecResult }): Index[] => {
  const typedIndexListResult = typeResult<{ seq: number, name: string, unique: number, origin: string, partial: number }>(indexListResult);
  const typedInfoResults: { [indexName: string]: { seqno: number, cid: number, name: string }[] } = Object.entries(indexInfoResult).map(([indexName, result]) => {
    return {
      [indexName]: typeResult<{ seqno: number, cid: number, name: string }>(result)
    };
  }).reduce((acc, val) => {
    return { ...acc, ...val };
  }, {});

  const indexes: Index[] = [];

  for (const index of typedIndexListResult) {
    const info = typedInfoResults[index.name];
    const columns = table.columns.filter((col) => info.find((i) => i.name === col.name) !== undefined);
    indexes.push(new Index(
      columns,
      index.unique === 1,
      index.origin === "pk" // TODO: Should more origins be handled?
    ));
  }

  return indexes;
};

// function executor which takes a string and returns a QueryExecResult

export const executorToLayout = (executor: (query: string) => QueryExecResult): SQLiteLayout => {
  const layout = new SQLiteLayout();

  const tables = executor("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = typeResult<{ name: string }>(tables).map((row) => row.name);

  for (const tableName of tableNames) {
    const tableInfo = executor(`PRAGMA table_info(${tableName})`);
    const { table, primaryKey } = tableFromResult(tableName, tableInfo);
    console.log(table, primaryKey);

    layout.addTable(table);
    layout.addIndex(tableName, primaryKey);

    const foreignKeys = executor(`PRAGMA foreign_key_list(${tableName})`);
    const fks = foreignKeysFromResult(table, foreignKeys);
    for (const fk of fks) {
      layout.addForeignKey(fk);
    }

    const indexes = executor(`PRAGMA index_list(${tableName})`);
    const indexNames = typeResult<{ name: string }>(indexes).map((row) => row.name);
    const indexInfo = indexNames.map((indexName) => {
      return executor(`PRAGMA index_info(${indexName})`);
    }).reduce((acc, val, index) => {
      return { ...acc, [indexNames[index]]: val };
    }, {});

    const idxs = indexesFromResult(table, indexes, indexInfo);
    for (const idx of idxs) {
      layout.addIndex(tableName, idx);
    }
  }

  return layout;
};

export const indent = (str: string, level: number) => {
  return str.split("\n").map((line) => " ".repeat(level) + line).join("\n");
};

export class SQLiteLayout {
  private tables: { [name: string]: Table } = {};
  private indexes: { [tableName: string]: Index[] } = {};
  private foreignKeys: ForeignKey[] = [];

  public addTable(table: Table) {
    this.tables[table.name] = table;
  }

  public addIndex(tableName: string, index: Index) {
    if (!this.indexes[tableName]) {
      this.indexes[tableName] = [];
    }
    if (this.indexes[tableName].find((i) => i.equals(index))) {
      return;
    }
    this.indexes[tableName].push(index);
  }

  public addForeignKey(foreignKey: ForeignKey) {
    this.foreignKeys.push(foreignKey);
  }

  private formatColumnDefault(value: SqlValue): string {
    if (value === null) {
      return "null";
    }
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "string") {
      return `'${value}'`;
    }
    if (value instanceof Uint8Array) {
      return `'BLOB:${value.toString()}'`;
    }
    return "`Unsupported default value type`";
  }

  private getDBMLColumn(column: Column): string {
    const settings = [];
    if (!column.nullable) {
      settings.push("not null");
    }
    settings.push(`default: ${this.formatColumnDefault(column.default)}`);
    return `${column.name} ${column.type} [${settings.join(", ")}]`;
  }

  private getDBMLIndex(index: Index): string {
    const settings = [];
    if (index.primaryKey) {
      settings.push("pk");
    } else if (index.unique) {
      settings.push("unique");
    }
    const columns = index.columns.map((column) => column.name).join(", ");
    const settingsString = settings.length === 0 ? "" : `[${settings.join(", ")}]`;
    return `(${columns}) ${settingsString}`;

  }

  private getDBMLTable(table: Table, indexes: Index[]): string {
    const columns = table.columns.map((column) => this.getDBMLColumn(column)).join("\n");
    const indexesFormatted = indexes.map((index) => this.getDBMLIndex(index)).join("\n");
    return `Table ${table.name} {\n${indent(columns, 4)}\n\n${indent("indexes {", 4)}\n${indent(indexesFormatted, 8)}\n${indent("}", 4)}\n}`;
  }


  private getDBMLForeignKey(foreignKey: ForeignKey, fromTable: Table, toTable: Table): string {
    return "TODO";
  }

  public getDBML(): string {
    const tables = Object.entries(this.tables).map(([name, table]) => {
      const indexes = this.indexes[name] || [];
      return this.getDBMLTable(table, indexes);
    }).join("\n\n");
    const foreignKeys = this.foreignKeys.map((foreignKey) => this.getDBMLForeignKey(foreignKey, this.tables[foreignKey.from.name], this.tables[foreignKey.to])).join("\n");

    return `${tables}\n${foreignKeys}`.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o");

  }

  public consoleLog() {
    console.group("Database Dump");
    console.log("Tables:");
    console.table(this.tables);
    
    console.log("Indexes:");
    console.table(this.indexes);
    
    console.log("Foreign Keys:");
    console.table(this.foreignKeys);
    
    console.groupEnd();
  }
  // TODO: Methods for DBML generation

  
}
