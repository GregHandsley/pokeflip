"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import { useTcgdxSets } from "./hooks/useTcgdxSets";
import { useTcgdxCards } from "./hooks/useTcgdxCards";
import LanguageStep from "./AddCardsModal/LanguageStep";
import SetStep from "./AddCardsModal/SetStep";
import CardStep from "./AddCardsModal/CardStep";
import type { TcgdxSet } from "@/lib/tcgdx/types";

interface AddCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  acquisitionId: string;
  onCardsAdded: () => void;
}

type Step = "language" | "set" | "cards";

export default function AddCardsModal({
  isOpen,
  onClose,
  acquisitionId,
  onCardsAdded,
}: AddCardsModalProps) {
  const [step, setStep] = useState<Step>("language");
  const [locale, setLocale] = useState("en");
  const [selectedSet, setSelectedSet] = useState<TcgdxSet | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use hooks for data fetching
  const { sets, loading: loadingSets, error: setsError } = useTcgdxSets(
    step === "set" || step === "cards" ? locale : ""
  );
  const { cards, loading: loadingCards, error: cardsError } = useTcgdxCards(
    step === "cards" ? selectedSet?.id ?? null : null,
    locale
  );

  // Combine errors
  useEffect(() => {
    setError(setsError || cardsError || null);
  }, [setsError, cardsError]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep("language");
      setLocale("en");
      setSelectedSet(null);
      setSelectedCards(new Set());
      setError(null);
    }
  }, [isOpen]);

  const handleLanguageSelect = (langCode: string) => {
    setLocale(langCode);
    setStep("set");
  };

  const handleSetSelect = (set: TcgdxSet) => {
    setSelectedSet(set);
    setStep("cards");
  };

  const toggleCardSelection = (cardId: string) => {
    const newSelection = new Set(selectedCards);
    if (newSelection.has(cardId)) {
      newSelection.delete(cardId);
    } else {
      newSelection.add(cardId);
    }
    setSelectedCards(newSelection);
  };

  const handleAddCards = async () => {
    if (selectedCards.size === 0) {
      setError("Please select at least one card");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = Array.from(selectedCards).map(async (cardId) => {
        const res = await fetch("/api/intake/add-line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acquisition_id: acquisitionId,
            set_id: selectedSet?.id,
            card_id: cardId,
            condition: "LP",
            variation: "standard",
            quantity: 1,
            for_sale: true,
            list_price_pence: 99,
            locale,
          }),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to add card");
        }
      });

      await Promise.all(promises);
      onCardsAdded();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case "language":
        return "Step 1: Select Language";
      case "set":
        return "Step 2: Select Set";
      case "cards":
        return `Step 3: Select Cards (${selectedCards.size} selected)`;
      default:
        return "";
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      {step === "cards" && (
        <Button
          onClick={handleAddCards}
          disabled={loading || selectedCards.size === 0}
        >
          {loading
            ? "Adding..."
            : `Add ${selectedCards.size} Card${selectedCards.size !== 1 ? "s" : ""}`}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Cards"
      subtitle={getSubtitle()}
      footer={footer}
      maxWidth="6xl"
    >
      {error && (
        <div className="mb-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      {step === "language" && (
        <LanguageStep onLanguageSelect={handleLanguageSelect} />
      )}

      {step === "set" && (
        <SetStep
          sets={sets}
          loading={loadingSets}
          onSetSelect={handleSetSelect}
          onBack={() => setStep("language")}
        />
      )}

      {step === "cards" && (
        <CardStep
          cards={cards}
          loading={loadingCards}
          selectedCards={selectedCards}
          onCardToggle={toggleCardSelection}
          onBack={() => setStep("set")}
        />
      )}
    </Modal>
  );
}
