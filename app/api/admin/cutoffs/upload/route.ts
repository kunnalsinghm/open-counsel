import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { runIngestion } from "@/lib/ingestion/import-core";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — plenty for a round's worth of cutoffs

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const formData = await req.formData();
  const file = formData.get("file");
  const examSystemCode = (formData.get("examSystemCode") as string) || "JOSAA";
  const dataVersion = (formData.get("dataVersion") as string) || `upload-${Date.now()}`;
  const shouldCommit = formData.get("commit") === "true";
  const shouldOverwrite = formData.get("overwrite") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected a 'file' field containing a CSV." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only .csv files are accepted." }, { status: 400 });
  }

  const content = await file.text();

  const result = await runIngestion(content, {
    examSystemCode,
    dataVersion,
    sourceDocument: file.name,
    shouldCommit,
    shouldOverwrite,
  });

  if ("fileError" in result) {
    return NextResponse.json({ error: result.fileError }, { status: 400 });
  }

  return NextResponse.json({
    totalRows: result.totalRows,
    validRows: result.validRows,
    errors: result.errors,
    warnings: result.warnings,
    newInstitutes: result.newInstitutes,
    newBranches: result.newBranches,
    committed: result.committed,
    inserted: result.inserted,
    updated: result.updated,
    skippedAsDuplicateOfPublished: result.skippedAsDuplicateOfPublished,
  });
}