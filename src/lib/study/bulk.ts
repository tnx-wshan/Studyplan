/** "앞면 - 뒷면" 형식 (구분: 탭, " - ", ":", "=") 으로 한 줄에 한 장씩 */
export function parseBulk(text: string): { front: string; back: string }[] {
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/^(.+?)\s*(?:\t| - |:|=)\s*(.+)$/);
      return m ? { front: m[1].trim(), back: m[2].trim() } : null;
    })
    .filter((x): x is { front: string; back: string } => !!x && !!x.front && !!x.back);
}
