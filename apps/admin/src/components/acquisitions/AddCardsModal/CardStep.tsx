import type { TcgdxCard } from "@/lib/tcgdx/types";

interface CardStepProps {
  cards: TcgdxCard[];
  loading: boolean;
  selectedCards: Set<string>;
  onCardToggle: (cardId: string) => void;
  onBack: () => void;
}

export default function CardStep({
  cards,
  loading,
  selectedCards,
  onCardToggle,
  onBack,
}: CardStepProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading cards...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back to Sets
        </button>
        <div className="text-sm text-gray-600">
          {selectedCards.size} of {cards.length} selected
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const isSelected = selectedCards.has(card.id);
          const imageUrl = card.image ? `${card.image}/low.webp` : undefined;

          return (
            <button
              key={card.id}
              onClick={() => onCardToggle(card.id)}
              className={`border-2 rounded-lg transition-all p-2 ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={card.name}
                  className="w-full h-auto rounded mb-2"
                />
              ) : (
                <div className="w-full aspect-[245/337] bg-gray-100 rounded flex items-center justify-center mb-2">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              <div className="text-xs font-medium truncate">{card.name}</div>
              {card.number && (
                <div className="text-xs text-gray-500">#{card.number}</div>
              )}
              {isSelected && (
                <div className="text-xs text-blue-600 font-semibold mt-1">
                  ✓ Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

