import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/gun-eth.min.js',
      format: 'umd',
      name: 'GunEth',
    }
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['browser', 'module', 'main']
    }),
    commonjs({
      ignore: ['url', 'path', 'fs', 'crypto'],
      requireReturnsDefault: 'auto',
      transformMixedEsModules: true
    }),
    json(),
    terser()
  ]
};