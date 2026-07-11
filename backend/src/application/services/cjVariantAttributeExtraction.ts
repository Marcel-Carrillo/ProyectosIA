export interface CjVariantAttributeInput {
  variantKey?: string;
  variantNameEn?: string;
  variantProperty?: string;
}

export interface VariantAttributes {
  size: string | null;
  color: string | null;
}

const ALPHA_SIZE_TOKENS = new Set([
  'xs',
  's',
  'm',
  'l',
  'xl',
  'xxl',
  'xxxl',
  '2xl',
  '3xl',
  '4xl',
  'one size',
  'free size',
]);

function isSizeToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (ALPHA_SIZE_TOKENS.has(lower)) return true;
  if (/^\d{1,3}$/.test(trimmed)) return true;
  if (/^eu\s?\d{2}$/i.test(trimmed)) return true;
  return false;
}

function parseVariantKey(variantKey: string): VariantAttributes {
  const parts = variantKey
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { size: null, color: null };

  const sizeParts: string[] = [];
  const colorParts: string[] = [];
  for (const part of parts) {
    if (isSizeToken(part)) sizeParts.push(part);
    else colorParts.push(part);
  }

  if (parts.length === 1) {
    if (sizeParts.length === 1) return { size: sizeParts[0]!, color: null };
    return { size: null, color: colorParts[0] ?? null };
  }

  const size = sizeParts.length === 1 ? sizeParts[0]! : null;
  const color = colorParts.length > 0 ? colorParts.join(' ') : null;
  return { size, color };
}

function parseVariantNameEn(variantNameEn: string): VariantAttributes {
  const tokens = variantNameEn.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { size: null, color: null };

  const last = tokens[tokens.length - 1]!;
  if (isSizeToken(last)) {
    const color =
      tokens.length >= 2 && !isSizeToken(tokens[tokens.length - 2]!)
        ? tokens[tokens.length - 2]!
        : null;
    return { size: last, color };
  }

  return { size: null, color: last };
}

function parseVariantProperty(variantProperty: string): VariantAttributes {
  try {
    const parsed = JSON.parse(variantProperty) as Array<{ key?: string; value?: string }>;
    if (!Array.isArray(parsed)) return { size: null, color: null };
    const size = parsed.find((p) => /size/i.test(p.key ?? ''))?.value ?? null;
    const color = parsed.find((p) => /colou?r/i.test(p.key ?? ''))?.value ?? null;
    return { size, color };
  } catch {
    return { size: null, color: null };
  }
}

function mergeAttributes(primary: VariantAttributes, secondary: VariantAttributes): VariantAttributes {
  return {
    size: primary.size ?? secondary.size,
    color: primary.color ?? secondary.color,
  };
}

export function extractCjVariantAttributes(input: CjVariantAttributeInput): VariantAttributes {
  try {
    let result: VariantAttributes = { size: null, color: null };

    if (input.variantKey?.trim()) {
      result = parseVariantKey(input.variantKey.trim());
    }

    if (input.variantNameEn?.trim() && (result.size === null || result.color === null)) {
      result = mergeAttributes(result, parseVariantNameEn(input.variantNameEn.trim()));
    }

    if (input.variantProperty?.trim() && (result.size === null || result.color === null)) {
      result = mergeAttributes(result, parseVariantProperty(input.variantProperty.trim()));
    }

    return result;
  } catch {
    return { size: null, color: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractCjVariantAttributesFromRawPayload(rawPayload: unknown): VariantAttributes {
  if (!isRecord(rawPayload) || !isRecord(rawPayload.variant)) {
    return { size: null, color: null };
  }
  const variant = rawPayload.variant;
  return extractCjVariantAttributes({
    variantKey: typeof variant.variantKey === 'string' ? variant.variantKey : undefined,
    variantNameEn: typeof variant.variantNameEn === 'string' ? variant.variantNameEn : undefined,
    variantProperty: typeof variant.variantProperty === 'string' ? variant.variantProperty : undefined,
  });
}
