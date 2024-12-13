import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';

// Plugin personalizzato per escludere i moduli di Gun
function excludeGunModules() {
  return {
    name: 'exclude-gun-modules',
    resolveId(source) {
      if (source === 'gun' || source.startsWith('gun/')) {
        return { id: source, external: true };
      }
      return null;
    }
  };
}

// Configurazione base dei plugin
const basePlugins = {
  browser: [
    excludeGunModules(),
    replace({
      preventAssignment: true,
      delimiters: ['', ''],
      values: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'global.TextEncoder': 'window.TextEncoder',
        'global.TextDecoder': 'window.TextDecoder',
        'process.nextTick': 'setTimeout',
        'setImmediate': 'setTimeout',
        'require("path")': '{}',
        'require("fs")': '{}',
        'require("crypto")': '{}',
        'require("util")': '{}',
        'module.createRequire': '(function() { return function() { return {}; }; })',
        'import.meta.url': '"file://"'
      }
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      mainFields: ['browser', 'module', 'main'],
      extensions: ['.js', '.json']
    }),
    commonjs({
      transformMixedEsModules: true,
      ignoreDynamicRequires: true,
      ignore: ['path', 'fs', 'util', 'crypto'],
      requireReturnsDefault: 'auto'
    }),
    json({
      compact: true,
      preferConst: true,
      namedExports: true
    }),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: [
        ['@babel/preset-env', {
          targets: {
            browsers: '> 0.25%, not dead'
          },
          modules: false
        }]
      ]
    })
  ],
  server: [
    excludeGunModules(),
    resolve({ 
      preferBuiltins: true,
      mainFields: ['module', 'main']
    }),
    commonjs(),
    json(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**'
    })
  ]
};

// Configurazioni di build
const config = [
  // Browser Bundle
  {
    input: 'src/browser.js',
    output: {
      file: 'dist/gun-eth.bundle.js',
      format: 'umd',
      name: 'GunEth',
      extend: true,
      globals: {
        'gun': 'Gun',
        'gun/sea': 'SEA',
        'ethers': 'ethers'
      },
      banner: `
        var process = { env: { NODE_ENV: '${process.env.NODE_ENV}' }, browser: true };
        var global = window;
        var Buffer = { isBuffer: function() { return false; } };
        var module = { exports: {}, createRequire: function() { return function() { return {}; }; } };
        var require = function(mod) { 
          if (mod === 'gun') return Gun;
          if (mod === 'gun/sea') return SEA;
          if (mod === 'ethers') return ethers;
          return {};
        };
      `,
      footer: `
        // Esporta GunEth globalmente
        if (typeof window !== 'undefined') {
          window.GunEth = GunEth;
        }
      `,
      inlineDynamicImports: true
    },
    external: ['gun', 'gun/sea', 'ethers'],
    plugins: [
      ...basePlugins.browser,
      process.env.NODE_ENV === 'production' && terser()
    ].filter(Boolean),
    onwarn(warning, warn) {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      if (warning.code === 'MISSING_NODE_BUILTINS') return;
      if (warning.code === 'MISSING_GLOBAL_NAME') return;
      warn(warning);
    }
  },

  // Server Bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gun-eth.cjs',
      format: 'cjs',
      exports: 'named'
    },
    external: [
      'gun',
      'gun/sea',
      'ethers',
      'path',
      'fs',
      'url',
      'crypto',
      'util',
      'fs/promises'
    ],
    plugins: basePlugins.server
  }
];

export default config;