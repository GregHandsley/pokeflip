"use client";

import { useState, useEffect } from "react";
import { CONDITIONS, Condition } from "../types";
import { poundsToPence, penceToPounds } from "@pokeflip/shared";
import type { DraftLine } from "./types";
import IntakeLinePhotoUpload from "@/components/intake/IntakeLinePhotoUpload";
import SplitModal from "@/components/ui/SplitModal";

type Props = {
  line: DraftLine;
  cardDisplay: string;
  cardIndex: number;
  totalQty: number;
  acquisitionId: string;
  onUpdate: (id: string, patch: Partial<DraftLine>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  supabase: any;
  setMsg: (msg: string | null) => void;
};

type Photo = {
  id: string;
  kind: string;
  signedUrl: string | null;
};

export function CardRow({ line, cardDisplay, cardIndex, totalQty, acquisitionId, onUpdate, onRemove, supabase, setMsg }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const handleChange = async (field: string, value: any) => {
    // Update the line directly - no splitting
    if (field === 'for_sale') {
      await onUpdate(line.id, {
        for_sale: value,
        list_price_pence: value ? (line.list_price_pence ?? poundsToPence("0.99")) : null
      });
    } else {
      await onUpdate(line.id, { [field]: value });
    }
  };

  const handleRemove = async () => {
    // Remove the entire line
    await onRemove(line.id);
  };

  // Load photos for this line
  useEffect(() => {
    const loadPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const res = await fetch(`/api/admin/intake-lines/${line.id}/photos`);
        const json = await res.json();
        if (json.ok) {
          setPhotos(json.photos || []);
        }
      } catch (e) {
        console.error("Failed to load photos:", e);
      } finally {
        setLoadingPhotos(false);
      }
    };
    void loadPhotos();
  }, [line.id]);

  const handlePhotoUploaded = (newPhoto: Photo) => {
    setPhotos((prev) => [...prev, newPhoto]);
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const res = await fetch(`/api/admin/intake-lines/${line.id}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      }
    } catch (e) {
      console.error("Failed to delete photo:", e);
    }
  };

  const handleSplit = async (splitQty: number, forSale: boolean, price: string | null, condition?: Condition) => {
    try {
      const res = await fetch(`/api/admin/intake-lines/${line.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_qty: splitQty,
          for_sale: forSale,
          list_price_pence: price,
          condition: condition,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to split line");
      }

      // Update the current line's quantity
      await onUpdate(line.id, { quantity: line.quantity - splitQty });
      
      // Trigger a page refresh to show the new split line
      // The parent component will reload the data
      window.location.reload();
    } catch (e: any) {
      setMsg(e.message || "Failed to split line");
      throw e;
    }
  };

  return (
    <>
    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-black/5 transition-colors">
        {/* Camera icon with photo count */}
      <div className="col-span-1">
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="w-7 h-7 flex items-center justify-center rounded border border-black/10 hover:bg-black/10 transition-colors relative"
            title={`${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
          >
            {photos.length > 0 ? (
              <>
                <svg className="w-4 h-4 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {photos.length}
                </span>
              </>
            ) : (
              <svg className="w-4 h-4 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
      </div>

      {/* Card name */}
      <div className="col-span-3">
        <div className="font-medium text-sm truncate">
          {cardDisplay}
        </div>
      </div>

      {/* Condition */}
      <div className="col-span-2">
        <select
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs bg-white font-medium text-black"
          value={line.condition}
          onChange={(e) => handleChange('condition', e.target.value as Condition)}
        >
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Quantity */}
      <div className="col-span-1">
        <input
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs"
          type="number"
          min={1}
          value={line.quantity}
          onChange={(e) => handleChange('quantity', Number(e.target.value))}
        />
      </div>

      {/* For sale */}
      <div className="col-span-1 flex justify-center">
        <input
          type="checkbox"
          checked={line.for_sale}
          onChange={(e) => handleChange('for_sale', e.target.checked)}
          className="w-4 h-4"
        />
      </div>

      {/* Price */}
      <div className="col-span-2">
        <input
          className="w-full rounded border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50"
          disabled={!line.for_sale}
          value={line.for_sale ? (line.list_price_pence != null ? penceToPounds(line.list_price_pence) : "") : ""}
          onChange={(e) => handleChange('list_price_pence', poundsToPence(e.target.value))}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>

      {/* Actions */}
      <div className="col-span-1 flex items-center gap-1">
        {line.quantity > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSplitModal(true);
            }}
            className="px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
            title="Split quantity"
          >
            Split
          </button>
        )}
        <button
          type="button"
          onClick={handleRemove}
          className="px-2 py-1.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 rounded border border-black/10 transition-colors"
          title="Remove this line"
        >
          ×
        </button>
      </div>
    </div>

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPhotoModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Photos for {cardDisplay}</h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Upload buttons */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <IntakeLinePhotoUpload lineId={line.id} kind="front" onUploaded={handlePhotoUploaded} />
              <IntakeLinePhotoUpload lineId={line.id} kind="back" onUploaded={handlePhotoUploaded} />
              <IntakeLinePhotoUpload lineId={line.id} kind="extra" onUploaded={handlePhotoUploaded} />
            </div>

            {/* Photo gallery */}
            {loadingPhotos ? (
              <div className="text-sm text-gray-500">Loading photos...</div>
            ) : photos.length === 0 ? (
              <div className="text-sm text-gray-500">No photos yet. Upload some above.</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden group">
                    {photo.signedUrl ? (
                      <img
                        src={photo.signedUrl}
                        alt={`${photo.kind} photo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        Failed to load
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 text-center">
                      {photo.kind}
                    </div>
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Split Modal */}
      <SplitModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        onSplit={handleSplit}
        currentQuantity={line.quantity}
        currentForSale={line.for_sale}
        currentPrice={line.list_price_pence}
        currentCondition={line.condition}
        title={`Split ${cardDisplay}`}
      />
    </>
  );
}

