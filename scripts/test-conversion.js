const { toSimplified } = require('./src/lib/chinese');

// Mock OpenCC since it is an ES module and we are running in a simple node script that might need transpiration
// Actually, since we are in a Next.js env, let's try to run it via ts-node or just check the pure JS behavior if possible,
// but our file is TS.
// Let's create a temporary test file that we can run with `ts-node` or `pnpm tsx` if available, or just rely on the build check.

console.log('Testing Traditional -> Simplified conversion:');
const inputs = ['這是一個測試', '搜尋繁體中文', '蝙蝠俠'];
const expected = ['这是一个测试', '搜寻繁体中文', '蝙蝠侠'];
// Note: opencc might convert 搜尋 to 搜索 or keep as 搜寻 depending on dictionary.
// "搜尋" (TW) -> "搜寻" (CN) seems standard for HK->CN or T->CN.
// "搜索" is also common.

(async () => {
  // We need to dynamically import because opencc-js is likely ESM
  // But our tsconfig might be set to commonjs or esnext.
  // Let's try to use the build process or just trust the library if the type check passes.

  // Actually, let's just create a small file that imports the library directly to test usage.
  const OpenCC = require('opencc-js');
  const converter = OpenCC.Converter({ from: 't', to: 'cn' });

  for (const input of inputs) {
    console.log(`${input} -> ${converter(input)}`);
  }
})();
