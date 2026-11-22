import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/session";
import { entryIdParamSchema } from "@/lib/srs/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/vault/[entryId]">,
) {
  const auth = await requireApiUser();
  if (auth.response) {
    return auth.response;
  }

  const { entryId } = await context.params;
  const parsed = entryIdParamSchema.safeParse(entryId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete vault entry:", error);
    return NextResponse.json(
      { error: "Failed to delete vocabulary entry." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted_id: data.id });
}
