import type { API } from "homebridge";
import { SelvePlatform } from "./selve-platform.js";

const PLATFORM_NAME = "selve";

export default (api: API): void => {
  if (Number(process.versions.node.split(".")[0]) === 26 && !api.versionGreaterOrEqual("2.3.0")) {
    throw new Error("Selve on Node.js 26 requires Homebridge 2.3.0 or newer; upgrade Homebridge or use Node.js 24.");
  }
  api.registerPlatform(PLATFORM_NAME, SelvePlatform);
};
