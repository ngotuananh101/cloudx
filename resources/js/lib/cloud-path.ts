export function encodeCloudPath(path: string): string {
    const bytes = new TextEncoder().encode(path);
    let binary = '';

    bytes.forEach((byte) => {
        binary += String.fromCodePoint(byte);
    });

    // Base64url without padding — avoid regex backtracking on trailing '='.
    let encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_');

    while (encoded.endsWith('=')) {
        encoded = encoded.slice(0, -1);
    }

    return encoded;
}
