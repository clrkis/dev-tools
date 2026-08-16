import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

const PORT = 8787;
const OPENCODE = process.env.OPENCODE_URL || "http://127.0.0.1:4096";

let sessionId = null;

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function opencode(url, options = {}) {
  const response = await fetch(`${OPENCODE}${url}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : JSON.stringify(data)
    );
  }

  return data;
}

async function getSession() {
  if (sessionId) {
    return sessionId;
  }

  const sessions = await opencode("/session");

  if (Array.isArray(sessions) && sessions.length) {
    sessionId = sessions[0].id;
    return sessionId;
  }

  const session = await opencode("/session", {
    method: "POST",
    body: JSON.stringify({
      title: "dev tools"
    })
  });

  sessionId = session.id;

  return sessionId;
}

async function command(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      const health = await opencode("/global/health");

      return json(res, 200, {
        ok: true,
        opencode: health
      });
    }

    if (req.method === "GET" && pathname === "/api/providers") {
      const providers = await opencode("/provider");

      return json(res, 200, providers);
    }

    if (req.method === "GET" && pathname === "/api/files") {
      const files = await opencode("/file");

      return json(res, 200, files);
    }

    if (req.method === "GET" && pathname === "/api/status") {
      const status = await opencode("/session/status");

      return json(res, 200, status);
    }

    if (req.method === "GET" && pathname === "/api/diff") {
      const id = await getSession();
      const diff = await opencode(`/session/${id}/diff`);

      return json(res, 200, diff);
    }

    if (req.method === "GET" && pathname === "/api/messages") {
      const id = await getSession();
      const messages = await opencode(`/session/${id}/message`);

      return json(res, 200, messages);
    }

    if (req.method === "POST" && pathname === "/api/session") {
      const session = await opencode("/session", {
        method: "POST",
        body: JSON.stringify({
          title: "dev tools"
        })
      });

      sessionId = session.id;

      return json(res, 200, session);
    }

    if (req.method === "POST" && pathname === "/api/chat") {
      const data = await body(req);
      const prompt = String(data.prompt || "").trim();

      if (!prompt) {
        return json(res, 400, {
          ok: false,
          error: "chưa có yêu cầu"
        });
      }

      const id = await getSession();

      const result = await opencode(
        `/session/${id}/message`,
        {
          method: "POST",
          body: JSON.stringify({
            parts: [
              {
                type: "text",
                text: prompt
              }
            ]
          })
        }
      );

      return json(res, 200, {
        ok: true,
        result
      });
    }

    if (req.method === "POST" && pathname === "/api/shell") {
      const data = await body(req);
      const command = String(data.command || "").trim();

      if (!command) {
        return json(res, 400, {
          ok: false,
          error: "chưa có lệnh"
        });
      }

      const id = await getSession();

      const result = await opencode(
        `/session/${id}/shell`,
        {
          method: "POST",
          body: JSON.stringify({
            command
          })
        }
      );

      return json(res, 200, {
        ok: true,
        result
      });
    }

    if (req.method === "POST" && pathname === "/api/abort") {
      const id = await getSession();

      const result = await opencode(
        `/session/${id}/abort`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      return json(res, 200, {
        ok: true,
        result
      });
    }

    return json(res, 404, {
      ok: false,
      error: "không tìm thấy"
    });

  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host}`
  );

  await command(
    req,
    res,
    url.pathname
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`dev-tools server: http://127.0.0.1:${PORT}`);
});
