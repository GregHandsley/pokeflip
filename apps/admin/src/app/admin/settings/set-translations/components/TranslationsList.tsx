import { useState } from "react";
import type { SetTranslation } from "../types";
import { toTitleCase } from "../utils/textUtils";
import {
  groupTranslations,
  sortTranslationGroups,
  getLanguageName,
} from "../utils/translationGrouping";

type TranslationsListProps = {
  translations: SetTranslation[];
  loading: boolean;
  onEdit: (translation: SetTranslation) => void;
  onDelete: (setId: string) => void;
};

export function TranslationsList({
  translations,
  loading,
  onEdit,
  onDelete,
}: TranslationsListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (langCode: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(langCode)) {
        next.delete(langCode);
      } else {
        next.add(langCode);
      }
      return next;
    });
  };

  const groupedTranslations = groupTranslations(translations);
  const sortedGroups = sortTranslationGroups(groupedTranslations);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading...</div>;
  }

  if (translations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No translations yet. Add one manually or upload a file to get started.
      </div>
    );
  }

  return (
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
                <div className="text-gray-400 text-sm">{isExpanded ? "▼" : "▶"}</div>
                <h3 className="font-semibold text-base">{languageName}</h3>
                <span className="text-xs text-gray-500">
                  ({items.length} set{items.length !== 1 ? "s" : ""})
                </span>
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                          Set ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                          English Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {items.map((translation) => (
                        <tr key={translation.set_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{translation.set_id}</td>
                          <td className="px-4 py-3 font-medium">
                            {toTitleCase(translation.name_en)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm capitalize">
                            {translation.source}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-3">
                              <button
                                onClick={() => onEdit(translation)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDelete(translation.set_id)}
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
  );
}
