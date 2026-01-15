import { useState } from "react";
import { parseCSV, parseJSON } from "../utils/fileParsing";
import type { TranslationUpload } from "../utils/fileParsing";

export function useFileUpload(onSuccess: () => Promise<void>, onError: (message: string) => void) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFormat, setUploadFormat] = useState<"csv" | "json">("csv");
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async () => {
    if (!uploadFile) {
      onError("Please select a file");
      return;
    }

    setSubmitting(true);
    try {
      const text = await uploadFile.text();
      let translationsToUpload: TranslationUpload[] = [];

      if (uploadFormat === "csv") {
        translationsToUpload = parseCSV(text);
      } else {
        translationsToUpload = parseJSON(text);
      }

      if (translationsToUpload.length === 0) {
        throw new Error("No valid translations found in file");
      }

      const res = await fetch("/api/catalog/set-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translations: translationsToUpload }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to upload translations");
      }

      setUploadFile(null);
      await onSuccess();
      onError(`Successfully imported ${translationsToUpload.length} translation(s)`);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Failed to upload file");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setUploadFile(null);
    setUploadFormat("csv");
  };

  return {
    uploadFile,
    uploadFormat,
    submitting,
    setUploadFile,
    setUploadFormat,
    handleFileUpload,
    reset,
  };
}
