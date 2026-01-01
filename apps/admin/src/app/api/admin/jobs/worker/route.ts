import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Worker endpoint to process queued jobs
 * In production, this would be a separate worker process or cron job
 * For v1, we'll call this manually or via a simple cron
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const maxJobs = body.maxJobs || 5;
    const workerId = body.workerId || `worker-${Date.now()}`;

    const supabase = supabaseServer();

    // Claim jobs
    const { data: jobs, error: claimError } = await supabase
      .from("jobs")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: workerId,
      })
      .eq("status", "queued")
      .lte("run_at", new Date().toISOString())
      .select()
      .limit(maxJobs);

    if (claimError) {
      throw claimError;
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No jobs to process",
        processed: 0,
      });
    }

    const results = [];

    for (const job of jobs) {
      try {
        // Log job start
        await supabase.rpc("log_job_event", {
          p_job_id: job.id,
          p_level: "info",
          p_message: `Job started by ${workerId}`,
        });

        if (job.type === "ebay_publish") {
          // eBay integration removed - mark job as failed
          await supabase
            .from("jobs")
            .update({
              status: "failed",
              last_error: "eBay integration has been removed",
              locked_at: null,
              locked_by: null,
            })
            .eq("id", job.id);

          results.push({ 
            jobId: job.id, 
            success: false, 
            error: "eBay integration has been removed" 
          });
        } else {
          // Unknown job type
          await supabase
            .from("jobs")
            .update({
              status: "failed",
              last_error: `Unknown job type: ${job.type}`,
              locked_at: null,
              locked_by: null,
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, success: false, error: "Unknown job type" });
        }
      } catch (error: any) {
        // Job processing error
        const newAttempts = job.attempts + 1;
        const shouldRetry = newAttempts < job.max_attempts;

        await supabase
          .from("jobs")
          .update({
            status: shouldRetry ? "queued" : "failed",
            attempts: newAttempts,
            last_error: error.message || "Processing error",
            locked_at: null,
            locked_by: null,
          })
          .eq("id", job.id);

        await supabase.rpc("log_job_event", {
          p_job_id: job.id,
          p_level: "error",
          p_message: `Processing error: ${error.message}`,
        });

        results.push({ 
          jobId: job.id, 
          success: false, 
          error: error.message || "Processing error",
          lotId: job.payload?.lotId 
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: jobs.length,
      results,
    });
  } catch (error: any) {
    console.error("Error in worker:", error);
    return NextResponse.json(
      { error: error.message || "Worker error" },
      { status: 500 }
    );
  }
}

