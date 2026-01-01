"use client";

import { useState, useEffect } from "react";
import { fetchAllSets, fetchCardsForSet } from "@/lib/tcgdx/tcgdxClient";
import { getSetDisplayName } from "@/lib/tcgdx/englishNameOverrides";
import { getLanguageNameEn } from "@/lib/tcgdx/constants";
import type { TcgdxSet, TcgdxCard, Condition, CardVariation } from "./CardPicker/types";
import { SetGrid } from "./CardPicker/SetGrid";
import { CardGrid } from "./CardPicker/CardGrid";
import { CardModal } from "./CardPicker/CardModal";

type Props = {
  onPickCard: (args: { setId: string; cardId: string; locale: string; condition: Condition; quantity: number; variation: CardVariation }) => void;
};

type View = "set" | "cards";

type LocaleOption = "en" | "ja" | "zh-hant" | "zh" | "fr" | "de" | "it" | "es" | "pt" | "ko" | "zh-Hans" | "zh-Hant";

export function CardPicker({ onPickCard }: Props) {
  const [locale, setLocale] = useState<string>("en");
  const [view, setView] = useState<View>("set");
  const [sets, setSets] = useState<TcgdxSet[]>([]);
  const [englishSetNames, setEnglishSetNames] = useState<Record<string, string>>({});
  const [dbTranslations, setDbTranslations] = useState<Record<string, string>>({});
  const [selectedSet, setSelectedSet] = useState<TcgdxSet | null>(null);
  const [cards, setCards] = useState<TcgdxCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [modalCard, setModalCard] = useState<{ card: TcgdxCard; imageUrl: string } | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  // Load available languages from database (languages that have translations)
  useEffect(() => {
    fetch("/api/catalog/set-translations")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.translationsList) {
          // Get unique source_language values, always include English
          const languages = new Set<string>(["en"]);
          (json.translationsList || []).forEach((t: any) => {
            if (t.source_language) {
              languages.add(t.source_language);
            }
          });
          setAvailableLanguages(Array.from(languages));
        } else {
          // Fallback: always show English
          setAvailableLanguages(["en"]);
        }
      })
      .catch((e) => {
        console.warn("Failed to load available languages", e);
        setAvailableLanguages(["en"]);
      });
  }, []);

  // Preload English set names from TCGdx API (used for display even when browsing JP/ZH)
  useEffect(() => {
    fetchAllSets("en")
      .then((englishSets) => {
        const map = Object.fromEntries(englishSets.map((s) => [s.id, s.name]));
        setEnglishSetNames(map);
      })
      .catch((e) => {
        console.warn("Failed to preload English set names", e);
      });
  }, []);

  // Load database translations (English display names from our set_translations table)
  useEffect(() => {
    fetch("/api/catalog/set-translations")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.translations) {
          setDbTranslations(json.translations);
        }
      })
      .catch((e) => {
        console.warn("Failed to load database translations", e);
      });
  }, []);

  // Helper to map display locale codes to API codes
  const getApiLocale = (displayLocale: string): string => {
    if (displayLocale === "zh-hant") return "zh-Hant";
    if (displayLocale === "zh") return "zh-Hant";
    return displayLocale;
  };

  // Load sets on mount / locale change
  useEffect(() => {
    if (view === "set") {
      setLoadingSets(true);
      setError(null);
      const apiLocale = getApiLocale(locale);
      const localeCandidates: string[] =
        apiLocale === "zh-Hant" ? ["zh-Hant", "zh-Hans", "zh"] : [apiLocale];

      const loadSets = async () => {
        let fetchedSets: TcgdxSet[] | null = null;
        let lastError: any = null;

        for (const candidate of localeCandidates) {
          try {
            const result = await fetchAllSets(candidate);
            fetchedSets = result;
            break;
          } catch (e) {
            lastError = e;
          }
        }

        if (!fetchedSets) {
          throw lastError;
        }

        // Deduplicate sets by ID (keep first occurrence) and apply English names
        const uniqueSets = Array.from(new Map(fetchedSets.map(set => [set.id, set])).values()).map(
          (set) => ({
            ...set,
            name: getSetDisplayName(set.id, set.name, englishSetNames, dbTranslations),
          })
        );
        setSets(uniqueSets);
      };

      loadSets()
        .catch((e: any) => {
          setError(`Failed to load sets: ${e.message}`);
        })
        .finally(() => {
          setLoadingSets(false);
        });
    }
  }, [view, locale, englishSetNames, dbTranslations]);

  // Load cards when set is selected (prefer English names; fall back to chosen locale)
  useEffect(() => {
    if (view === "cards" && selectedSet) {
      setLoadingCards(true);
      setError(null);
      setSearchQuery(""); // Reset search when set changes

      const apiLocale = getApiLocale(locale);
      const localeCandidates: string[] =
        apiLocale === "zh-Hant" ? ["en", "zh-Hant", "zh-Hans", "zh"] : locale === "en" ? ["en"] : ["en", apiLocale];

      const loadCards = async () => {
        let fetchedCards: TcgdxCard[] | null = null;
        let lastError: any = null;

        for (const candidate of localeCandidates) {
          try {
            const result = await fetchCardsForSet(selectedSet.id, candidate);
            fetchedCards = result;
            break;
          } catch (e) {
            lastError = e;
          }
        }

        if (!fetchedCards) {
          throw lastError;
        }

        setCards(fetchedCards);
      };

      loadCards()
        .catch((e: any) => {
          setError(`Failed to load cards: ${e.message}`);
          setCards([]);
        })
        .finally(() => {
          setLoadingCards(false);
        });
    }
  }, [view, selectedSet, locale]);


  const handleSetSelect = (set: TcgdxSet) => {
    setSelectedSet(set);
    setView("cards");
  };

  const handleCardClick = (card: TcgdxCard, imageUrl: string) => {
    setModalCard({ card, imageUrl });
  };

  const handleCardAdded = (cardId: string) => {
    setRecentlyAdded(new Set([...recentlyAdded, cardId]));
    setTimeout(() => {
      setRecentlyAdded(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }, 1000);
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Card Browser</h2>
          <p className="mt-1.5 text-sm text-black/60">
            {view === "set" && "Select a set"}
            {view === "cards" && `Cards in ${selectedSet?.name || "set"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-sm text-black/60" htmlFor="card-locale">
            Language
          </label>
          <select
            id="card-locale"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value as LocaleOption);
              setSelectedSet(null);
              setView("set");
              setCards([]);
            }}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm bg-white"
          >
            {availableLanguages.map((langCode) => {
              // Map zh-Hans and zh-Hant to zh-hant for the selector (CardPicker uses zh-hant)
              let displayCode: string = langCode;
              if (langCode === "zh-Hans" || langCode === "zh-Hant") {
                displayCode = "zh-hant";
              }
              return (
                <option key={langCode} value={displayCode}>
                  {getLanguageNameEn(langCode)}
                </option>
              );
            })}
          </select>
        </div>
        {view === "cards" && (
          <button
            type="button"
            onClick={() => {
              setView("set");
              setSelectedSet(null);
              setCards([]);
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium"
          >
            Back
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Set Selection */}
      {view === "set" && (
        <div className="overflow-y-auto flex-1 pr-2">
          <SetGrid sets={sets} loading={loadingSets} onSelectSet={handleSetSelect} locale={locale} />
        </div>
      )}

      {/* Card Selection */}
      {view === "cards" && (
        <div className="flex flex-col flex-1 min-h-0">
          <input
            className="w-full rounded-lg border border-black/10 px-4 py-2.5 mb-5 text-sm flex-shrink-0"
            placeholder="Search cards by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <CardGrid
            cards={cards}
            loading={loadingCards}
            searchQuery={searchQuery}
            recentlyAdded={recentlyAdded}
            onCardClick={handleCardClick}
            locale={locale}
          />
        </div>
      )}

      {/* Modal for card selection */}
      {modalCard && selectedSet && (
        <CardModal
          card={modalCard.card}
          imageUrl={modalCard.imageUrl}
          selectedSetId={selectedSet.id}
          locale={locale}
          onAdd={onPickCard}
          onClose={() => setModalCard(null)}
          onCardAdded={handleCardAdded}
        />
      )}
    </section>
  );
}
