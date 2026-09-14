import type { API } from "homebridge";
import { SelvePlatform } from "./selve-platform.js";

const PLATFORM_NAME = "selve";

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, SelvePlatform);
};
