import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

const appPath = "client/src/App.tsx";
let app = read(appPath);

if (!app.includes('import PosShifts from "./pages/pos/PosShifts";')) {
  const anchor = 'import PosCatalog from "./pages/pos/PosCatalog";';
  if (!app.includes(anchor)) throw new Error("App import anchor not found");
  app = app.replace(anchor, `${anchor}\nimport PosShifts from "./pages/pos/PosShifts";`);
}

if (!app.includes('path="/pos/shifts"')) {
  const anchor = '<Route path="/pos/display" element={<PosDisplay />} />';
  if (!app.includes(anchor)) throw new Error("App route anchor not found");
  app = app.replace(anchor, `${anchor}\n                  <Route path="/pos/shifts" element={<ProtectedRoute><PosShifts /></ProtectedRoute>} />`);
}
write(appPath, app);
console.log("updated client/src/App.tsx");

const serverPath = "server/index.ts";
let server = read(serverPath);

if (!server.includes('import posShiftsRouter from "./routes/posShifts";')) {
  const anchor = 'import posRouter from "./routes/pos";';
  if (!server.includes(anchor)) throw new Error("Server import anchor not found");
  server = server.replace(anchor, `${anchor}\nimport posShiftsRouter from "./routes/posShifts";`);
}

if (!server.includes('app.use("/api/pos-shifts", posShiftsRouter);')) {
  const anchor = 'app.use("/api/pos", posRouter);';
  if (!server.includes(anchor)) throw new Error("Server route anchor not found");
  server = server.replace(anchor, `${anchor}\n  app.use("/api/pos-shifts", posShiftsRouter);`);
}
write(serverPath, server);
console.log("updated server/index.ts");

console.log("POS shifts route v2 installed safely");
