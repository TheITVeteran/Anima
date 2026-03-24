const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const LIB_DIR = path.resolve(__dirname, "../public/static/lib");
const BACKUP_DIR = path.resolve(__dirname, "../public/static/lib_backup");

const SKIP_FILES = new Set([
  "numjs.min.js",
  "mp4box.all.min.js",
  "ola-processor.js",
  "phase-vocoder.js",
  "fft.js",
  "renderer_webglZ_for_debug.js",
]);

const OBFUSCATOR_CONFIG = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  selfDefending: false,
  stringArray: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  numbersToExpressions: false,
  simplify: true,
  splitStrings: false,
  target: "browser",
  log: false,

  reservedNames: [
    "WebGLRenderer",
    "WebGLRendererW",
    "WebGLRendererZ",
    "Renderer",
    "RendererMain",
    "DecoderMain",
    "WorkerInterface",
    "CardManager",
    "DataProcessor",
    "AudioPlayer",
    "SystemInfo",
    "WebRTCStreamer",
    "VideoControl",
    "numjs",
    "UPNG",
    "importScripts",
    "postMessage",
    "onmessage",
    "handleMessage",
    "registerProcessor",
  ],
};

function backupFiles() {
  if (fs.existsSync(BACKUP_DIR)) {
    console.log(`Backup directory already exists: ${BACKUP_DIR}`);
    console.log("Skipping backup (use --force-backup to overwrite).");
    if (!process.argv.includes("--force-backup")) return;
    fs.rmSync(BACKUP_DIR, { recursive: true });
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = fs.readdirSync(LIB_DIR).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    fs.copyFileSync(path.join(LIB_DIR, file), path.join(BACKUP_DIR, file));
  }
  console.log(`Backed up ${files.length} files to lib_backup/`);
}

function restoreFiles() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error("No backup found! Cannot restore.");
    process.exit(1);
  }
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    fs.copyFileSync(path.join(BACKUP_DIR, file), path.join(LIB_DIR, file));
  }
  console.log(`Restored ${files.length} files from lib_backup/`);
}

function obfuscateFiles() {
  const files = fs.readdirSync(LIB_DIR).filter((f) => f.endsWith(".js"));
  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    if (SKIP_FILES.has(file)) {
      console.log(`  SKIP: ${file}`);
      skipped++;
      continue;
    }

    const filePath = path.join(LIB_DIR, file);
    const code = fs.readFileSync(filePath, "utf-8");
    const originalSize = Buffer.byteLength(code, "utf-8");

    try {
      const result = JavaScriptObfuscator.obfuscate(code, {
        ...OBFUSCATOR_CONFIG,
        inputFileName: file,
        sourceMap: false,
      });
      const obfuscated = result.getObfuscatedCode();
      const newSize = Buffer.byteLength(obfuscated, "utf-8");
      fs.writeFileSync(filePath, obfuscated, "utf-8");
      const ratio = ((newSize / originalSize) * 100).toFixed(0);
      console.log(
        `  OK:   ${file}  ${(originalSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB (${ratio}%)`
      );
      processed++;
    } catch (err) {
      console.error(`  FAIL: ${file} — ${err.message}`);
    }
  }

  console.log(`\nDone: ${processed} obfuscated, ${skipped} skipped.`);
}

const cmd = process.argv[2];
if (cmd === "restore") {
  restoreFiles();
} else if (cmd === "backup") {
  backupFiles();
} else {
  backupFiles();
  console.log("\nObfuscating...\n");
  obfuscateFiles();
}
