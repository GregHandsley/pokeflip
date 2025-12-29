import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { path } = (await req.json()) as { path?: string };
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.storage.from("card-photos").createSignedUrl(path, 60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl });
}

