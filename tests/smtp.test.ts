import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { buildLeadNotification, sendSmtpMessage } from "../lib/smtp.ts";

test("lead notification keeps headers safe and leaves missing company explicit", () => {
  const notification = buildLeadNotification({
    siteId: "demo\r\nBcc: leaked@example.test",
    name: "张三",
    email: "buyer@example.test",
    message: ".first line\n第二行",
  });
  assert.equal(notification.subject.includes("\n"), false);
  assert.match(notification.text, /公司：待补充/);
  assert.match(notification.text, /^\.first line$/m);
});

test("SMTP delivery completes the local server handshake", async () => {
  const received: string[] = [];
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 local.test\r\n");
    let data = "";
    let inData = false;
    socket.on("data", (chunk) => {
      data += chunk;
      while (data.includes("\r\n")) {
        const index = data.indexOf("\r\n");
        const line = data.slice(0, index);
        data = data.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 queued\r\n");
          } else {
            received.push(line);
          }
          continue;
        }
        if (/^EHLO /.test(line)) socket.write("250-local.test\r\n250 OK\r\n");
        else if (/^MAIL FROM:/.test(line) || /^RCPT TO:/.test(line)) socket.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 send\r\n");
        } else if (line === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const result = await sendSmtpMessage({
      host: "127.0.0.1",
      port: address.port,
      from: "no-reply@sitecraft.local",
      to: "owner@example.test",
    }, "Test", ".first line\nsecond line");
    assert.deepEqual(result, { status: "sent", provider: "smtp" });
    assert.ok(received.includes("..first line"), "dot-stuffed line must remain a separate SMTP line");
    assert.ok(received.includes("second line"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("SMTP delivery stays stored-only when no recipient is configured", async () => {
  const result = await sendSmtpMessage({ host: "", port: 1025, from: "", to: "" }, "Test", "body");
  assert.deepEqual(result, { status: "unconfigured", provider: "none" });
});
