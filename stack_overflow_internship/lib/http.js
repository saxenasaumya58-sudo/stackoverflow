import { NextResponse } from "next/server";

export function errorResponse(error) {
  const status = error.status || (error.name === "ValidationError" ? 400 : error.code === 11000 ? 409 : 500);
  const message = status === 500 && process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message || "Request failed.";
  if (status === 500) console.error(error);
  return NextResponse.json({ error: message }, { status });
}
export function requireFields(body, fields) {
  for (const field of fields) if (typeof body[field] !== "string" || !body[field].trim()) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
}