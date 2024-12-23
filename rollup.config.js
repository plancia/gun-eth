import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";

const basePlugins = [
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: true,
    declarationDir: "./dist",
    rootDir: "./src",
    allowJs: true,
    checkJs: true,
    emitDeclarationOnly: true,
    outDir: "./dist",
  }),
  replace({
    preventAssignment: true,
    delimiters: ["", ""],
    values: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      "global.TextEncoder": "window.TextEncoder",
      "global.TextDecoder": "window.TextDecoder",
      "process.nextTick": "setTimeout",
      setImmediate: "setTimeout",
      'require("path")': "{}",
      'require("fs")': "{}",
      'require("crypto")': "{}",
      'require("util")': "{}",
      "module.createRequire":
        "(function() { return function() { return {}; }; })",
      "import.meta.url": '"file://"',
    },
  }),
  resolve({
    browser: true,
    preferBuiltins: false,
    mainFields: ["browser", "module", "main"],
  }),
  commonjs({
    transformMixedEsModules: true,
    ignoreDynamicRequires: true,
    ignore: ["path", "fs", "util", "crypto"],
  }),
  json(),
  process.env.NODE_ENV === "production" && terser(),
].filter(Boolean);

const external = ["gun", "gun/sea", "ethers"];
const globals = {
  gun: "Gun",
  "gun/sea": "SEA",
  ethers: "ethers",
};

export default [
  // Browser Bundle (UMD)
  {
    input: "src/browser.js",
    output: {
      file: "dist/gun-eth.bundle.js",
      format: "umd",
      name: "GunEth",
      globals,
      inlineDynamicImports: true,
    },
    external,
    plugins: basePlugins,
  },

  // CommonJS
  {
    input: "src/index.js",
    output: {
      file: "dist/gun-eth.cjs",
      format: "cjs",
      exports: "named",
      inlineDynamicImports: true,
    },
    external,
    plugins: basePlugins,
  },

  // ES Module
  {
    input: "src/browser.js",
    output: {
      file: "dist/gun-eth.mjs",
      format: "es",
      inlineDynamicImports: true,
    },
    external,
    plugins: basePlugins,
  },
];
