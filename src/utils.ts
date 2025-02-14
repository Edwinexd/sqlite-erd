import { Buffer } from "buffer";
import { QueryExecResult, SqlValue } from "sql.js";

// This sucessfully imports but we can't use @ts-expect-error as the error is not in at lint but while compiling(?)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { MultiSet } from "mnemonist";

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

type FN_ACTION = "CASCADE" | "RESTRICT" | unknown;

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

interface DotTable {
  dot: string;
  id: string;
  mappings: { column: Column, id: string }[];
  extraMappings: { columns: Column[], columnNames: MultiSet<string>, id: string }[];
}

enum ForeignKeyType {
  ONE_TO_MANY = "1:∞",
  MANY_TO_ONE = "∞:1",
  ONE_TO_ONE = "1:1",
  MANY_TO_MANY = "∞:∞",
}

const foreignKeyTypeToTuple = (type: ForeignKeyType): [string, string] => {
  return type.split(":") as [string, string];
};


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
      type: row.type || "ANY",
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
export const indexesFromResult = (table: PartialTable, typedIndexListResult: {seq: number, name: string, unique: number, origin: string, partial: number }[], indexInfoResult: { [indexName: string]: QueryExecResult }): Index[] => {
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

  const tables = executor("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const tableNames = typeResult<{ name: string }>(tables).map((row) => row.name);

  for (const tableName of tableNames) {
    const tableInfo = executor(`PRAGMA table_info(${tableName})`);
    const { table, primaryKey } = tableFromResult(tableName, tableInfo);

    layout.addTable(table);
    // Not sure why but they exist...
    if (primaryKey.columns.length > 0) {
      layout.addIndex(tableName, primaryKey);
    }
    const foreignKeys = executor(`PRAGMA foreign_key_list(${tableName})`);
    const fks = foreignKeysFromResult(table, foreignKeys);
    for (const fk of fks) {
      layout.addForeignKey(fk);
    }

    const indexes = executor(`PRAGMA index_list(${tableName})`);
    const typedIndexList = typeResult<{ seq: number, name: string, unique: number, origin: string, partial: number }>(indexes);
    const indexNames = typedIndexList.map((row) => row.name);
    const indexInfo = indexNames.map((indexName) => {
      return executor(`PRAGMA index_info(${indexName || '""'})`);
    }).reduce((acc, val, index) => {
      return { ...acc, [indexNames[index]]: val };
    }, {});

    const idxs = indexesFromResult(table, typedIndexList, indexInfo);
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
  // We don't start at 0 as it causes graphviz to point some edges to the wrong place
  private dotIdCounter = 1;
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

  public getTable(name: string): Table | undefined {
    const table = this.tables[name];
    if (!table) {
      return undefined;
    }
    return {
      name: table.name,
      columns: table.columns,
      indexes: this.indexes[name] || []
    };
  }

  public getForeignKeys(): ForeignKey[] {
    return this.foreignKeys.filter((fk) => {
      return this.tables[fk.from.name] !== undefined && this.tables[fk.to] !== undefined;
    }).map((fk) => {
      const fromTable = this.getTable(fk.from.name)!;
      const toTable = this.getTable(fk.to)!;
      return {
        from: fromTable,
        fromColumns: fk.fromColumns,
        to: toTable,
        toColumns: fk.toColumns.filter((col) => toTable.columns.map((col) => col.name).includes(col)).map((col) => toTable.columns.find((c) => c.name === col)!),
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete
      };
    });
  }

  private isColumnsOnUniqueIndex(table: Table, columns: Column[]): boolean {
    // takes into account that e.x. unique(a) then (a, b) is on a unique index 
    const columnSet = MultiSet.from(columns.map((col) => col.name));
    for (const index of table.indexes) {
      if (!index.unique) {
        continue;
      }
      const indexSet = MultiSet.from(index.columns.map((col) => col.name));
      if (MultiSet.isSuperset(columnSet, indexSet)) {
        return true;
      }
    }

    return false;
  }

  private getForeignKeyType(foreignKey: ForeignKey): ForeignKeyType {
    const isToUnique = this.isColumnsOnUniqueIndex(foreignKey.to, foreignKey.toColumns);
    const isFromUnique = this.isColumnsOnUniqueIndex(foreignKey.from, foreignKey.fromColumns);

    if (isToUnique && isFromUnique) {
      return ForeignKeyType.ONE_TO_ONE;
    }
    if (isToUnique) {
      return ForeignKeyType.MANY_TO_ONE;
    }
    if (isFromUnique) {
      return ForeignKeyType.ONE_TO_MANY;
    }
    return ForeignKeyType.MANY_TO_MANY;
  }

  private getDotColumn(column: Column, id: string, isPrimaryKey: boolean, padTo: number = 0): string {
    const padding = " ".repeat(padTo - column.name.length + 2);
    const parts: string[] = [`<TR><TD ALIGN="LEFT" PORT="${id}" BGCOLOR="#e7e2dd"><TABLE CELLPADDING="0" CELLSPACING="0" BORDER="0">`];
    parts.push('<TR><TD ALIGN="LEFT">' + (isPrimaryKey ? "<B>" : "") + `${column.name}<FONT COLOR="transparent">${padding}</FONT>` + (isPrimaryKey ? "</B>" : "") + "</TD>");
    parts.push(`<TD ALIGN="RIGHT"><FONT><I>${column.type}${column.nullable ? " NULL" : ""}</I></FONT></TD>`);
    parts.push("</TR></TABLE></TD></TR>");
    return parts.join("\n");
  }

  private getDotTable(table: Table): DotTable {
    const mappings = table.columns.map((column) => {
      return { column, id: `f${this.dotIdCounter++}` };
    } );
    const extraMappings: { columns: Column[], columnNames: MultiSet<string>, id: string, index: boolean, unique: boolean}[] = [];

    for (const index of table.indexes) {
      const relevantColumns = index.columns;
      const relevantColumnNames = MultiSet.from(relevantColumns.map((col) => col.name));

      if (index.primaryKey) {
        continue;
      }

      if (extraMappings.find((mapping) => MultiSet.isSubset(mapping.columnNames, relevantColumnNames) && mapping.columnNames.size === relevantColumnNames.size)) {
        continue;
      }

      extraMappings.push({ columns: relevantColumns, columnNames: relevantColumnNames, id: `f${this.dotIdCounter++}`, index: true, unique: index.unique });
    }

    for (const foreignKey of this.getForeignKeys()) {
      const relevantTable = foreignKey.from.name === table.name ? foreignKey.from : foreignKey.to;
      if (relevantTable.name !== table.name) {
        continue;
      }

      const relevantColumns = foreignKey.from.name === table.name ? foreignKey.fromColumns : foreignKey.toColumns;
      const relevantColumnNames = MultiSet.from(relevantColumns.map((col) => col.name));

      if (relevantColumns.length === 1) {
        continue;
      }

      if (extraMappings.find((mapping) => MultiSet.isSubset(mapping.columnNames, relevantColumnNames) && mapping.columnNames.size === relevantColumnNames.size)) {
        continue;
      }


      extraMappings.push({ columns: relevantColumns, columnNames: relevantColumnNames, id: `f${this.dotIdCounter++}`, index: false, unique: false });
    }

    const tableId = table.name;

    const parts: string[] = [];
    parts.push(`"${table.name}" [id="${tableId}";label=<<TABLE BORDER="2" COLOR="#29235c" CELLBORDER="1" CELLSPACING="0" CELLPADDING="10">`);
    parts.push(`<TR><TD PORT="f0" BGCOLOR="#1d71b8"><FONT COLOR="#ffffff"><B>${table.name}</B></FONT></TD></TR>`);
    const longestColumnLength = Math.max(...table.columns.map((col) => col.name.length));
    for (const mapping of mappings) {
      parts.push(this.getDotColumn(mapping.column, mapping.id, table.indexes.find((index) => index.primaryKey && index.columns.includes(mapping.column)) !== undefined, longestColumnLength));
    }
    for (const extraMapping of extraMappings) {
      const mappingFlags: string[] = [];
      if (extraMapping.index) {
        mappingFlags.push("INDEX");
      }
      if (extraMapping.unique) {
        mappingFlags.push("UNIQUE");
      }
      const indexString = mappingFlags.length > 0 ? ` (${mappingFlags.join(", ")})` : "";
      parts.push(`<TR><TD PORT="${extraMapping.id}" BGCOLOR="#e7e2dd" ALIGN="CENTER"><FONT COLOR="#1d71b8"><I>    ${extraMapping.columns.map((col) => col.name).join(", ")}${indexString}    </I></FONT></TD></TR>`);
    }
    parts.push("</TABLE>>];");

    return { dot: parts.join("\n"), id: tableId, mappings, extraMappings };
  }

  private getDotForeignKey(foreignKey: ForeignKey, tables: { [name: string]: DotTable }): string {
    const fromTable = tables[foreignKey.from.name];
    const toTable = tables[foreignKey.to.name];
    
    let [fromColumnId, toColumnId] = ["", ""];

    if (foreignKey.fromColumns.length === 1) {
      fromColumnId = fromTable.mappings.find((mapping) => mapping.column === foreignKey.fromColumns[0])!.id;
      toColumnId = toTable.mappings.find((mapping) => mapping.column === foreignKey.toColumns[0])!.id;
    } else {
      const fromColumns = MultiSet.from(foreignKey.fromColumns.map((col) => col.name));
      const toColumns = MultiSet.from(foreignKey.toColumns.map((col) => col.name));
      const fromMapping = fromTable.extraMappings.find((mapping) => MultiSet.isSubset(mapping.columnNames, fromColumns) && mapping.columnNames.size === fromColumns.size)!;
      const toMapping = toTable.extraMappings.find((mapping) => MultiSet.isSubset(mapping.columnNames, toColumns) && mapping.columnNames.size === toColumns.size)!;
      fromColumnId = fromMapping.id;
      toColumnId = toMapping.id;
    }

    const [tailLabel, headLabel] = foreignKeyTypeToTuple(this.getForeignKeyType(foreignKey));
    
    // label=<<I>{${foreignKey.onUpdate}, ${foreignKey.onDelete}}</I>>
    return `"${foreignKey.from.name}":${fromColumnId} -> "${foreignKey.to.name}":${toColumnId} [dir=forward, penwidth=4, color="#29235c", headlabel="${headLabel}", taillabel="${tailLabel}" labeldistance=3.5, labelfontsize=52, arrowhead=open, arrowsize=2];`;
  }

  public getDot(): string {
    this.dotIdCounter = 1;
    const parts: string[] = [];
    parts.push("digraph SQLiteLayout {");
    // rankdir=TB,BT,LR,RL
    // settings copied from https://github.com/softwaretechnik-berlin/dbml-renderer
    parts.push('charset="utf-8"; rankdir=LR; graph [fontname="helvetica", fontsize=42, fontcolor="#29235c", bgcolor="transparent"]; node [penwidth=0, margin=0, fontname="helvetica", fontsize=42, fontcolor="#29235c", width=2, height=2]; edge [fontname="helvetica", fontsize=42, fontcolor="#29235c", color="#29235c"];');
    const tables = Object.keys(this.tables).map((name) => this.getTable(name)!).map((table) => {
      return { name: table.name, value: this.getDotTable(table) };
    }).reduce((acc, val) => {
      return { ...acc, [val.name]: val.value };
    }, {} as { [name: string]: DotTable });
    parts.push(...Object.values(tables).map((table) => table.dot));

    const foreignKeys = this.getForeignKeys().map((foreignKey) => this.getDotForeignKey(foreignKey, tables)).filter((fk) => fk.length > 0);
    parts.push(...foreignKeys);
    parts.push("}");


    return parts.join("\n");
  }

  public getDebug(): object {
    return {
      tables: this.tables,
      indexes: this.indexes,
      foreignKeys: this.foreignKeys
    };
  }
}

export const dotToSvg = async (dot: string) => {
  const graphviz = await Graphviz.load();
  return graphviz.dot(dot);
};

interface Theme {
  text: string;
  tableHeader: string;
  tableBackground: string;
  tableDetails: string;
  pkText: string;
  lines: string;
}

/* Default theme
const DEFAULT_THEME = {
  text: "#29235c",
  tableHeader: "#1d71b8",
  tableBackground: "#e7e2dd",
  tableDetails: "#29235c",
  pkText: "#1d71b8",
  lines: "#29235c",
};
*/
const LIGHT_THEME: Theme = {
  text: "#334155",
  tableHeader: "#3b82f6",
  tableBackground: "#cbd5e1",
  tableDetails: "#cbd5e1",
  pkText: "#003373",
  lines: "#334155",
};

const DARK_THEME: Theme = {
  text: "#ffffff",
  tableHeader: "#3b82f6",
  tableBackground: "#334155",
  tableDetails: "#334155",
  pkText: "#BEEAFF",
  lines: "#ffffff",
};

export const colorErdSVG = (svg: string, darkMode: boolean): string => {
  // Define the theme
  const theme = darkMode ? DARK_THEME : LIGHT_THEME;

  // Parse the SVG string into a DOM object
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = doc.documentElement as unknown as SVGSVGElement;

  // Update node elements
  svgElement.querySelectorAll("g.node *").forEach((element) => {
    if (element instanceof SVGPolygonElement) {
      // Update polygon fill
      if (element.getAttribute("fill") === "#1d71b8") {
        element.setAttribute("fill", theme.tableHeader);
      } else if (element.getAttribute("fill") === "#e7e2dd") {
        element.setAttribute("fill", theme.tableBackground);
      }

      // Update polygon stroke
      if (element.getAttribute("stroke") === "#29235c") {
        element.setAttribute("stroke", theme.tableDetails);
      }
    } else if (element instanceof SVGTextElement) {
      // Update text fill
      const fillColor = element.getAttribute("fill");
      if (fillColor === "#29235c") {
        element.setAttribute("fill", theme.text);
      } else if (fillColor === "#1d71b8") {
        element.setAttribute("font-weight", "bold");
        element.setAttribute("fill", theme.pkText);
      }
    }
  });

  // Update edge elements
  svgElement.querySelectorAll("g.edge *").forEach((element) => {
    if (element instanceof SVGPathElement || element instanceof SVGPolygonElement) {
      // Update edge lines or arrows
      if (element.getAttribute("stroke") === "#29235c") {
        element.setAttribute("stroke", theme.lines);
      }
    } else if (element instanceof SVGTextElement) {
      // Update multiplicity text
      if (element.getAttribute("fill") === "#29235c") {
        element.setAttribute("fill", theme.text);
      }
    }
  });

  // Serialize the updated DOM back to a string
  const serializer = new XMLSerializer();
  // Without the "hacks" the render would be broken
  const svgContent = serializer.serializeToString(svgElement).replaceAll(" ", "&#160;");
  const xmlProlog = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
  const doctype = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
  
  return `${xmlProlog}\n${doctype}\n${svgContent}`;
};

export const downloadSvgAsPng = (svgString: string, filename: string): void => {
  const svg = new DOMParser().parseFromString(svgString, "image/svg+xml").documentElement;
  const width = svg.getAttribute("width") || "1920";
  const height = svg.getAttribute("height") || "1080";

  const canvas = document.createElement("canvas");
  canvas.width = parseFloat(width);
  canvas.height = parseFloat(height);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    alert("Failed to create canvas context");
    return;
  }

  const img = new Image();

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngDataUrl = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = pngDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  img.onerror = (err) => {
    alert(`Failed to load SVG: ${err}`);
  };

  img.src = `data:image/svg+xml;base64,${Buffer.from(svgString, "utf-8").toString("base64")}`;
};
