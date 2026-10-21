import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const tranId = form.get("tran_id");
  const search = new URLSearchParams({ status: "verification-pending" });
  if (typeof tranId === "string" && tranId.length <= 100) search.set("reference", tranId);
  return NextResponse.redirect(new URL(`/payments/return?${search}`, request.url), 303);
}
