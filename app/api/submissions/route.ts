import { NextRequest, NextResponse } from "next/server";
import {
  getServerSupabase,
  SUBMISSIONS_TABLE,
  type Submission,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Shape returned to the client (kept camelCase for backwards compatibility).
function toClient(row: Submission) {
  return {
    id: row.id,
    guestName: row.guest_name,
    challenge: row.challenge,
    caption: row.caption ?? "",
    imageUrl: row.image_url,
    timestamp: row.created_at,
  };
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(SUBMISSIONS_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json((data ?? []).map(toClient));
  } catch (error) {
    console.error("Fetch submissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const guestName =
      typeof body.guestName === "string" ? body.guestName.trim() : "";
    const challenge =
      typeof body.challenge === "string" ? body.challenge.trim() : "";
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!guestName || !challenge || !imageUrl) {
      return NextResponse.json(
        { error: "guestName, challenge, and imageUrl are required" },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from(SUBMISSIONS_TABLE)
      .insert({
        guest_name: guestName,
        challenge,
        caption: caption || null,
        image_url: imageUrl,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(toClient(data as Submission), { status: 201 });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 },
    );
  }
}
