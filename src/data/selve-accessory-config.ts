import { AccessoryConfig } from 'homebridge';

export interface SelveAcessoryConfig extends AccessoryConfig {
    device?: number,
    showIntermediate1?: boolean,
    showIntermediate2?: boolean
}