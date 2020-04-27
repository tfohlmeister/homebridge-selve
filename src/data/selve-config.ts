import { AccessoryConfig } from 'homebridge';

export interface SelveShutterAcessoryConfig extends AccessoryConfig {
    port?: string,
    device?: number,
    baud?: number
}