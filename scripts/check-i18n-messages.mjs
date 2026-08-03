import {readFile} from "node:fs/promises";

const files = ["messages/en.json", "messages/zh-CN.json"];

function leafKeys(value, prefix = "") {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid message value at ${prefix || "<root>"}`);
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

const catalogues = await Promise.all(
  files.map(async (file) => JSON.parse(await readFile(file, "utf8")))
);
const baseline = new Set(leafKeys(catalogues[0]));

for (let index = 1; index < catalogues.length; index += 1) {
  const current = new Set(leafKeys(catalogues[index]));
  const missing = [...baseline].filter((key) => !current.has(key));
  const extra = [...current].filter((key) => !baseline.has(key));
  if (missing.length || extra.length) {
    throw new Error(
      `${files[index]} key mismatch\nMissing: ${missing.join(", ") || "none"}\nExtra: ${extra.join(", ") || "none"}`
    );
  }
}

console.log(`i18n catalogues match (${baseline.size} messages).`);
