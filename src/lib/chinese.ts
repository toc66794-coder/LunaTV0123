/* eslint-disable @typescript-eslint/no-var-requires */
const OpenCC = require('opencc-js');

// Initialize the converter for Traditional to Simplified Chinese
const converter = OpenCC.Converter({ from: 't', to: 'cn' });

export function toSimplified(text: string): string {
  if (!text) return text;
  return converter(text);
}
