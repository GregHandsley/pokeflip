"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";
import PageHeader from "@/components/ui/PageHeader";
import { SUPPORTED_LANGUAGES, getLanguageNameEn } from "@/lib/tcgdx/constants";

// Helper function to convert text to title case
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Handle special cases like "ex", "v", "vmax", etc.
      if (word === 'ex' || word === 'v' || word === 'vmax' || word === 'vstar' || word === 'gx') {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

type SetTranslation = {
  set_id: string;
  name_en: string;
  source: string;
  source_language: string | null;
  created_at: string;
  updated_at: string;
};

export default function SetTranslationsPage() {
  const [translations, setTranslations] = useState<SetTranslation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Add/Edit form
  const [editingTranslation, setEditingTranslation] = useState<SetTranslation | null>(null);
  const [setId, setSetId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [source, setSource] = useState("manual");
  const [sourceLanguage, setSourceLanguage] = useState<string>("");
  
  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFormat, setUploadFormat] = useState<"csv" | "json">("csv");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [enabledLocales, setEnabledLocales] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTranslations();
  }, []);

  const loadTranslations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalog/set-translations");
      const json = await res.json();
      if (json.ok) {
        // Use translationsList if available (full objects), otherwise convert map
        if (json.translationsList && Array.isArray(json.translationsList)) {
          setTranslations(json.translationsList as SetTranslation[]);
        } else {
          // Fallback: convert translations map to array
          const translationsArray: SetTranslation[] = Object.entries(json.translations || {}).map(([set_id, name_en]) => ({
            set_id,
            name_en: name_en as string,
            source: "manual",
            created_at: "",
            updated_at: "",
          }));
          setTranslations(translationsArray);
        }
      }
    } catch (e) {
      console.error("Failed to load translations:", e);
      setErrorModal({ isOpen: true, message: "Failed to load translations" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!setId.trim() || !nameEn.trim()) {
      setErrorModal({ isOpen: true, message: "Please fill in both Set ID and English Name" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/catalog/set-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translations: [{
            set_id: setId.trim(),
            name_en: toTitleCase(nameEn.trim()),
            source: source,
            source_language: sourceLanguage.trim() || null,
          }],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save translation");
      }

      setShowAddModal(false);
      setSetId("");
      setNameEn("");
      setSource("manual");
      await loadTranslations();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to save translation" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (translation: SetTranslation) => {
    setEditingTranslation(translation);
    setSetId(translation.set_id);
    setNameEn(translation.name_en);
    setSource(translation.source);
    setSourceLanguage(translation.source_language || "");
    setShowAddModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTranslation || !setId.trim() || !nameEn.trim()) {
      setErrorModal({ isOpen: true, message: "Please fill in both Set ID and English Name" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/catalog/set-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translations: [{
            set_id: setId.trim(),
            name_en: toTitleCase(nameEn.trim()),
            source: source,
            source_language: sourceLanguage.trim() || null,
          }],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update translation");
      }

      setShowAddModal(false);
      setEditingTranslation(null);
      setSetId("");
      setNameEn("");
      setSource("manual");
      setSourceLanguage("");
      await loadTranslations();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to update translation" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setErrorModal({ isOpen: true, message: "Please select a file" });
      return;
    }

    setSubmitting(true);
    try {
      const text = await uploadFile.text();
      let translationsToUpload: Array<{ set_id: string; name_en: string; source?: string }> = [];

      if (uploadFormat === "csv") {
        // Parse CSV: set_id,name_en or set_id,name_en,source
        const lines = text.split("\n").filter((line) => line.trim());
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const setIdIndex = headers.indexOf("set_id");
        const nameEnIndex = headers.indexOf("name_en");
        const sourceIndex = headers.indexOf("source");

        if (setIdIndex === -1 || nameEnIndex === -1) {
          throw new Error("CSV must have 'set_id' and 'name_en' columns");
        }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());
          if (values[setIdIndex] && values[nameEnIndex]) {
            translationsToUpload.push({
              set_id: values[setIdIndex],
              name_en: values[nameEnIndex],
              source: sourceIndex >= 0 ? values[sourceIndex] || "manual" : "manual",
            });
          }
        }
      } else {
        // Parse JSON: array of { set_id, name_en, source? }
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON must be an array of translation objects");
        }
        translationsToUpload = parsed.map((item) => ({
          set_id: item.set_id || item.setId,
          name_en: item.name_en || item.nameEn || item.name,
          source: item.source || "manual",
        }));
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

      setShowUploadModal(false);
      setUploadFile(null);
      await loadTranslations();
      setErrorModal({ isOpen: true, message: `Successfully imported ${translationsToUpload.length} translation(s)` });
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to upload file" });
    } finally {
      setSubmitting(false);
    }
  };

  const [importProgress, setImportProgress] = useState<{
    stage: string;
    message: string;
    progress?: { current: number; total: number };
  } | null>(null);

  const handleBulkImport = async () => {
    if (enabledLocales.size === 0) {
      setErrorModal({ isOpen: true, message: "Please select at least one language to import" });
      return;
    }

    setImporting(true);
    setImportProgress({ stage: "starting", message: "Initializing..." });
    setImportStatus(null);
    setShowImportModal(false);
    
    try {
      const res = await fetch("/api/catalog/set-translations/bulk-import-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledLocales: Array.from(enabledLocales),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.stage) {
                setImportProgress({
                  stage: data.stage,
                  message: data.message || "",
                  progress: data.progress,
                });
              }

              if (data.stage === "complete" && data.result) {
                setImportStatus(
                  `Import complete! ${data.result.imported} translations imported ` +
                  `from ${data.result.localesProcessed?.length || 0} language(s)`
                );
                setImportProgress(null);
                await loadTranslations();
                setTimeout(() => setImportStatus(null), 15000);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (e: any) {
      setImportStatus(`Error: ${e.message || "Failed to import translations"}`);
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
  };

  const toggleLocale = (localeCode: string) => {
    setEnabledLocales((prev) => {
      const next = new Set(prev);
      if (next.has(localeCode)) {
        next.delete(localeCode);
      } else {
        next.add(localeCode);
      }
      return next;
    });
  };

  const handleDelete = async (setId: string) => {
    if (!confirm(`Delete translation for set "${setId}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/catalog/set-translations/${encodeURIComponent(setId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete translation");
      }

      await loadTranslations();
    } catch (e: any) {
      setErrorModal({ isOpen: true, message: e.message || "Failed to delete translation" });
    }
  };

  // Group translations by source language (for accordion)
  const groupedTranslations = translations.reduce((acc, translation) => {
    // Use source_language if available, otherwise group by source type
    const groupKey = translation.source_language || translation.source || "unknown";
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(translation);
    return acc;
  }, {} as Record<string, SetTranslation[]>);

  // Get language name for display (in English)
  const getLanguageName = (code: string | null): string => {
    if (!code) return "Unknown";
    return getLanguageNameEn(code);
  };

  // Sort groups: languages first (alphabetically), then by source type
  const sortedGroups = Object.entries(groupedTranslations)
    .sort(([a], [b]) => {
      // Prioritize actual language codes
      const aIsLang = SUPPORTED_LANGUAGES.some(l => l.code === a || l.code === a.toLowerCase());
      const bIsLang = SUPPORTED_LANGUAGES.some(l => l.code === b || l.code === b.toLowerCase());
      
      if (aIsLang && !bIsLang) return -1;
      if (!aIsLang && bIsLang) return 1;
      
      return getLanguageName(a).localeCompare(getLanguageName(b));
    })
    .map(([langCode, items]) => [
      langCode,
      items.sort((a, b) => a.set_id.localeCompare(b.set_id))
    ] as [string, SetTranslation[]]);

  const toggleGroup = (langCode: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(langCode)) {
        next.delete(langCode);
      } else {
        next.add(langCode);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Set Translations"
        description="Manage English display names for Japanese and Chinese Pokemon card sets"
      />

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {translations.length} translation{translations.length !== 1 ? "s" : ""} configured
        </div>
        <div className="flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => setShowImportModal(true)}
            disabled={importing}
          >
            {importing ? "Importing..." : "Auto-Import from TCGdx"}
          </Button>
          <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
            Upload File
          </Button>
          <Button variant="secondary" onClick={() => {
            setEditingTranslation(null);
            setSetId("");
            setNameEn("");
            setSource("manual");
            setShowAddModal(true);
          }}>
            Add Translation
          </Button>
        </div>
      </div>

      {importStatus && (
        <div className={`p-4 rounded-lg ${
          importStatus.includes("Error") 
            ? "bg-red-50 text-red-700 border border-red-200" 
            : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {importStatus}
        </div>
      )}

      {importProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">{importProgress.message}</span>
            {importProgress.progress && (
              <span className="text-sm text-blue-700">
                {importProgress.progress.current} / {importProgress.progress.total}
              </span>
            )}
          </div>
          {importProgress.progress && (
            <div className="w-full bg-blue-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${(importProgress.progress.current / importProgress.progress.total) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Translations List - Accordion */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Translations</h2>
        </div>
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : translations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No translations yet. Add one manually or upload a file to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedGroups.map(([langCode, items]) => {
              const isExpanded = expandedGroups.has(langCode);
              const languageName = getLanguageName(langCode);
              return (
                <div key={langCode} className="border-b border-gray-200 last:border-b-0">
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(langCode)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400 text-sm">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                      <h3 className="font-semibold text-base">{languageName}</h3>
                      <span className="text-xs text-gray-500">({items.length} set{items.length !== 1 ? 's' : ''})</span>
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Set ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">English Name</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Source</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {items.map((translation) => (
                              <tr key={translation.set_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-sm">{translation.set_id}</td>
                                <td className="px-4 py-3 font-medium">{toTitleCase(translation.name_en)}</td>
                                <td className="px-4 py-3 text-gray-600 text-sm capitalize">{translation.source}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => handleEdit(translation)}
                                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(translation.set_id)}
                                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTranslation(null);
          setSetId("");
          setNameEn("");
          setSource("manual");
        }}
        title={editingTranslation ? "Edit Translation" : "Add Translation"}
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                setEditingTranslation(null);
                setSetId("");
                setNameEn("");
                setSource("manual");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={editingTranslation ? handleSaveEdit : handleAdd}
              disabled={submitting}
            >
              {submitting ? "Saving..." : editingTranslation ? "Save Changes" : "Add Translation"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Set ID"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            placeholder="e.g., sv1a, PCG3"
            disabled={!!editingTranslation}
            helpText={editingTranslation ? "Set ID cannot be changed" : "TCGdex set identifier"}
          />
          <Input
            label="English Name"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g., Triplet Beat"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
            >
              <option value="manual">Manual</option>
              <option value="translated">Translated</option>
              <option value="override">Override</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Language</label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
            >
              <option value="">None (Unknown)</option>
              {SUPPORTED_LANGUAGES.filter(lang => lang.code !== "en").map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The language this set was originally from (e.g., Japanese, Chinese)
            </p>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
        }}
        title="Upload Set Translations"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFileUpload} disabled={submitting || !uploadFile}>
              {submitting ? "Uploading..." : "Upload"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File Format</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadFormat("csv")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadFormat === "csv"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setUploadFormat("json")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadFormat === "json"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
            <input
              type="file"
              accept={uploadFormat === "csv" ? ".csv" : ".json"}
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="font-medium mb-2">File Format:</p>
            {uploadFormat === "csv" ? (
              <div className="space-y-1">
                <p>CSV format: <code className="bg-white px-1 rounded">set_id,name_en,source</code></p>
                <p className="text-xs mt-2">Example:</p>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`set_id,name_en,source
sv1a,Triplet Beat,override
PCG3,Rocket's Counterattack,manual`}
                </pre>
              </div>
            ) : (
              <div className="space-y-1">
                <p>JSON format: Array of objects with <code className="bg-white px-1 rounded">set_id</code> and <code className="bg-white px-1 rounded">name_en</code></p>
                <p className="text-xs mt-2">Example:</p>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`[
  { "set_id": "sv1a", "name_en": "Triplet Beat", "source": "override" },
  { "set_id": "PCG3", "name_en": "Rocket's Counterattack", "source": "manual" }
]`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setEnabledLocales(new Set());
        }}
        title="Bulk Import from TCGdx"
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false);
                setEnabledLocales(new Set(["en"]));
              }}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleBulkImport} disabled={importing || enabledLocales.size === 0}>
              {importing ? "Importing..." : `Import ${enabledLocales.size} Language(s)`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Select which languages to import from TCGdx. Sets will be automatically translated to English and stored in your database.
            <br />
            <strong>Note:</strong> English sets are always available via the API and don't need to be imported.
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Languages ({enabledLocales.size} selected)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SUPPORTED_LANGUAGES.filter((lang) => lang.code !== "en").map((lang) => {
                const isEnabled = enabledLocales.has(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLocale(lang.code)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isEnabled
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">{getLanguageNameEn(lang.code)}</div>
                    <div className="text-xs opacity-75 mt-1">{lang.code}</div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Note:</strong> This process uses Google Translate API (free tier: 500k chars/month) 
            with MyMemory as fallback. Large imports may take a few minutes but can be completed in one session.
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </div>
  );
}

