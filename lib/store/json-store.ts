import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

export async function readCollection<T>(name: string): Promise<T[]> {
  await ensureDataDir();
  const target = filePath(name);
  try {
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.writeFile(target, "[]\n", "utf8");
      return [];
    }
    throw error;
  }
}

export async function writeCollection<T>(name: string, items: T[]) {
  await ensureDataDir();
  const target = filePath(name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(items, null, 2)}\n`;
  await fs.writeFile(temp, payload, "utf8");
  await fs.rename(temp, target);
}

export async function upsertItem<T extends { id: string }>(
  name: string,
  item: T,
): Promise<T> {
  const items = await readCollection<T>(name);
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  await writeCollection(name, items);
  return item;
}

export async function deleteItem(name: string, id: string): Promise<boolean> {
  const items = await readCollection<{ id: string }>(name);
  const next = items.filter((entry) => entry.id !== id);
  if (next.length === items.length) return false;
  await writeCollection(name, next);
  return true;
}

export async function findById<T extends { id: string }>(
  name: string,
  id: string,
): Promise<T | null> {
  const items = await readCollection<T>(name);
  return items.find((entry) => entry.id === id) ?? null;
}
