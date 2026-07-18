import {
  chownSync,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

function preparePersistentDatabase(): void {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return;
  if (
    typeof process.setgid !== "function" ||
    typeof process.setuid !== "function"
  ) {
    throw new Error("Cannot drop production root privileges on this platform.");
  }

  const databasePath = resolve(
    process.env.NOMAD_DATABASE_PATH ?? ".data/nomad.db",
  );
  const databaseDirectory = dirname(databasePath);
  if (databaseDirectory === "/") {
    throw new Error("Refusing to prepare the filesystem root for SQLite.");
  }

  const nodeIdentity = statSync("/home/node");
  mkdirSync(databaseDirectory, { recursive: true });
  chownSync(databaseDirectory, nodeIdentity.uid, nodeIdentity.gid);
  for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (existsSync(path)) chownSync(path, nodeIdentity.uid, nodeIdentity.gid);
  }

  process.setgid(nodeIdentity.gid);
  process.setuid(nodeIdentity.uid);
  if (process.getuid() === 0) {
    throw new Error("Production startup failed to drop root privileges.");
  }
  console.log(
    "Persistent database directory prepared; continuing as an unprivileged user.",
  );
}

preparePersistentDatabase();
await import("./server.js");
