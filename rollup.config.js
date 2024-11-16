import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

export default [
  // Browser bundle (UMD)
  {
    input: 'src/browser/gun-eth-browser.js',
    output: [
      {
        file: 'dist/gun-eth.min.js',
        format: 'umd',
        name: 'GunEth',
        globals: {
          'gun': 'Gun',
          'gun/sea': 'SEA',
          'ethers': 'ethers'
        }
      }
    ],
    external: ['gun', 'gun/sea', 'ethers'],
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      json(),
      terser()
    ]
  },
  
  // ESM bundle
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/gun-eth.esm.js',
        format: 'es'
      }
    ],
    external: ['gun', 'gun/sea', 'ethers'],
    plugins: [
      resolve(),
      commonjs(),
      json()
    ]
  },
  
  // CommonJS bundle
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/gun-eth.cjs.js',
        format: 'cjs'
      }
    ],
    external: ['gun', 'gun/sea', 'ethers'],
    plugins: [
      resolve(),
      commonjs(),
      json()
    ]
  }
]; 