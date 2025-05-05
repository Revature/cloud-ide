"use client";

import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { shell } from "@codemirror/legacy-modes/mode/shell"; // Shell language for syntax highlighting
import { StreamLanguage } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { useTheme } from "@/context/ThemeContext"; // Import the ThemeContext hook

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void; // Optional for read-only mode
  readOnly?: boolean; // New prop to control editability
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, readOnly = false }) => {
  const { theme } = useTheme(); // Get the current theme from ThemeContext

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (onChange) onChange(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div>
      <CodeMirror
        value={value}
        height="300px"
        extensions={[
          StreamLanguage.define(shell), // Shell syntax highlighting
          history(), // Undo/redo history
          highlightSelectionMatches(), // Highlight search matches
          autocompletion(), // Autocomplete support
          keymap.of([
            ...defaultKeymap, // Default key bindings
            ...historyKeymap, // Key bindings for undo/redo
            ...searchKeymap, // Key bindings for search
            ...lintKeymap, // Key bindings for linting
          ]),
        ]}
        theme={theme === "dark" ? githubDark : githubLight} // Dynamically apply theme
        editable={!readOnly} // Disable editing if readOnly is true
        onChange={(value) => {
          if (!readOnly && onChange) onChange(value);
        }}
        className="border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900"
      />
      {!readOnly && (
        <div className="mt-2">
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload a Script File
          </label>
          <input
            id="fileUpload"
            type="file"
            accept=".sh,.txt" // Restrict file types to shell scripts and text files
            onChange={handleFileUpload}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 dark:file:bg-gray-800 dark:file:text-gray-300 dark:hover:file:bg-gray-700"
          />
        </div>
      )}
    </div>
  );
};

export default CodeEditor;