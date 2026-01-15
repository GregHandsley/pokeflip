import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { SUPPORTED_LANGUAGES, getLanguageNameEn } from "@/lib/tcgdx/constants";

type BulkImportModalProps = {
  isOpen: boolean;
  importing: boolean;
  enabledLocales: Set<string>;
  onClose: () => void;
  onToggleLocale: (localeCode: string) => void;
  onImport: () => void;
};

export function BulkImportModal({
  isOpen,
  importing,
  enabledLocales,
  onClose,
  onToggleLocale,
  onImport,
}: BulkImportModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Import from TCGdx"
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onImport}
            disabled={importing || enabledLocales.size === 0}
          >
            {importing ? "Importing..." : `Import ${enabledLocales.size} Language(s)`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Select which languages to import from TCGdx. Sets will be automatically translated to
          English and stored in your database.
          <br />
          <strong>Note:</strong> English sets are always available via the API and don&apos;t need
          to be imported.
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
                  onClick={() => onToggleLocale(lang.code)}
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
          <strong>Note:</strong> This process uses Google Translate API (free tier: 500k
          chars/month) with MyMemory as fallback. Large imports may take a few minutes but can be
          completed in one session.
        </div>
      </div>
    </Modal>
  );
}
