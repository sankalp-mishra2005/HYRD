import mammoth from "mammoth";

export interface ExtractedResumeInput {
  fileName: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "text/plain";
  text: string;
  pdfBase64?: string;
}

/**
 * Validates file buffer magic bytes to prevent file extension spoofing
 */
export function validateFileMagicBytes(buffer: Buffer, originalName: string): "pdf" | "docx" | "txt" {
  if (!buffer || buffer.length === 0) {
    throw new Error("Uploaded file is empty");
  }

  const lower = originalName.toLowerCase();

  // If claimed to be PDF: MUST have PDF signature: %PDF-
  if (lower.endsWith(".pdf")) {
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return "pdf";
    }
    throw new Error(`Invalid PDF file format. "${originalName}" is missing standard PDF header signature.`);
  }

  // If claimed to be DOCX: MUST have Zip PK signature
  if (lower.endsWith(".docx")) {
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return "docx";
    }
    throw new Error(`Invalid DOCX file format. "${originalName}" is missing standard DOCX archive signature.`);
  }

  // Check magic bytes regardless of extension
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "pdf";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "docx";
  }

  // Check if plain text (no null bytes in sample)
  const sampleLength = Math.min(buffer.length, 1024);
  let isBinary = false;
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) {
      isBinary = true;
      break;
    }
  }

  if (!isBinary && (lower.endsWith(".txt") || !lower.includes("."))) {
    return "txt";
  }

  throw new Error(
    `Unsupported or corrupted file format for "${originalName}". Only authentic PDF, DOCX, and TXT files are accepted.`
  );
}

/**
 * Extracts raw textual content and metadata from the resume file buffer
 */
export async function extractResumeContent(
  buffer: Buffer,
  originalName: string
): Promise<ExtractedResumeInput> {
  const detectedType = validateFileMagicBytes(buffer, originalName);

  if (detectedType === "pdf") {
    // For PDFs, we retain the base64 representation for Gemini's native PDF parser
    const pdfBase64 = buffer.toString("base64");
    return {
      fileName: originalName,
      mimeType: "application/pdf",
      text: "",
      pdfBase64,
    };
  }

  if (detectedType === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value.trim();

      if (!rawText) {
        throw new Error("Unable to extract text from Word document. The document appears empty or corrupted.");
      }

      return {
        fileName: originalName,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: rawText,
      };
    } catch (docxErr: any) {
      throw new Error(`Failed to parse DOCX document: ${docxErr.message || docxErr}`);
    }
  }

  // Plain Text
  const rawText = buffer.toString("utf-8").trim();
  if (!rawText) {
    throw new Error("Uploaded text resume is empty");
  }

  return {
    fileName: originalName,
    mimeType: "text/plain",
    text: rawText,
  };
}
