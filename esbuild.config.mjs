import esbuild from "esbuild";
import process from "process";

const prod = process.argv.includes("production");

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  target: "es2022",
  platform: "browser",
  sourcemap: prod ? false : "inline",
  minify: prod,
  external: ["obsidian", "electron"]
});

console.log(prod ? "Production build done" : "Dev build done");