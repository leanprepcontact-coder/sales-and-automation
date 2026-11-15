// Imports an existing list (e.g. the masterclass Google Form export) as contacts.
// Usage: npm run import -- path/to/list.csv --source masterclass_list
// Columns are matched loosely: name, email, phone (also "mobile", "whatsapp", "phone number").
// Imported contacts get NO WhatsApp consent: Meta requires an explicit opt-in.
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { db, closeDb } from "../src/db.js";
import { upsertContact } from "../src/contacts.js";

const file = process.argv[2];
const srcIdx = process.argv.indexOf("--source");
const source = srcIdx > 0 ? process.argv[srcIdx + 1] : "import";
if (!file) throw new Error("Usage: npm run import -- <file.csv> --source <name>");

const rows = parse(readFileSync(file), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
const pick = (r: Record<string, string>, keys: string[]) => {
  for (const [k, v] of Object.entries(r)) if (keys.some((x) => k.toLowerCase().includes(x)) && v) return v;
  return undefined;
};

let ok = 0;
let skipped = 0;
for (const r of rows) {
  try {
    await upsertContact(db(), {
      name: pick(r, ["name"]),
      email: pick(r, ["email", "e-mail"]),
      phone: pick(r, ["phone", "mobile", "whatsapp", "contact"]),
      source,
    });
    ok++;
  } catch {
    skipped++;
  }
}
console.log(`imported ${ok}, skipped ${skipped} (no valid email or phone)`);
await closeDb();
