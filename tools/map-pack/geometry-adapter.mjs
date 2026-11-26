// Used only on generated test builds. Reuse the original m3Load body and
// accept raw zlib bytes at the same boundary as its legacy base64 decoder.
export function enableBinaryGeometry(source) {
  const marker = /function arr\(b64, (\w+)\)\s*\{/g;
  if ([...source.matchAll(marker)].length !== 1) throw new Error('m3Load decoder changed');
  return source.replace(marker, (declaration, constructor) => declaration + `
    if (b64 instanceof Uint8Array) {
      const uncompressed = inflate(b64);
      return new ${constructor}(uncompressed.buffer.slice(uncompressed.byteOffset, uncompressed.byteOffset + uncompressed.byteLength));
    }`);
}
