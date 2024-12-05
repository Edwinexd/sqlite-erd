import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import React from "react";

interface SqliteInputProps {
  onUpload: (file: File) => void;
}

/*

  const importData = useCallback(() => {
    // Confirm that the user wants to import data, it will overwrite the current data
    if (!window.confirm("Are you sure you want to import data?\n\nNote: This will overwrite your current data.")) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".sql";
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        return;
      }
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target || typeof e.target.result !== "string") {
          return;
        }
        const data = e.target.result;
        if (!data) {
          return;
        }
        upsertData(data);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [upsertData]);*/ // from validator
const SqliteInput: React.FC<SqliteInputProps> = ({ onUpload }) => {
  onUpload(new File([""], "sqlite.db3", { type: "application/x-sqlite3" }));

  return (
    <div>
      <ArrowUpTrayIcon className="w-6 h-6 m-auto" />
     
    </div>
  );
};

export default SqliteInput;
