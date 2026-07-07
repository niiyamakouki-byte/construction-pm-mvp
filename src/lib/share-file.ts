/**
 * Native share-sheet-first file delivery, falling back to a manual download
 * link when the Web Share API (or file sharing support) isn't available.
 *
 * Extracted from DocumentsPageImpl's existing share/download flow so other
 * features (e.g. exporting an annotated PDF page as PNG) can reuse the same
 * UX without needing a ProjectDocument to fetch first.
 */
export async function shareOrDownloadFile(file: File): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], title: file.name });
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
