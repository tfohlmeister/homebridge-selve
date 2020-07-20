import { AccessoryConfig } from 'homebridge';

export interface SelveShutterAcessoryConfig extends AccessoryConfig {
    port?: string,
    device?: number,
    showIntermediate1?: boolean,
    showIntermediate2?: boolean
}