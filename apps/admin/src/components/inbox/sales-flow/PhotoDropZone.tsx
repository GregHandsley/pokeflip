"use client";

import { Photo } from "./types";

interface Props {
  kind: "front" | "back" | "extra";
  label: string;
  hasPhoto: boolean;
  isUploading: boolean;
  isDragOver: boolean;
  isDisabled: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: () => void;
}

export default function PhotoDropZone({
  kind,
  label,
  hasPhoto,
  isUploading,
  isDragOver,
  isDisabled,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}: Props) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDisabled
          ? "border-gray-200 bg-gray-100 cursor-not-allowed"
          : isDragOver
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 bg-gray-50 hover:border-gray-400 cursor-pointer"
      }`}
      onClick={!isDisabled ? onFileSelect : undefined}
    >
      {isUploading ? (
        <div className="space-y-2">
          <div className="animate-spin mx-auto w-8 h-8 border-4 border-gray-300 border-t-black rounded-full"></div>
          <p className="text-sm text-gray-600">Uploading...</p>
        </div>
      ) : hasPhoto ? (
        <div className="flex flex-col items-center justify-center h-full">
          <svg
            className="w-12 h-12 text-green-500 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700">{label}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <svg
            className="mx-auto w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-500">Drag & drop or click</p>
        </div>
      )}
    </div>
  );
}

