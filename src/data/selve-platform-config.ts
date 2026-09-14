import { PlatformConfig } from "homebridge";
import { SelveAcessoryConfig } from "./selve-accessory-config.js";

export interface SelvePlatformConfig extends PlatformConfig {
  usbPort?: string;
  shutters?: Array<SelveAcessoryConfig>;
}
