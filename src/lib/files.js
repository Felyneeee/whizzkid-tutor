import { isValidPdfDataUrl, MAX_RESUME_BYTES } from "@/lib/resumes";

/** Read a File into a data URL (mock storage — use signed object storage in production). */
export function readFileAsDataURL(file, maxBytes = 1500000) {
    return new Promise((resolve, reject) => {
        if (file.size > maxBytes)
            return reject(new Error(`File is too large for the demo store (max ${(maxBytes / 1000000).toFixed(1)} MB).`));
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file."));
        r.readAsDataURL(file);
    });
}

export async function readPdfAsDataURL(file) {
    if (file.size > MAX_RESUME_BYTES) {
        throw new Error("Resume file exceeds the 600 KB limit. Choose a smaller PDF.");
    }
    const data = await readFileAsDataURL(file, MAX_RESUME_BYTES);
    const payload = data.slice(data.indexOf(",") + 1);
    const pdfData = `data:application/pdf;base64,${payload}`;
    if (!isValidPdfDataUrl(pdfData)) {
        throw new Error("Resume must be a valid PDF file.");
    }
    return pdfData;
}

export function downloadPdfDataUrl(name, data) {
    if (!isValidPdfDataUrl(data)) return false;
    const payload = data.slice(data.indexOf(",") + 1);
    const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    const baseName = (name || "resume").replace(/\.pdf$/i, "").replace(/[^\w.-]/g, "_") || "resume";
    link.href = url;
    link.download = `${baseName}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
}
