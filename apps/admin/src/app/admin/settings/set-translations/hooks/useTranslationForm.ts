import { useState } from "react";
import type { SetTranslation } from "../types";
import { toTitleCase } from "../utils/textUtils";

export function useTranslationForm(
  onSuccess: () => Promise<void>,
  onError: (message: string) => void
) {
  const [editingTranslation, setEditingTranslation] = useState<SetTranslation | null>(null);
  const [setId, setSetId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [source, setSource] = useState("manual");
  const [sourceLanguage, setSourceLanguage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEditingTranslation(null);
    setSetId("");
    setNameEn("");
    setSource("manual");
    setSourceLanguage("");
  };

  const startEdit = (translation: SetTranslation) => {
    setEditingTranslation(translation);
    setSetId(translation.set_id);
    setNameEn(translation.name_en);
    setSource(translation.source);
    setSourceLanguage(translation.source_language || "");
  };

  const handleSave = async () => {
    if (!setId.trim() || !nameEn.trim()) {
      onError("Please fill in both Set ID and English Name");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/catalog/set-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translations: [
            {
              set_id: setId.trim(),
              name_en: toTitleCase(nameEn.trim()),
              source: source,
              source_language: sourceLanguage.trim() || null,
            },
          ],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error ||
            (editingTranslation ? "Failed to update translation" : "Failed to save translation")
        );
      }

      resetForm();
      await onSuccess();
    } catch (e: unknown) {
      onError(
        e instanceof Error
          ? e.message
          : editingTranslation
            ? "Failed to update translation"
            : "Failed to save translation"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (setIdToDelete: string, onSuccessCallback: () => Promise<void>) => {
    if (!confirm(`Delete translation for set "${setIdToDelete}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/catalog/set-translations/${encodeURIComponent(setIdToDelete)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete translation");
      }

      await onSuccessCallback();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Failed to delete translation");
    }
  };

  return {
    editingTranslation,
    setId,
    nameEn,
    source,
    sourceLanguage,
    submitting,
    setSetId,
    setNameEn,
    setSource,
    setSourceLanguage,
    resetForm,
    startEdit,
    handleSave,
    handleDelete,
  };
}
