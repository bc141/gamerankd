// src/lib/copy.ts
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall back */ }
  
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }