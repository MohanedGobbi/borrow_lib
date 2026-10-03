const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SCANNED = new RegExp(`(?:^|/scan/)(${UUID})/?\\s*$`, "i");

/**
 * The member a library card points to, when the text is what a card scanner types: the card's link
 * (`…/scan/<uuid>`) or the bare UUID. Keyboard-wedge scanners type it and press Enter.
 */
export function scannedMemberId(text: string): string | null {
  return SCANNED.exec(text.trim())?.[1].toLowerCase() ?? null;
}
