const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

let html2PdfPromise = null;

export function ensureHtml2Pdf() {
  if (typeof window.html2pdf === 'function') return Promise.resolve(window.html2pdf);
  if (html2PdfPromise) return html2PdfPromise;

  html2PdfPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = HTML2PDF_URL;
    script.async = true;
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => {
      html2PdfPromise = null;
      reject(new Error('PDF_LIBRARY_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return html2PdfPromise;
}
