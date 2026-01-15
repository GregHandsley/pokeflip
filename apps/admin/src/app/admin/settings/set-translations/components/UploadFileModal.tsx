import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

type UploadFileModalProps = {
  isOpen: boolean;
  uploadFile: File | null;
  uploadFormat: "csv" | "json";
  submitting: boolean;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  onFormatChange: (format: "csv" | "json") => void;
  onUpload: () => void;
};

export function UploadFileModal({
  isOpen,
  uploadFile,
  uploadFormat,
  submitting,
  onClose,
  onFileChange,
  onFormatChange,
  onUpload,
}: UploadFileModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Set Translations"
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onUpload} disabled={submitting || !uploadFile}>
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
              onClick={() => onFormatChange("csv")}
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
              onClick={() => onFormatChange("json")}
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
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium mb-2">File Format:</p>
          {uploadFormat === "csv" ? (
            <div className="space-y-1">
              <p>
                CSV format: <code className="bg-white px-1 rounded">set_id,name_en,source</code>
              </p>
              <p className="text-xs mt-2">Example:</p>
              <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                {`set_id,name_en,source
sv1a,Triplet Beat,override
PCG3,Rocket's Counterattack,manual`}
              </pre>
            </div>
          ) : (
            <div className="space-y-1">
              <p>
                JSON format: Array of objects with{" "}
                <code className="bg-white px-1 rounded">set_id</code> and{" "}
                <code className="bg-white px-1 rounded">name_en</code>
              </p>
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
  );
}
