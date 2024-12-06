import { QueryExecResult, SqlValue } from "sql.js";

import { run } from "@softwaretechnik/dbml-renderer";
import "core-js/full/set/is-subset-of";

// This sucessfully imports but we can't use @ts-expect-error as the error is not in at lint but while compiling(?)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Graphviz } from "@hpcc-js/wasm-graphviz";

interface Column {
  name: string;
  type: number | string | Uint8Array;
  nullable: boolean;
  default: SqlValue;
}

interface PartialTable {
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

interface PartialForeignKey {
  from: PartialTable;
  fromColumns: Column[];
  // not the complete types as they aren't available at the time of FN upsert
  to: string;
  toColumns: string[];
  onUpdate: FN_ACTION;
  onDelete: FN_ACTION;
}

interface Table {
  name: string;
  columns: Column[];
  indexes: Index[];
}

interface ForeignKey {
  from: Table;
  fromColumns: Column[];
  to: Table;
  toColumns: Column[];
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
export const tableFromResult = (tableName: string, result: QueryExecResult): { table: PartialTable, primaryKey: Index } => {
  const typedResult = typeResult<{ cid: number, name: string, type: string, notnull: number, dflt_value: SqlValue, pk: number }>(result);
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
export const foreignKeysFromResult = (table: PartialTable, result: QueryExecResult): PartialForeignKey[] => {
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

  const foreignKeys: PartialForeignKey[] = Object.values(partialForeignKeys).map((fk) => {
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
export const indexesFromResult = (table: PartialTable, indexListResult: QueryExecResult, indexInfoResult: { [indexName: string]: QueryExecResult }): Index[] => {
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
  private tables: { [name: string]: PartialTable } = {};
  private indexes: { [tableName: string]: Index[] } = {};
  private foreignKeys: PartialForeignKey[] = [];

  public addTable(table: PartialTable) {
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

  public addForeignKey(foreignKey: PartialForeignKey) {
    this.foreignKeys.push(foreignKey);
  }

  public getTable(name: string): Table {
    const table = this.tables[name];
    if (!table) {
      throw new Error(`Table ${name} not found`);
    }
    return {
      name: table.name,
      columns: table.columns,
      indexes: this.indexes[name] || []
    };
  }

  public getForeignKeys(): ForeignKey[] {
    return this.foreignKeys.map((fk) => {
      const toTable = this.getTable(fk.to);
      return {
        from: this.getTable(fk.from.name),
        fromColumns: fk.fromColumns,
        to: this.getTable(fk.to),
        toColumns: toTable.columns.filter((col) => fk.toColumns.includes(col.name)),
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete
      };
    });
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

  private getDBMLTable(table: Table): string {
    const columns = table.columns.map((column) => this.getDBMLColumn(column)).join("\n");
    const indexesFormatted = table.indexes.map((index) => this.getDBMLIndex(index)).join("\n");
    return `Table ${table.name} {\n${indent(columns, 4)}\n\n${indent("indexes {", 4)}\n${indent(indexesFormatted, 8)}\n${indent("}", 4)}\n}`;
  }

  private isColumnsOnUniqueIndex(table: Table, columns: Column[]): boolean {
    // takes into account that e.x. unique(a) then (a, b) is on a unique index 
    const columnSet = new Set(columns.map((col) => col.name));
    for (const index of table.indexes) {
      if (!index.unique) {
        continue;
      }
      const indexSet = new Set(index.columns.map((col) => col.name));
      if (indexSet.isSubsetOf(columnSet)) {
        return true;
      }

    }

    return false;
  }

  private getForeignKeyType(foreignKey: ForeignKey): string {
    /*
    <: one-to-many. E.g: users.id < posts.user_id
    >: many-to-one. E.g: posts.user_id > users.id
    -: one-to-one. E.g: users.id - user_infos.user_id
    <>: many-to-many. E.g: authors.id <> books.id
    */
    // if toTable any of the columns are a unique index (but not with other), than we have one on the target/to side
    // if fromTable any of the columns are a unique index (but not with other), than we have one on the source/from side

    const toIsUnique = this.isColumnsOnUniqueIndex(foreignKey.to, foreignKey.toColumns);
    const fromIsUnique = this.isColumnsOnUniqueIndex(foreignKey.from, foreignKey.fromColumns);

    if (toIsUnique && fromIsUnique) {
      return "-";
    }
    if (toIsUnique) {
      return ">";
    }
    if (fromIsUnique) {
      return "<";
    }
    return "<>";
  }

  private getDBMLForeignKey(foreignKey: ForeignKey): string {
    const type = this.getForeignKeyType(foreignKey);
    const fromColumns = foreignKey.fromColumns.map((col) => col.name).join(", ");
    const toColumns = foreignKey.toColumns.map((col) => col.name).join(", ");
    // Ref: posts.(user_id1, user_id2) > users.(id1, id2)
    const actions = `[delete: ${foreignKey.onDelete} update: ${foreignKey.onUpdate} ]`;
    return `Ref: ${foreignKey.from.name}.(${fromColumns}) ${type} ${foreignKey.to.name}.(${toColumns}) ${actions}`;
  }

  public getDBML(): string {
    const tables = Object.keys(this.tables).map((name) => {
      const table = this.getTable(name);
      return this.getDBMLTable(table);
    }).join("\n\n");
    const foreignKeys = this.getForeignKeys().map((foreignKey) => this.getDBMLForeignKey(foreignKey)).join("\n\n");

    return `${tables}\n\n${foreignKeys}`.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o");

  }
}


export const dbmlToSVG = async (dbml: string) => {
  const dot = run(dbml, "dot");
  const graphviz = await Graphviz.load();
  return graphviz.dot(dot);
};

export const colorErdSVG = (svg: string, darkMode: boolean): string => {
  console.log(svg);
  return svg;
};
