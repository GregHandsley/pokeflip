import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SUPPORTED_LANGUAGES } from "@/lib/tcgdx/constants";
import type { SetTranslation } from "../types";

type AddEditTranslationModalProps = {
  isOpen: boolean;
  editingTranslation: SetTranslation | null;
  setId: string;
  nameEn: string;
  source: string;
  sourceLanguage: string;
  submitting: boolean;
  onClose: () => void;
  onSetIdChange: (value: string) => void;
  onNameEnChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSourceLanguageChange: (value: string) => void;
  onSave: () => void;
};

export function AddEditTranslationModal({
  isOpen,
  editingTranslation,
  setId,
  nameEn,
  source,
  sourceLanguage,
  submitting,
  onClose,
  onSetIdChange,
  onNameEnChange,
  onSourceChange,
  onSourceLanguageChange,
  onSave,
}: AddEditTranslationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTranslation ? "Edit Translation" : "Add Translation"}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={submitting}>
            {submitting ? "Saving..." : editingTranslation ? "Save Changes" : "Add Translation"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Set ID"
          value={setId}
          onChange={(e) => onSetIdChange(e.target.value)}
          placeholder="e.g., sv1a, PCG3"
          disabled={!!editingTranslation}
        />
        <Input
          label="English Name"
          value={nameEn}
          onChange={(e) => onNameEnChange(e.target.value)}
          placeholder="e.g., Triplet Beat"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
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
            onChange={(e) => onSourceLanguageChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
          >
            <option value="">None (Unknown)</option>
            {SUPPORTED_LANGUAGES.filter((lang) => lang.code !== "en").map((lang) => (
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
  );
}
