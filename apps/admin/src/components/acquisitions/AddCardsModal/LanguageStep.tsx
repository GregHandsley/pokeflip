import { SUPPORTED_LANGUAGES } from "@/lib/tcgdx/constants";

interface LanguageStepProps {
  onLanguageSelect: (code: string) => void;
}

export default function LanguageStep({ onLanguageSelect }: LanguageStepProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onLanguageSelect(lang.code)}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
        >
          <div className="font-semibold">{lang.name}</div>
          <div className="text-sm text-gray-600 mt-1">{lang.code}</div>
        </button>
      ))}
    </div>
  );
}

