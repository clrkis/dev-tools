import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "http://127.0.0.1:8787";

const tabs = [
  ["agent", "agent + shell"],
  ["code", "code"],
  ["review", "nhật ký / review"],
];

function App() {
  const [tab, setTab] = useState("agent");
  const [prompt, setPrompt] = useState("");
  const [shell, setShell] = useState("");
  const [messages, setMessages] = useState([]);
  const [output, setOutput] = useState([]);
  const [logs, setLogs] = useState([]);
  const [files, setFiles] = useState([]);
  const [code, setCode] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [status, setStatus] = useState("sẵn sàng");
  const [busy, setBusy] = useState(false);

  const [review, setReview] = useState({
    build: null,
    test: null,
    review: null,
    pr: null,
    prReason: "",
    changedFiles: 0,
  });

  const [gitAction, setGitAction] = useState("");
  const [gitResult, setGitResult] = useState("");

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, options);

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("agent trả về dữ liệu không hợp lệ");
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "lỗi máy chủ");
    }

    return data;
  }

  async function load() {
    try {
      const health = await api("/api/health");

      if (health.ok) {
        setStatus("sẵn sàng");
      }

      try {
        const data = await api("/api/files");

        if (Array.isArray(data)) {
          setFiles(data);
        }
      } catch {}

      try {
        const data = await api("/api/review/status");

        if (data) {
          setReview(old => ({
            ...old,
            ...data,
          }));
        }
      } catch {}

    } catch {
      setStatus("agent chưa chạy");
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(load, 3000);

    return () => clearInterval(timer);
  }, []);

  function textFromMessage(message) {
    if (!message) return "";

    if (typeof message === "string") {
      return message;
    }

    if (message.parts) {
      return message.parts
        .filter(part => part.type === "text")
        .map(part => part.text)
        .join("\n");
    }

    return message.text || "";
  }

  async function sendAgent() {
    const text = prompt.trim();

    if (!text || busy) return;

    setBusy(true);
    setStatus("agent thinking...");

    setMessages(old => [
      ...old,
      {
        role: "user",
        text,
      },
    ]);

    setLogs(old => [
      ...old,
      `agent: ${text}`,
    ]);

    try {
      const data = await api("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: text,
        }),
      });

      if (data.message) {
        setMessages(old => [
          ...old,
          data.message,
        ]);
      }

      if (data.reply) {
        setMessages(old => [
          ...old,
          {
            role: "agent",
            text: data.reply,
          },
        ]);
      }

      if (data.result) {
        setMessages(old => [
          ...old,
          {
            role: "agent",
            text:
              typeof data.result === "string"
                ? data.result
                : JSON.stringify(data.result, null, 2),
          },
        ]);
      }

      if (data.review) {
        setReview(old => ({
          ...old,
          ...data.review,
        }));
      }

      setPrompt("");
      setStatus("hoàn tất");

      setLogs(old => [
        ...old,
        "agent: hoàn tất",
      ]);

    } catch (error) {
      setStatus("lỗi");

      setMessages(old => [
        ...old,
        {
          role: "error",
          text: `lỗi: ${error.message}`,
        },
      ]);

      setLogs(old => [
        ...old,
        `lỗi agent: ${error.message}`,
      ]);
    } finally {
      setBusy(false);
      load();
    }
  }

  async function runShell() {
    const command = shell.trim();

    if (!command || busy) return;

    setBusy(true);
    setStatus("đang thực thi");

    setOutput(old => [
      ...old,
      `$ ${command}`,
    ]);

    try {
      const data = await api("/api/shell", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          command,
        }),
      });

      setOutput(old => [
        ...old,
        typeof data.result === "string"
          ? data.result
          : JSON.stringify(data.result, null, 2),
      ]);

      setLogs(old => [
        ...old,
        `shell: ${command}`,
      ]);

      setShell("");
      setStatus("shell hoàn tất");

    } catch (error) {
      setOutput(old => [
        ...old,
        `error: ${error.message}`,
      ]);

      setStatus("shell lỗi");

    } finally {
      setBusy(false);
    }
  }

  async function githubPush() {
    if (gitAction) return;

    setGitAction("push");
    setGitResult("");
    setStatus("đang bash code lên github");

    try {
      const data = await api("/api/git/push", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "update from dev tools",
        }),
      });

      setGitResult(
        data.message ||
        "đã bash code lên github"
      );

      setLogs(old => [
        ...old,
        "github: push thành công",
      ]);

      setStatus("github đã cập nhật");
      await load();

    } catch (error) {
      setGitResult(
        `push thất bại: ${error.message}`
      );

      setLogs(old => [
        ...old,
        `github push lỗi: ${error.message}`,
      ]);

      setStatus("push lỗi");

    } finally {
      setGitAction("");
    }
  }

  async function createNewPR() {
    if (gitAction) return;

    setGitAction("pr");
    setGitResult("");
    setStatus("đang tạo pr mới");

    try {
      const data = await api("/api/git/pr", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "update from dev tools",
        }),
      });

      setGitResult(
        data.url ||
        data.message ||
        "đã tạo pr mới"
      );

      setLogs(old => [
        ...old,
        "github: đã tạo pr mới",
      ]);

      setStatus("pr đã tạo");

      await load();

    } catch (error) {
      setGitResult(
        `tạo pr thất bại: ${error.message}`
      );

      setLogs(old => [
        ...old,
        `pr lỗi: ${error.message}`,
      ]);

      setStatus("pr lỗi");

    } finally {
      setGitAction("");
    }
  }

  async function bashCurrent() {
    if (gitAction) return;

    setGitAction("bash");
    setGitResult("");
    setStatus("đang bash");

    try {
      const data = await api("/api/git/bash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "update from dev tools",
        }),
      });

      setGitResult(
        data.message ||
        "đã thực hiện bash"
      );

      setLogs(old => [
        ...old,
        "github: bash hoàn tất",
      ]);

      setStatus("bash hoàn tất");

      await load();

    } catch (error) {
      setGitResult(
        `bash thất bại: ${error.message}`
      );

      setLogs(old => [
        ...old,
        `bash lỗi: ${error.message}`,
      ]);

      setStatus("bash lỗi");

    } finally {
      setGitAction("");
    }
  }

  function openFile(file) {
    const name =
      file?.path ||
      file?.name ||
      "";

    if (!name) return;

    setSelectedFile(name);

    setCode(
      `// ${name}\n\n// đang mở file...`
    );

    setTab("code");
  }

  function resultIcon(value) {
    if (value === true) return "✓";
    if (value === false) return "✗";
    return "—";
  }

  function renderAgent() {
    return (
      <div className="view">

        <div className="view-header">
          <div>
            <strong>agent + shell</strong>
            <span>
              coding agent / terminal
            </span>
          </div>

          <span className="state">
            {status}
          </span>
        </div>

        <div className="agent-body">

          <div className="messages">

            {messages.length === 0 && (
              <div className="welcome">

                <div className="welcome-title">
                  coding agent
                </div>

                <p>
                  ví dụ:
                </p>

                <div className="example">
                  build file README.md dùm tao
                </div>

                <p>
                  agent sẽ đọc project, sửa code,
                  build, test và review.
                </p>

              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "message user"
                    : message.role === "error"
                    ? "message error"
                    : "message agent"
                }
              >

                <div className="message-role">
                  {message.role === "user"
                    ? "bạn"
                    : message.role === "error"
                    ? "lỗi"
                    : "agent"}
                </div>

                <div className="message-text">
                  {textFromMessage(message)}
                </div>

              </div>
            ))}

            {busy && (
              <div className="thinking">

                <div>
                  agent thinking...
                </div>

                <div className="activity-icons">
                  <span>📝</span>
                  <span>⏺️</span>
                  <span>💱</span>
                  <span>🔂</span>
                  <span>🔁</span>
                  <span>⛓️</span>
                  <span>🔌</span>
                </div>

                <div className="thinking-line">
                  đang xử lý project...
                </div>

              </div>
            )}

          </div>

          <div className="shell-panel">

            <div className="shell-title">
              shell thực thi
            </div>

            <div className="shell-output">

              {output.map((line, index) => (
                <pre key={index}>{line}</pre>
              ))}

            </div>

            <form
              className="shell-form"
              onSubmit={event => {
                event.preventDefault();
                runShell();
              }}
            >

              <span>
                ~/dev-tools $
              </span>

              <input
                value={shell}
                onChange={event =>
                  setShell(event.target.value)
                }
                placeholder="nhập lệnh..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />

              <button type="submit">
                chạy
              </button>

            </form>

          </div>

        </div>

        <div className="agent-composer">

          <textarea
            value={prompt}
            onChange={event =>
              setPrompt(event.target.value)
            }
            placeholder="build file README.md dùm tao..."
            disabled={busy}
          />

          <div className="composer-actions">

            <span>
              agent có thể đọc / sửa / build / test / review
            </span>

            <button
              onClick={sendAgent}
              disabled={busy}
            >
              {busy ? "đang làm..." : "gửi"}
            </button>

          </div>

        </div>

      </div>
    );
  }

  function renderCode() {
    return (
      <div className="view">

        <div className="view-header">

          <div>
            <strong>code</strong>
            <span>
              {selectedFile || "chưa chọn file"}
            </span>
          </div>

          <div className="header-buttons">
            <button>lưu</button>
            <button>hoàn tác</button>
          </div>

        </div>

        <div className="code-layout">

          <aside className="files">

            <div className="files-title">
              tệp project
            </div>

            {files.length === 0 && (
              <div className="empty">
                chưa có file
              </div>
            )}

            {files.map((file, index) => {

              const name =
                file?.path ||
                file?.name ||
                "";

              return (
                <button
                  key={index}
                  className={
                    selectedFile === name
                      ? "file active"
                      : "file"
                  }
                  onClick={() =>
                    openFile(file)
                  }
                >
                  {name}
                </button>
              );
            })}

          </aside>

          <textarea
            className="editor"
            value={code}
            onChange={event =>
              setCode(event.target.value)
            }
            spellCheck="false"
          />

        </div>

      </div>
    );
  }

  function renderReview() {
    const prReady =
      review.build === true &&
      review.test === true &&
      review.review === true;

    const prFailed =
      review.pr === false;

    return (
      <div className="view">

        <div className="view-header">

          <div>
            <strong>
              nhật ký / review
            </strong>

            <span>
              build / test / git / pull request
            </span>
          </div>

          <button
            onClick={() => setLogs([])}
          >
            xóa nhật ký
          </button>

        </div>

        <div className="review-page">

          <section className="review-card">

            <h2>
              kết quả kiểm tra
            </h2>

            <div className="checks">

              <div>
                <span>build</span>
                <b className={
                  review.build === true
                    ? "ok"
                    : review.build === false
                    ? "bad"
                    : ""
                }>
                  {resultIcon(review.build)}
                </b>
              </div>

              <div>
                <span>test</span>
                <b className={
                  review.test === true
                    ? "ok"
                    : review.test === false
                    ? "bad"
                    : ""
                }>
                  {resultIcon(review.test)}
                </b>
              </div>

              <div>
                <span>review</span>
                <b className={
                  review.review === true
                    ? "ok"
                    : review.review === false
                    ? "bad"
                    : ""
                }>
                  {resultIcon(review.review)}
                </b>
              </div>

              <div>
                <span>pr</span>
                <b className={
                  review.pr === true
                    ? "ok"
                    : review.pr === false
                    ? "bad"
                    : ""
                }>
                  {resultIcon(review.pr)}
                </b>
              </div>

            </div>

            {review.changedFiles > 0 && (
              <div className="changed">
                thay đổi: {review.changedFiles} file
              </div>
            )}

            {review.prReason && (
              <div className="reason">
                {review.prReason}
              </div>
            )}

          </section>

          <section className="github-card">

            <h2>
              github
            </h2>

            <div className="github-actions">

              <button
                className="primary"
                onClick={githubPush}
                disabled={!!gitAction}
              >
                {gitAction === "push"
                  ? "đang bash..."
                  : "bash code lên github"}
              </button>

              <button
                onClick={bashCurrent}
                disabled={!!gitAction}
              >
                {gitAction === "bash"
                  ? "đang bash..."
                  : "bash"}
              </button>

              {prFailed && (
                <button
                  className="new-pr"
                  onClick={createNewPR}
                  disabled={!!gitAction}
                >
                  {gitAction === "pr"
                    ? "đang tạo..."
                    : "tạo pr mới"}
                </button>
              )}

            </div>

            {gitResult && (
              <div className="git-result">
                {gitResult}
              </div>
            )}

          </section>

          <section className="suggestions">

            <h2>
              gợi ý phát triển tiếp
            </h2>

            <div className="suggestion-grid">

              <button
                onClick={() =>
                  setPrompt(
                    "thêm cấu hình .env và kiểm tra biến môi trường"
                  )
                }
              >
                thêm .env
              </button>

              <button
                onClick={() =>
                  setPrompt(
                    "review toàn bộ api và bổ sung tài liệu api"
                  )
                }
              >
                tài liệu api
              </button>

              <button
                onClick={() =>
                  setPrompt(
                    "thêm github actions để build và test tự động"
                  )
                }
              >
                github actions
              </button>

              <button
                onClick={() =>
                  setPrompt(
                    "kiểm tra project và thêm test tự động"
                  )
                }
              >
                test tự động
              </button>

              <button
                onClick={() =>
                  setPrompt(
                    "kiểm tra project và đề xuất cách deploy"
                  )
                }
              >
                deploy
              </button>

              <button
                onClick={() =>
                  setPrompt(
                    "review toàn bộ project và tìm lỗi còn lại"
                  )
                }
              >
                review toàn bộ
              </button>

            </div>

          </section>

          <section className="log-card">

            <h2>
              nhật ký
            </h2>

            <div className="logs">

              {logs.length === 0 && (
                <div className="empty">
                  chưa có nhật ký
                </div>
              )}

              {logs.map((log, index) => (
                <div
                  className="log"
                  key={index}
                >
                  <span>
                    {String(index + 1).padStart(3, "0")}
                  </span>

                  <div>{log}</div>
                </div>
              ))}

            </div>

          </section>

        </div>

      </div>
    );
  }

  return (
    <main className="app">

      <header className="topbar">

        <div className="brand">
          <strong>dev tools</strong>
          <span>coding workspace</span>
        </div>

        <nav className="tabs">

          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={
                tab === id
                  ? "tab active"
                  : "tab"
              }
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}

        </nav>

        <div className="connection">
          ● {status}
        </div>

      </header>

      <main className="main">

        {tab === "agent" && renderAgent()}
        {tab === "code" && renderCode()}
        {tab === "review" && renderReview()}

      </main>

      <footer className="statusbar">

        <span>
          ~/dev-tools
        </span>

        <span>
          agent
        </span>

        <span>
          {busy
            ? "đang xử lý"
            : "sẵn sàng"}
        </span>

        <span>
          1280 × 800
        </span>

      </footer>

    </main>
  );
}

createRoot(
  document.getElementById("root")
).render(
  <App />
);
