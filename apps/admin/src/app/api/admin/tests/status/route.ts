import { NextResponse } from "next/server";
import { resolve } from "path";
import { spawn } from "child_process";

export async function GET(req: Request) {
  try {
    // In Next.js API routes, process.cwd() might be the project root or apps/admin
    // Check both possibilities
    const cwd = process.cwd();
    const fs = await import("fs");
    
    // Try to find vitest.mjs in the current directory first (if we're in apps/admin)
    let actualVitestPath = resolve(cwd, "node_modules/vitest/vitest.mjs");
    let workingDir = cwd;
    
    if (!fs.existsSync(actualVitestPath)) {
      // Try apps/admin path (if we're in project root)
      const adminRoot = resolve(cwd, "apps/admin");
      actualVitestPath = resolve(adminRoot, "node_modules/vitest/vitest.mjs");
      if (fs.existsSync(actualVitestPath)) {
        workingDir = adminRoot;
      } else {
        throw new Error(`Vitest not found. Tried: ${resolve(cwd, "node_modules/vitest/vitest.mjs")} and ${actualVitestPath}. Current cwd: ${cwd}`);
      }
    }
    
    // Try to find node executable - check process.execPath first, then try common locations
    let nodeExecutable = process.execPath;
    if (!fs.existsSync(nodeExecutable)) {
      // Try common node locations
      const possiblePaths = [
        "/usr/local/bin/node",
        "/usr/bin/node",
        "/opt/homebrew/bin/node",
        "node", // Last resort - hope it's in PATH
      ];
      for (const path of possiblePaths) {
        if (path === "node" || fs.existsSync(path)) {
          nodeExecutable = path;
          break;
        }
      }
    }
    
    return new Promise((resolve) => {
      const proc = spawn(nodeExecutable, [actualVitestPath, "run", "--reporter=json"], {
        cwd: workingDir,
        env: { ...process.env, NODE_ENV: "test" },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        proc.kill();
        resolve(NextResponse.json({
          ok: false,
          status: "error",
          error: "Test execution timed out",
          summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
          testFiles: [],
          timestamp: new Date().toISOString(),
        }, { status: 500 }));
      }, 60000);
      
      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        
        // Parse the JSON output (it's the last line)
        // Vitest exits with code 1 when tests fail, but still outputs valid JSON
        const lines = stdout.trim().split("\n");
        let results: any = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith("{")) {
            try {
              results = JSON.parse(line);
              break;
            } catch (e) {
              // Continue searching
            }
          }
        }
        
        // If we couldn't parse results and exit code is non-zero, it's a real error
        if (!results && code !== 0) {
          resolve(NextResponse.json({
            ok: false,
            status: "error",
            error: `Vitest exited with code ${code}`,
            details: stderr || stdout.substring(0, 1000),
            summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
            testFiles: [],
            timestamp: new Date().toISOString(),
          }, { status: 500 }));
          return;
        }
        
        // If we couldn't parse but exit code is 0, still return error
        if (!results) {
          resolve(NextResponse.json({
            ok: false,
            status: "error",
            error: "Could not parse test results",
            details: stdout.substring(0, 500),
            summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
            testFiles: [],
            timestamp: new Date().toISOString(),
          }, { status: 500 }));
          return;
        }
        
        // Process results (same as before)
        const totalTests = results.numTotalTests || 0;
        const passedTests = results.numPassedTests || 0;
        const failedTests = results.numFailedTests || 0;
        const skippedTests = results.numPendingTests || 0;
        const allPassed = failedTests === 0 && totalTests > 0 && results.success !== false;
        
        const fileResults = (results.testResults || []).map((file: any) => {
          const passing = file.assertionResults?.filter((r: any) => r.status === "passed").length || 0;
          const failing = file.assertionResults?.filter((r: any) => r.status === "failed").length || 0;
          const skipped = file.assertionResults?.filter((r: any) => r.status === "skipped" || r.status === "pending").length || 0;
          
          const tests = (file.assertionResults || []).map((test: any) => ({
            title: test.title || "Untitled test",
            fullName: test.fullName || test.title,
            status: test.status,
            category: test.ancestorTitles?.[0] || "Other",
            subcategory: test.ancestorTitles?.[1] || null,
            duration: test.duration || 0,
            failureMessages: test.failureMessages || [],
          }));
          
          const testsByCategory: Record<string, typeof tests> = {};
          tests.forEach((test: any) => {
            const cat = test.category;
            if (!testsByCategory[cat]) testsByCategory[cat] = [];
            testsByCategory[cat].push(test);
          });
          
          const filePath = file.name || "unknown";
          const relativePath = filePath.replace(workingDir, "").replace(/^\//, "") || filePath.replace(cwd, "").replace(/^\//, "") || "unknown";
          return {
            path: relativePath,
            numPassingTests: passing,
            numFailingTests: failing,
            numSkippedTests: skipped,
            status: failing > 0 ? "failed" : passing > 0 ? "passed" : "skipped",
            tests,
            testsByCategory,
            categories: Object.keys(testsByCategory),
          };
        });
        
        resolve(NextResponse.json({
          ok: true,
          status: allPassed ? "passing" : "failing",
          summary: { total: totalTests, passed: passedTests, failed: failedTests, skipped: skippedTests },
          testFiles: fileResults,
          timestamp: new Date().toISOString(),
        }));
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeout);
        resolve(NextResponse.json({
          ok: false,
          status: "error",
          error: error.message || "Failed to spawn vitest process",
          summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
          testFiles: [],
          timestamp: new Date().toISOString(),
        }, { status: 500 }));
      });
    });

    // Vitest JSON reporter outputs JSON at the end
    // Find the JSON object in the output (it's the last line)
    const lines = stdout.trim().split("\n");
    let results: any = null;
    
    // Try to parse the last line as JSON
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{")) {
        try {
          results = JSON.parse(line);
          break;
        } catch (e) {
          // Continue searching
        }
      }
    }
    
    if (!results) {
      return NextResponse.json({
        ok: false,
        status: "error",
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        },
        testFiles: [],
        timestamp: new Date().toISOString(),
        error: "Could not parse test results from output",
      });
    }

    // Extract test status from Vitest JSON format
    const totalTests = results.numTotalTests || 0;
    const passedTests = results.numPassedTests || 0;
    const failedTests = results.numFailedTests || 0;
    const skippedTests = results.numPendingTests || 0; // Vitest uses "pending" for skipped

    const allPassed = failedTests === 0 && totalTests > 0 && results.success !== false;

    // Format test file results from testResults array with detailed test information
    const fileResults = (results.testResults || []).map((file: any) => {
      const passing = file.assertionResults?.filter((r: any) => r.status === "passed").length || 0;
      const failing = file.assertionResults?.filter((r: any) => r.status === "failed").length || 0;
      const skipped = file.assertionResults?.filter((r: any) => r.status === "skipped" || r.status === "pending").length || 0;
      
      // Extract test categories and descriptions
      const tests = (file.assertionResults || []).map((test: any) => {
        // Get category from ancestorTitles (e.g., ["calculateTotals"] or ["SKU Generation", "generateSKU"])
        const category = test.ancestorTitles?.[0] || "Other";
        const subcategory = test.ancestorTitles?.[1] || null;
        
        return {
          title: test.title || "Untitled test",
          fullName: test.fullName || test.title,
          status: test.status,
          category,
          subcategory,
          duration: test.duration || 0,
          failureMessages: test.failureMessages || [],
        };
      });
      
      // Group tests by category for better organization
      const testsByCategory: Record<string, typeof tests> = {};
      tests.forEach((test: any) => {
        const cat = test.category;
        if (!testsByCategory[cat]) {
          testsByCategory[cat] = [];
        }
        testsByCategory[cat].push(test);
      });
      
      return {
        path: file.name?.replace(projectRoot, "") || "unknown",
        numPassingTests: passing,
        numFailingTests: failing,
        numSkippedTests: skipped,
        status: failing > 0 ? "failed" : passing > 0 ? "passed" : "skipped",
        tests,
        testsByCategory,
        categories: Object.keys(testsByCategory),
      };
    });

    return NextResponse.json({
      ok: true,
      status: allPassed ? "passing" : "failing",
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
      },
      testFiles: fileResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Provide more detailed error information
    const errorMessage = error.message || "Failed to run tests";
    const stderr = error.stderr || "";
    const stdout = error.stdout || "";
    
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error: errorMessage,
        details: stderr || stdout || undefined,
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        },
        testFiles: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

