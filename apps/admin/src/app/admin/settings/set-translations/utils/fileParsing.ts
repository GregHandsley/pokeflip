export type TranslationUpload = {
  set_id: string;
  name_en: string;
  source?: string;
};

export function parseCSV(text: string): TranslationUpload[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const setIdIndex = headers.indexOf("set_id");
  const nameEnIndex = headers.indexOf("name_en");
  const sourceIndex = headers.indexOf("source");

  if (setIdIndex === -1 || nameEnIndex === -1) {
    throw new Error("CSV must have 'set_id' and 'name_en' columns");
  }

  const translations: TranslationUpload[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values[setIdIndex] && values[nameEnIndex]) {
      translations.push({
        set_id: values[setIdIndex],
        name_en: values[nameEnIndex],
        source: sourceIndex >= 0 ? values[sourceIndex] || "manual" : "manual",
      });
    }
  }

  return translations;
}

export function parseJSON(text: string): TranslationUpload[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON must be an array of translation objects");
  }
  return parsed.map((item) => ({
    set_id: item.set_id || item.setId,
    name_en: item.name_en || item.nameEn || item.name,
    source: item.source || "manual",
  }));
}
