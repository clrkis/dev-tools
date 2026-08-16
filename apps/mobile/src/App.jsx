import { useEffect, useRef, useState } from "react";

export default function App() {
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  const [input, setInput] = useState("");
  const [lines, setLines] = useState([
    "Welcome to Codex",
    "",
    "Codex coding environment",
    "Project: ~/dev-tools",
    "Status: Ready",
    "",
  ]);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    terminalRef.current?.scrollTo(
      0,
      terminalRef.current.scrollHeight
    );
  }, [lines]);

  function runCommand(event) {
    event.preventDefault();

    const command = input.trim();

    if (!command) return;

    setHistory((old) => [
      ...old,
      command,
    ]);

    setHistoryIndex(-1);

    if (command === "clear") {
      setLines([]);
      setInput("");
      return;
    }

    if (command === "help") {
      setLines((old) => [
        ...old,
        `~/dev-tools $ ${command}`,
        "",
        "Codex Commands:",
        "  help       Hiện trợ giúp",
        "  clear      Xóa màn hình",
        "  status     Trạng thái Codex",
        "  project    Thông tin dự án",
        "  codex      Mở Codex",
        "",
      ]);

      setInput("");
      return;
    }

    if (command === "status") {
      setLines((old) => [
        ...old,
        `~/dev-tools $ ${command}`,
        "",
        "Codex: Ready",
        "Project: ~/dev-tools",
        "Environment: Mobile",
        "Mode: Terminal",
        "",
      ]);

      setInput("");
      return;
    }

    if (command === "project") {
      setLines((old) => [
        ...old,
        `~/dev-tools $ ${command}`,
        "",
        "Project: dev-tools",
        "Path: ~/dev-tools",
        "Frontend: Vite + React",
        "Interface: Codex Terminal",
        "",
      ]);

      setInput("");
      return;
    }

    if (command === "codex") {
      setLines((old) => [
        ...old,
        `~/dev-tools $ ${command}`,
        "",
        "╭─ Codex ─────────────────────╮",
        "│ Coding agent ready          │",
        "│                              │",
        "│ Hãy nhập yêu cầu của bạn.   │",
        "╰──────────────────────────────╯",
        "",
      ]);

      setInput("");
      return;
    }

    setLines((old) => [
      ...old,
      `~/dev-tools $ ${command}`,
      `codex: chưa thực thi lệnh "${command}"`,
      "Gõ 'help' để xem các lệnh.",
      "",
    ]);

    setInput("");
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!history.length) return;

      const next =
        historyIndex === -1
          ? history.length - 1
          : Math.max(0, historyIndex - 1);

      setHistoryIndex(next);
      setInput(history[next]);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (historyIndex === -1) return;

      const next = historyIndex + 1;

      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput("");
        return;
      }

      setHistoryIndex(next);
      setInput(history[next]);
    }

    if (
      event.key === "c" &&
      event.ctrlKey
    ) {
      event.preventDefault();

      setLines((old) => [
        ...old,
        "^C",
        "",
      ]);

      setInput("");
    }
  }

  return (
    <main
      className="terminal"
      onClick={() =>
        inputRef.current?.focus()
      }
    >
      <div
        ref={terminalRef}
        className="terminal-output"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={
              line.startsWith("╭─")
                ? "codex-title"
                : ""
            }
          >
            {line || "\u00A0"}
          </div>
        ))}

        <form
          className="prompt"
          onSubmit={runCommand}
        >
          <span className="prompt-path">
            ~/dev-tools $
          </span>

          <input
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            aria-label="Terminal"
          />
        </form>
      </div>
    </main>
  );
}
