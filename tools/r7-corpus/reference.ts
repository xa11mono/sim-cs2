// Type-checked interface over the actual SIM-CS2 reference kernels.
type Operation = 0 | 1 | 2;
type ReferenceResult = number | number[] | null;
type Capture = (operation: Operation, result: ReferenceResult, args: unknown[], tick: number, parameters: number[]) => void;

export function floatBits(value: number): string {
  if (typeof value !== 'number') throw new TypeError('Expected an IEEE 754 number');
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleLE(value);
  return bytes.toString('hex');
}

export function loadEngine(source: string, capture?: Capture): (expression: string) => unknown {
  if (capture) {
    for (const [kind, name, parameters] of [
      [0, 'knownSegCost', '[KNOWN_PATH_R, KNOWN_DETOUR, KNOWN_CLOSE_K]'],
      [1, 'm3SegTri', '[]'],
      [2, 'm3BoxPlanes', '[M3_SKIN]'],
    ] as const) {
      const declaration = new RegExp(`function ${name}\\(([^)]*)\\)\\s*\\{`, 'g');
      if ([...source.matchAll(declaration)].length !== 1) throw new Error('Cannot locate ' + name);
      source = source.replace(declaration, (_, args) => `
        function ${name}(...args) {
          const result = r7_${name}(...args);
          __capture(${kind}, result, args, typeof tick === 'number' ? tick : 0, ${parameters});
          return result;
        }
        function r7_${name}(${args}) {`);
    }
  }
  const engine = new Function('__capture', source + '\nreturn globalThis.__ev;')(capture);
  delete (globalThis as typeof globalThis & { __ev?: unknown }).__ev;
  if (typeof engine !== 'function') throw new Error('Expected a fresh Node core build');
  return engine;
}

export function runReference(engine: ReturnType<typeof loadEngine>, operation: Operation, input: number[]): ReferenceResult {
  // Source construction preserves negative zero and avoids serializing numbers as JSON null.
  const args = input.map(x => Object.is(x, -0) ? '-0' : String(x)).join(',');
  const xyz = `const X = [${args}];`;
  switch (operation) {
    case 0:
      return engine(`(() => {${xyz}
        if (X[7] !== KNOWN_PATH_R || X[8] !== KNOWN_DETOUR || X[9] !== KNOWN_CLOSE_K) throw Error('Navigation constants differ');
        return knownSegCost({x:X[0], y:X[1]}, {x:X[2], y:X[3]}, {x:X[4], y:X[5], w:X[6]});
      })()`) as number;
    case 1:
      return engine(`(() => {${xyz} return m3SegTri({tri:X.slice(0, 9)}, 0, ...X.slice(9)); })()`) as number;
    case 2:
      return engine(`(() => {${xyz}
        if (X[7] !== M3_SKIN) throw Error('Grenade skin constant differs');
        return m3BoxPlanes(X.slice(8), ...X.slice(0, 7));
      })()`) as number[] | null;
    default:
      throw new Error('Unknown operation');
  }
}
