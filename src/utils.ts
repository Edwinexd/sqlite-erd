import { QueryExecResult } from "sql.js";

export const sqliteInfoToIntermediate = (_result: unknown) => {
  return "TODO";
};

interface Column {
  name: string;
  type: number | string | Uint8Array;
  nullable: boolean;
  default: number | string | Uint8Array | null;
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

type FN_ACTION = "CASCADE" | "TODO WRITE THEM ALL";

interface ForeignKey {
  from: Table;
  fromColumns: Column[];
  to: Table;
  toColumns: Column[];
  onUpdate: FN_ACTION;
  onDelete: FN_ACTION;
}

/*
cid	name	type	notnull	dflt_value	pk
0	personnummer	TEXT	0	NULL	1
1	funktionshindrad	INTEGER	0	NULL	0
*/
export const tableFromResult = (tableName: string, result: QueryExecResult): { table: Table, primaryKey: Index } => {
  const resultColumns = result.columns;
  const columns: Column[] = result.values.map((row) => {
    const nameIndex = resultColumns.indexOf("name");
    const typeIndex = resultColumns.indexOf("type");
    const notNullIndex = resultColumns.indexOf("type");
    const defaultIndex = resultColumns.indexOf("dflt_value");
    return {
      name: row[nameIndex] as string,
      type: row[typeIndex] as string,
      nullable: !(row[notNullIndex] === 1),
      default: row[defaultIndex]
    };
  });

  const primaryKey: Index = {
    columns: columns.filter((_column, index) => result.values[index][resultColumns.indexOf("pk")] === 1),
    unique: true,
    primaryKey: true,
  };

  return {
    table: { name: tableName, columns },
    primaryKey
  };
};

export class SQLiteLayout {
  // tables = name: Table[]
  // indexes = tableName: Index[]
  // foreignKeys =  fromtable: ForeignKey[]
  private tables: Table[];
  private indexes: Index[];
  private foreignKeys: ForeignKey[];

  constructor() {
    this.tables = [];
    this.indexes = [];
    this.foreignKeys = [];
  }

  public addTable(table: Table) {
    this.tables.push(table);
  }

  
}

const test = new SQLiteLayout();
