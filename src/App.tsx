/*
A web application that generates an Entity-Relationship Diagram (ERD) from a SQLite database file
Copyright (C) 2024 Edwin Sundberg

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import React, { useCallback, useEffect, useState } from "react";
import "./App.css";

import initSqlJs from "sql.js";

import PrivacyNoticeToggle from "./PrivacyNoticeToggle";
import SqliteInput from "./SqliteInput";
import ThemeToggle from "./ThemeToggle";
import useTheme from "./useTheme";
import { colorErdSVG, dotToSvg, downloadSvgAsPng, executorToLayout } from "./utils";

import { format as formatFns } from "date-fns";

function App() {
  const [engine, setEngine] = useState<initSqlJs.SqlJsStatic>();
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [error, setError] = useState<string | null>(null);

  const [erdSVG, setErdSVG] = useState<string>();
  const [erdImage, setErdImage] = useState<string>();

  const { setTheme, isDarkMode } = useTheme();

  const initSQLEngine = useCallback(async () => {
    const sql = await initSqlJs(
      {
        locateFile: (file) => `/dist/sql.js/${file}`,
      }
    );

    setEngine(sql);
  }, []);

  useEffect(() => {
    initSQLEngine();
  }, [initSQLEngine]);


  useEffect(() => {
    if (!database) {
      return;
    }

    const layout = executorToLayout((query: string) => { 
      if (!database) {
        return { columns: [], values: [] };
      }
      const res = database.exec(query);
      if (res.length === 0) {
        return { columns: [], values: [] };
      }
      return res[0];
    });

    const dot = layout.getDot();
    console.log(dot);
    dotToSvg(dot).then((svg) => {
      setErdSVG(svg);
    }).catch((error) => {
      setError("Error generating ERD: " + error);
    });
  }, [database]);


  const loadDatabase = useCallback(async (data: Uint8Array) => {
    if (!engine) {
      return;
    }

    try {
      const db = new engine.Database(data);
      setDatabase(db);
    } catch (error) {
      setError("Error reading database file. Please upload a valid SQLite database file.\n\nError: " + error);
      return;
    }
  }, [engine]);


  const handleFile = useCallback((file: File) => {
    setError(null);
    setDatabase(undefined);
    const reader = new FileReader();
    reader.onload = async () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        setError("Error reading database file. Please upload a valid SQLite database file.");
        return;
      }
      const data = new Uint8Array(reader.result);
      await loadDatabase(data);
    };
    reader.readAsArrayBuffer(file);
  }, [loadDatabase]);



  useEffect(() => {
    if (!erdSVG) {
      return;
    }

    const finalSVG = colorErdSVG(erdSVG, isDarkMode());

    setErdImage(`data:image/svg+xml;base64,${btoa(finalSVG)}`);
  }, [erdSVG, isDarkMode]);

  const exportPng = useCallback(() => {
    if (!erdSVG) {
      return;
    }

    const formattedTimestamp = formatFns(new Date(), "yyyyMMdd_HHmm");
    const fileName = `sqlite_erd_${formattedTimestamp}.png`;
    downloadSvgAsPng(colorErdSVG(erdSVG, false), fileName);
  }, [erdSVG]);

  return (
    <div className="App">
      <header className="App-header">
        <div className="my-2"></div>
        <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode}></ThemeToggle>
        <h1 className="text-6xl font-semibold my-3">SQLite ERD</h1>
        <div className="max-w-4xl w-full min-h-96 my-3 relative">
          {erdImage ? (
            <img
              src={erdImage}
              alt="ERD Diagram"
              style={{
                width: "100%",
                height: "auto",
              }}
            />
          ) : (
            <SqliteInput onUpload={(file) => {handleFile(file);}} onError={(errorMessage) => setError(errorMessage)}></SqliteInput>
          )}
        </div>


        {error && <p className="font-mono text-red-500 max-w-4xl text-xl">{error}</p>}

        <button
          className="bg-green-500 hover:bg-green-700 disabled:bg-green-400 disabled:opacity-50 text-white text-xl font-semibold py-2 px-4 my-4 rounded w-60" 
          onClick={() => exportPng()}
          type="submit" disabled={!erdImage}
        >
          Download ERD (PNG)
        </button>

        
        <footer className="text-lg py-4 my-3">
          <div className="flex flex-wrap mx-2 justify-center items-center gap-x-8 gap-y-4">
            <p>Copyright &copy; <a href="https://github.com/Edwinexd" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Edwin Sundberg</a> {new Date().getFullYear()} - <a href="https://github.com/Edwinexd/sqlite-erd?tab=GPL-3.0-1-ov-file" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">GPL-3.0</a></p>              
            <p><a href="https://github.com/Edwinexd/sqlite-erd/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Report issues</a></p>
            <PrivacyNoticeToggle></PrivacyNoticeToggle>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
