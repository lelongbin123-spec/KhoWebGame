const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
  ".bin": "application/octet-stream"
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  if (filePath === root) filePath = path.join(root, "index.html");

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.setHeader("Content-Type", contentTypes[path.extname(filePath)] || "application/octet-stream");
    response.end(content);
  });
}).listen(8000, "127.0.0.1", () => {
  console.log("Serving app at http://localhost:8000/");
});