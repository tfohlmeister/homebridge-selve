import { PlatformConfig } from "homebridge";
import { SelveAcessoryConfig } from "./selve-accessory-config";

export interface SelvePlatformConfig extends PlatformConfig {
  usbPort?: string;
  shutters?: Array<SelveAcessoryConfig>;
}
