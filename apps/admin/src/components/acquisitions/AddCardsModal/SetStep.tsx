import type { TcgdxSet } from "@/lib/tcgdx/types";

interface SetStepProps {
  sets: TcgdxSet[];
  loading: boolean;
  onSetSelect: (set: TcgdxSet) => void;
  onBack: () => void;
}

export default function SetStep({ sets, loading, onSetSelect, onBack }: SetStepProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading sets...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back to Languages
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {sets.map((set) => {
          const logoUrl = set.logo ? `${set.logo}.webp` : undefined;
          const symbolUrl = set.symbol ? `${set.symbol}.webp` : undefined;
          const imageUrl = logoUrl || symbolUrl;

          return (
            <button
              key={set.id}
              onClick={() => onSetSelect(set)}
              className="border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all p-3 text-center"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={set.name}
                  className="w-full h-24 object-contain mb-2"
                />
              ) : (
                <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center mb-2">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
              <div className="text-xs font-medium truncate">{set.name}</div>
              <div className="text-xs text-gray-500 mt-1">{set.id}</div>
              {set.cardCount && (
                <div className="text-xs text-gray-400 mt-1">
                  {set.cardCount.total} cards
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

