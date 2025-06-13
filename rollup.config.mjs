export default {
  input: "src/index.js",
  output: {
    file: "out.js",
    format: "esm",
    generatedCode: "es2015",
    preserveModules: false,
  },
  // Not ideal, but the build may remove functions that are declared but not used.
  // However, Google App Scripts uses the declarations as entry points. With Treeshake enabled,
  // the declarations would be removed.
  treeshake: false,
};
