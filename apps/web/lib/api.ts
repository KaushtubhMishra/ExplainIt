import { NextResponse } from "next/server";

// Every API error has the same shape: { error: { code, message, details? } } (see the API Design doc).
export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
}
