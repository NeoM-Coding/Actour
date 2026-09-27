const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const piEnvShim = path.resolve(__dirname, "src/piEnvApiKeysShim.js");
const piRegisterShim = path.resolve(
  __dirname,
  "src/piRegisterBuiltinsShim.js",
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.endsWith("env-api-keys.js") &&
    context.originModulePath.includes("pi-ai")
  ) {
    return { type: "sourceFile", filePath: piEnvShim };
  }
  if (
    moduleName.endsWith("providers/register-builtins.js") &&
    context.originModulePath.includes("pi-ai")
  ) {
    return { type: "sourceFile", filePath: piRegisterShim };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
