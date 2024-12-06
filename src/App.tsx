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
import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

import ExportRenderer from "./ExportRenderer";

import initSqlJs from "sql.js";

// import { format as formatFns } from "date-fns";
// import { toPng } from "html-to-image";
import PrivacyNoticeToggle from "./PrivacyNoticeToggle";
import ThemeToggle from "./ThemeToggle";
import useTheme from "./useTheme";
import { executorToLayout } from "./utils";
// import { sqliteInfoToIntermediate } from "./utils";

function App() {
  const [engine, setEngine] = useState<initSqlJs.SqlJsStatic>();
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [referentialIntegrityOk, setReferentialIntegrityOk] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [erdImage, setErdImage] = useState<ReactNode>();

  const { getTheme, setTheme, isDarkMode } = useTheme();

  // Exporting functionality / flags
  const [exportingStatus, setExportingStatus] = useState<number>(0);
  const exportRendererRef = useRef<HTMLDivElement>(null);

  const initSQLEngine = useCallback(async () => {
    const SQL = await initSqlJs(
      {
        locateFile: (file) => `/dist/sql.js/${file}`,
      }
    );

    setEngine(SQL);
  }, []);

  useEffect(() => {
    initSQLEngine();
  }, [initSQLEngine]);

  // TODO: Error handling, nothing stops the user from throwing something random at it
  const loadDatabase = useCallback((file: File) => {
    if (!engine) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as ArrayBuffer;
      const db = new engine.Database(new Uint8Array(data));
      setReferentialIntegrityOk(undefined);
      setDatabase(db);
    };
    reader.readAsArrayBuffer(file);
  }, [engine]);

  // Validating Referencial Integrity
  useEffect(() => {
    if (!database) {
      return;
    }

    const res = database.exec("PRAGMA foreign_key_check;");
    setReferentialIntegrityOk(res.length === 0);
    if (res.length !== 0) {
      setError("Referential integrity is not ok!");
      return;
    }
    database.exec("PRAGMA foreign_keys = ON;");

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
    // layout.consoleLog();
    console.log(layout.getDBML());
  }, [database]);



  // TODO: Maybe override default behavior for ctrl+s to save generated image
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
  //       e.preventDefault();
  //       exportData();
  //     }
  //   };
  //   document.addEventListener("keydown", handleKeyDown);
  //   return () => document.removeEventListener("keydown", handleKeyDown);
  // }, [exportData]);

  // Png exports
  // const exportImageQuery = useCallback(() => {
  //   setExportQuestion(question);
  // }, [exportView, loadedQuestionCorrect, question]);

  // useEffect(() => {
  //   if (!exportRendererRef.current || exportingStatus >= 1) {
  //     return;
  //   }

  //   // TODO: I'm not really a fan of this solution but without it the browser crashes due to downloading an extreme amount of files
  //   setExportingStatus(1);

  //   const exportRenderer = exportRendererRef.current;
  //   toPng(exportRenderer, { 
  //     canvasWidth: exportRenderer.clientWidth,
  //     width: exportRenderer.clientWidth,
  //     canvasHeight: exportRenderer.clientHeight,
  //     height: exportRenderer.clientHeight,
  //     pixelRatio: 1 
  //   }).then((dataUrl) => {
  //     const link = document.createElement("a");
  //     link.download = `validator_${question.id}_${question.category.display_number}${question.display_sequence}.png`;
  //     link.href = dataUrl;
  //     link.click();
  //     setExportQuestion(undefined);
  //     setExportQuery(undefined);
  //     setExportingStatus(0);
  //   }
  //   );
  // }, [evaluatedQuery, exportQuery, exportRendererRef, getTheme, isDarkMode, exportingStatus, question, resetResult, setTheme, exportQuestion, exportView]);

  return (
    <div className="App">
      {erdImage && <ExportRenderer ref={exportRendererRef} erd={erdImage} />}
      <header className="App-header">
        <div className="my-2"></div>
        <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode}></ThemeToggle>
        <h1 className="text-6xl font-semibold my-3">SQLite ERD</h1>
        {/* <img src={isDarkMode() ? db_scheme_dark : db_scheme_light} className="DB-Layout" alt="Database Layout" /> */}
        {error && <p className="font-mono text-red-500 max-w-4xl break-all">{error}</p>}
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded my-3" onClick={() => {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".sqlite";
          fileInput.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              loadDatabase(files[0]);
            }
          };
          fileInput.click();
        }}>Load Database</button>
        
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
