import React, { useRef, useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";

interface SqliteInputProps {
  onUpload: (file: File) => void;
  onError: (error: string) => void;
}

const SqliteInput: React.FC<SqliteInputProps> = ({ onUpload, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const allowedExtensions = [".db", ".sdb", ".sqlite", ".db3", ".s3db", ".sqlite3", ".sl3"];
    for (const file of Array.from(files)) {
      const fileExtension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (allowedExtensions.includes(fileExtension)) {
        onUpload(file);
        return;
      }
    }
    onError("Unsupported file format. Please upload a valid SQLite database file.");
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`relative flex flex-col justify-center items-center min-h-96 border-4 ${
        isDragging
          ? "border-green-500 bg-green-100"
          : "border-dashed border-blue-400 hover:border-blue-500"
      } rounded-lg cursor-pointer`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {/* Central Content */}
      <ArrowUpTrayIcon className="w-24 h-24 text-blue-500 dark:text-blue-300" />
      <p className="text-center text-lg font-mono px-4 text-gray-600 dark:text-gray-400">
        Drag a SQLite3 database file here or click to upload to generate an Entity Relationship Diagram (ERD) for the database.
      </p>

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        accept=".db,.sdb,.sqlite,.db3,.s3db,.sqlite3,.sl3"
        className="hidden"
        aria-label="Upload SQLite database file"
        title="Drag and drop or click to upload SQLite database files. Accepted formats: .db, .sdb, .sqlite, .db3, .s3db, .sqlite3, .sl3"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default SqliteInput;
