import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/orgazme";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getWorkspaceSnapshot());
  } catch (error) {
    console.error("bootstrap_failed", error);
    return NextResponse.json(
      { error: "Не удалось загрузить рабочее пространство." },
      { status: 500 },
    );
  }
}
