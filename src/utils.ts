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

interface Index {
  columns: Column[];
  unique: boolean;
  primaryKey: boolean;
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
  return result.values.map((row) => {
    const obj: { [key: string]: SqlValue } = {};
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj as T;
  });
};

export const tableFromResult = (tableName: string, result: QueryExecResult): { table: Table, primaryKey: Index } => {
  const typedResult = typeResult<{ cid: number, name: string, type: string, notnull: number, dflt_value: SqlValue, pk: number }>(result);
  const columns: (Column & { pk: boolean })[] = typedResult.map((row) => {
    return {
      name: row.name,
      type: row.type,
      nullable: !(row.notnull === 1),
      default: row.dflt_value,
      pk: row.pk === 1
    };
  });

  const primaryKey: Index = {
    columns: columns.filter((col) => col.pk),
    unique: true,
    primaryKey: true,
  };

  return {
    table: { name: tableName, columns },
    primaryKey
  };
};

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
/*
seq	name	unique	origin	partial
0	sqlite_autoindex_Student_1	1	pk	0
*/
// PRAGMA index_info(index)
/*
seqno	cid	name
0	0	personnummer
*/

export const indexesFromResult = (table: Table, indexListResult: QueryExecResult, indexInfoResult: { [indexName: string]: QueryExecResult }): Index[] => {
  const typedIndexListResult = typeResult<{ seq: number, name: string, unique: number, origin: string, partial: number }>(indexListResult);
  const typedInfoResults: { [indexName: string]: { seqno: number, cid: number, name: string }[] } = Object.entries(indexInfoResult).map(([indexName, result]) => {
    return {
      [indexName]: typeResult<{ seqno: number, cid: number, name: string }>(result)
    };
  }).reduce((acc, val) => {
    return { ...acc, ...val };
  }, {});
  // TODO: Implement
};

export class SQLiteLayout {
  // tables = name: Table[]
  // indexes = tableName: Index[]
  // foreignKeys =  fromtable: ForeignKey[]
  private tables: { [name: string]: Table } = {};
  private indexes: { [tableName: string]: Index } = {};
  private foreignKeys: ForeignKey[] = [];

  public addTable(table: Table) {
    this.tables[table.name] = table;
  }

  
}

const test = new SQLiteLayout();
