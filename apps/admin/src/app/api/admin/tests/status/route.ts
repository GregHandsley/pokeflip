export const runtime = "edge";
import { NextResponse } from "next/server";

type VitestTestResult = {
  title?: string;
  fullName?: string;
  status: string;
  ancestorTitles?: string[];
  duration?: number;
  failureMessages?: string[];
  category?: string;
  subcategory?: string | null;
};

type VitestFileResult = {
  name?: string;
  assertionResults?: VitestTestResult[];
};

type VitestResults = {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  success?: boolean;
  testResults?: VitestFileResult[];
};

type ProcessError = {
  message?: string;
  stderr?: string;
  stdout?: string;
};

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      status: "unavailable",
      error: "Test status endpoint is not supported in the Edge runtime.",
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      testFiles: [],
      timestamp: new Date().toISOString(),
    },
    { status: 501 }
  );
}
