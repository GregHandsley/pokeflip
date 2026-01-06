"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { penceToPounds, poundsToPence } from "@pokeflip/shared";

type Purchase = {
  id: string;
  source_name: string;
  source_type: string;
  purchased_at: string;
  status: string;
  quantity: number;
};

type Lot = {
  id: string;
  card_id: string;
  condition: string;
  variation: string | null;
  quantity: number;
  available_qty: number;
  for_sale?: boolean; // Include for_sale field
  purchases?: Purchase[];
  card: {
    id: string;
    number: string;
    name: string;
    api_image_url: string | null;
    set: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onBundleCreated: () => void;
  initialLotId?: string; // Optional lot ID to pre-select when modal opens
};

export default function CreateBundleModal({ isOpen, onClose, onBundleCreated, initialLotId }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [selectedLots, setSelectedLots] = useState<Map<string, { lot: Lot; quantity: number }>>(new Map());
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundlePhotos, setBundlePhotos] = useState<Array<{ id: string; signedUrl: string | null; file?: File }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [createdBundleId, setCreatedBundleId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableLots();
    } else {
      // Reset form when modal closes
      setName("");
      setDescription("");
      setPrice("");
      setSelectedLots(new Map());
      setError(null);
      setBundlePhotos([]);
      setCreatedBundleId(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  const loadAvailableLots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales/listed-lots");
      const json = await res.json();
      if (json.ok) {
        // Filter to ensure only lots with available quantity and for_sale=true are shown
        // The API already filters by for_sale=true and status in ['ready', 'listed'], but we add an extra check
        // Also explicitly filter out any lots that might not be for sale (defensive programming)
        const lots = (json.lots || []).filter((lot: Lot) => {
          // Ensure available quantity > 0
          // Explicitly check for_sale field if it exists (defensive programming)
          return lot.available_qty > 0 && (lot.for_sale !== false);
        });
        setAvailableLots(lots);
        setFilteredLots(lots);
      }
    } catch (e) {
      console.error("Failed to load lots:", e);
    } finally {
      setLoading(false);
    }
  };

  // Pre-select initial lot if provided
  useEffect(() => {
    if (isOpen && initialLotId && availableLots.length > 0) {
      const lotToSelect = availableLots.find((lot) => lot.id === initialLotId);
      if (lotToSelect && !selectedLots.has(initialLotId)) {
        setSelectedLots((prev) => {
          const newSelected = new Map(prev);
          newSelected.set(initialLotId, { lot: lotToSelect, quantity: 1 });
          return newSelected;
        });
      }
    }
  }, [isOpen, initialLotId, availableLots, selectedLots]);

  // Filter lots based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLots(availableLots);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = availableLots.filter((lot) => {
      const cardName = lot.card?.name?.toLowerCase() || "";
      const cardNumber = lot.card?.number?.toLowerCase() || "";
      const setName = lot.card?.set?.name?.toLowerCase() || "";
      const condition = lot.condition?.toLowerCase() || "";
      const variation = lot.variation?.toLowerCase() || "";
      
      // Search in purchase names
      const purchaseNames = (lot.purchases || [])
        .map((p) => p.source_name?.toLowerCase() || "")
        .join(" ");

      return (
        cardName.includes(query) ||
        cardNumber.includes(query) ||
        setName.includes(query) ||
        condition.includes(query) ||
        variation.includes(query) ||
        purchaseNames.includes(query)
      );
    });

    setFilteredLots(filtered);
  }, [searchQuery, availableLots]);

  const toggleLotSelection = (lot: Lot) => {
    const newSelected = new Map(selectedLots);
    if (newSelected.has(lot.id)) {
      newSelected.delete(lot.id);
    } else {
      newSelected.set(lot.id, { lot, quantity: 1 });
    }
    setSelectedLots(newSelected);
  };

  const updateQuantity = (lotId: string, quantity: number) => {
    const newSelected = new Map(selectedLots);
    const item = newSelected.get(lotId);
    if (item) {
      const maxQty = Math.min(item.lot.available_qty, quantity);
      newSelected.set(lotId, { ...item, quantity: Math.max(1, maxQty) });
      setSelectedLots(newSelected);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter a bundle name");
      return;
    }

    if (!price.trim() || parseFloat(price) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    if (selectedLots.size < 2) {
      setError("Please select at least 2 cards to create a bundle");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const items = Array.from(selectedLots.values()).map((item) => ({
        lotId: item.lot.id,
        quantity: item.quantity,
      }));

      console.log("Creating bundle with data:", {
        name: name.trim(),
        description: description.trim() || null,
        pricePence: poundsToPence(price), // poundsToPence expects a string
        items,
      });

      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          pricePence: poundsToPence(price), // poundsToPence expects a string
          items,
        }),
      });

      const json = await res.json();
      console.log("Bundle creation response:", json);

      if (!res.ok) {
        throw new Error(json.error || "Failed to create bundle");
      }

      // Upload bundle photos if any were added
      if (bundlePhotos.length > 0 && json.bundle?.id) {
        await uploadBundlePhotos(json.bundle.id);
      }

      onBundleCreated();
      onClose(); // Close the modal after successful creation
    } catch (e: any) {
      console.error("Error creating bundle:", e);
      setError(e.message || "Failed to create bundle");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCards = Array.from(selectedLots.values()).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      // Store photo temporarily with file reference (will upload after bundle creation)
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBundlePhotos((prev) => [...prev, {
          id: `temp-${Date.now()}-${Math.random()}`,
          signedUrl: result,
          file, // Store file for later upload
        }]);
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setError(e.message || "Failed to process photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const uploadBundlePhotos = async (bundleId: string) => {
    const photosToUpload = bundlePhotos.filter((p) => p.file);
    
    for (const photo of photosToUpload) {
      if (!photo.file) continue;
      
      try {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("kind", "bundle");

        const uploadRes = await fetch(`/api/admin/bundles/${bundleId}/photos/upload`, {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          console.error("Failed to upload photo:", uploadJson.error);
          continue;
        }

        // Update photo with real ID and signed URL
        if (uploadJson.photo) {
          setBundlePhotos((prev) => prev.map((p) =>
            p.id === photo.id
              ? {
                  id: uploadJson.photo.id,
                  signedUrl: uploadJson.photo.signedUrl || null,
                }
              : p
          ));
        }
      } catch (e) {
        console.error("Error uploading photo:", e);
      }
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // Delete from server if bundle exists and photo is not temporary
    if (createdBundleId && !photoId.startsWith("temp-")) {
      try {
        const res = await fetch(`/api/admin/bundles/${createdBundleId}/photos/${photoId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setBundlePhotos((prev) => prev.filter((p) => p.id !== photoId));
        }
      } catch (e) {
        console.error("Failed to delete photo:", e);
      }
    } else {
      // Just remove from local state if temporary
      setBundlePhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Bundle"
      maxWidth="4xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Create Bundle button clicked", { 
                submitting, 
                selectedLotsSize: selectedLots.size,
                name: name.trim(),
                price: price.trim(),
              });
              if (!submitting && selectedLots.size >= 2) {
                handleSubmit();
              } else {
                console.warn("Button click ignored - validation failed", {
                  submitting,
                  selectedLotsSize: selectedLots.size,
                });
              }
            }}
            disabled={submitting || selectedLots.size < 2}
            title={selectedLots.size < 2 ? "Please select at least 2 cards" : undefined}
          >
            {submitting ? "Creating..." : "Create Bundle"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bundle Name *
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Starter Deck Bundle"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this bundle..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bundle Price (£) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Cards ({selectedLots.size} selected, {totalCards} total cards)
              {selectedLots.size < 2 && (
                <span className="ml-2 text-xs text-yellow-600">
                  (Need at least 2 cards)
                </span>
              )}
            </label>
          </div>

          {/* Search Input */}
          <div className="mb-3">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by card name, number, set, condition, or purchase..."
              className="w-full"
            />
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 py-4">Loading available cards...</div>
          ) : filteredLots.length === 0 ? (
            <div className="text-sm text-gray-500 py-4">
              {searchQuery ? "No cards match your search" : "No available cards found"}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredLots.map((lot) => {
                const isSelected = selectedLots.has(lot.id);
                const selectedItem = selectedLots.get(lot.id);
                return (
                  <div
                    key={lot.id}
                    className={`p-3 border-b border-gray-200 last:border-b-0 ${
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLotSelection(lot)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      {lot.card?.api_image_url && (
                        <img
                          src={`${lot.card.api_image_url}/low.webp`}
                          alt=""
                          className="h-12 w-auto rounded border border-gray-200"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          #{lot.card?.number} {lot.card?.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {lot.card?.set?.name} • {lot.condition} • Available: {lot.available_qty}
                        </div>
                        {/* Purchase information */}
                        {lot.purchases && lot.purchases.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            From purchase{lot.purchases.length > 1 ? "s" : ""}:{" "}
                            {lot.purchases.map((p, idx) => (
                              <span key={p.id}>
                                {idx > 0 && ", "}
                                <a
                                  href={`/admin/acquisitions/${p.id}/lots`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {p.source_name}
                                </a>
                                {p.quantity > 1 && (
                                  <span className="text-gray-400"> ({p.quantity})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            max={selectedItem?.lot.available_qty || 1}
                            value={selectedItem?.quantity || 1}
                            onChange={(e) =>
                              updateQuantity(lot.id, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bundle Photos (optional)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Add photos of the bundle (e.g., all cards together). Individual card photos are already available.
          </p>
          
          {bundlePhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              {bundlePhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.signedUrl || ""}
                    alt="Bundle"
                    className="h-32 w-full object-cover rounded border border-gray-200"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => {
                  handlePhotoUpload(file);
                });
              }}
              disabled={uploadingPhoto || submitting}
              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
            />
            {uploadingPhoto && (
              <span className="ml-2 text-xs text-gray-500">Processing...</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

