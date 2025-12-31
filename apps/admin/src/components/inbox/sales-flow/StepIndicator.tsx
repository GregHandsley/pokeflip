import { SalesFlowStep } from "./types";

interface Props {
  currentStep: SalesFlowStep;
}

export default function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-gray-200 pb-4">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
            currentStep === "photos"
              ? "bg-black text-white"
              : currentStep === "details" || currentStep === "pricing"
              ? "bg-green-500 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {currentStep === "photos" ? "1" : "✓"}
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep === "photos" ? "text-black" : "text-gray-600"
          }`}
        >
          Photos
        </span>
      </div>
      <div className="w-12 h-0.5 bg-gray-300"></div>
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
            currentStep === "details"
              ? "bg-black text-white"
              : currentStep === "pricing"
              ? "bg-green-500 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {currentStep === "details" ? "2" : currentStep === "pricing" ? "✓" : "2"}
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep === "details" ? "text-black" : "text-gray-600"
          }`}
        >
          Listing Details
        </span>
      </div>
      <div className="w-12 h-0.5 bg-gray-300"></div>
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
            currentStep === "pricing"
              ? "bg-black text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          3
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep === "pricing" ? "text-black" : "text-gray-600"
          }`}
        >
          Pricing
        </span>
      </div>
    </div>
  );
}

