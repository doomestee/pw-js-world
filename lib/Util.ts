export function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a === b) {
        return true
    }

    if (a.byteLength !== b.byteLength) {
        return false
    }

    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}