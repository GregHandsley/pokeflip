"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import ErrorModal from "@/components/ui/ErrorModal";
import PageHeader from "@/components/ui/PageHeader";
import { useSetTranslations } from "./hooks/useSetTranslations";
import { useTranslationForm } from "./hooks/useTranslationForm";
import { useFileUpload } from "./hooks/useFileUpload";
import { useBulkImport } from "./hooks/useBulkImport";
import { TranslationsList } from "./components/TranslationsList";
import { AddEditTranslationModal } from "./components/AddEditTranslationModal";
import { UploadFileModal } from "./components/UploadFileModal";
import { BulkImportModal } from "./components/BulkImportModal";
import { ImportStatus } from "./components/ImportStatus";
import { ImportProgress } from "./components/ImportProgress";

export default function SetTranslationsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  const { translations, loading, loadTranslations } = useSetTranslations();

  const form = useTranslationForm(
    async () => {
      await loadTranslations();
      setShowAddModal(false);
    },
    (message) => setErrorModal({ isOpen: true, message })
  );

  const fileUpload = useFileUpload(
    async () => {
      await loadTranslations();
      setShowUploadModal(false);
    },
    (message) => setErrorModal({ isOpen: true, message })
  );

  const bulkImport = useBulkImport(async () => {
    await loadTranslations();
  });

  const handleOpenAddModal = () => {
    form.resetForm();
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    form.resetForm();
  };

  const handleEdit = (translation: (typeof translations)[0]) => {
    form.startEdit(translation);
    setShowAddModal(true);
  };

  const handleDelete = async (setId: string) => {
    await form.handleDelete(setId, loadTranslations);
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
            disabled={bulkImport.importing}
          >
            {bulkImport.importing ? "Importing..." : "Auto-Import from TCGdx"}
          </Button>
          <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
            Upload File
          </Button>
          <Button variant="secondary" onClick={handleOpenAddModal}>
            Add Translation
          </Button>
        </div>
      </div>

      <ImportStatus message={bulkImport.importStatus} />
      <ImportProgress progress={bulkImport.importProgress} />

      {/* Translations List - Accordion */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Translations</h2>
        </div>
        <TranslationsList
          translations={translations}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <AddEditTranslationModal
        isOpen={showAddModal}
        editingTranslation={form.editingTranslation}
        setId={form.setId}
        nameEn={form.nameEn}
        source={form.source}
        sourceLanguage={form.sourceLanguage}
        submitting={form.submitting}
        onClose={handleCloseAddModal}
        onSetIdChange={form.setSetId}
        onNameEnChange={form.setNameEn}
        onSourceChange={form.setSource}
        onSourceLanguageChange={form.setSourceLanguage}
        onSave={form.handleSave}
      />

      <UploadFileModal
        isOpen={showUploadModal}
        uploadFile={fileUpload.uploadFile}
        uploadFormat={fileUpload.uploadFormat}
        submitting={fileUpload.submitting}
        onClose={() => {
          setShowUploadModal(false);
          fileUpload.reset();
        }}
        onFileChange={fileUpload.setUploadFile}
        onFormatChange={fileUpload.setUploadFormat}
        onUpload={fileUpload.handleFileUpload}
      />

      <BulkImportModal
        isOpen={showImportModal}
        importing={bulkImport.importing}
        enabledLocales={bulkImport.enabledLocales}
        onClose={() => {
          setShowImportModal(false);
          bulkImport.reset();
        }}
        onToggleLocale={bulkImport.toggleLocale}
        onImport={bulkImport.handleBulkImport}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        message={errorModal.message}
      />
    </div>
  );
}
