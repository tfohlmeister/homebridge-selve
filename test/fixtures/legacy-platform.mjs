// The static accessory shape exposed by Selve 3.0.0, without USB I/O.
// Homebridge itself generates and persists the legacy AIDs/IIDs for this fixture.
export default api => {
  api.registerPlatform('selve', class {
    constructor(log, config) {
      this.config = config;
    }
    accessories(callback) {
      callback(this.config.shutters.map(config => ({
        name: config.name,
        getServices() {
          const {Service, Characteristic} = api.hap;
          const covering = new Service.WindowCovering(config.name);
          covering.getCharacteristic(Characteristic.ObstructionDetected);
          return [
            new Service.AccessoryInformation()
              .setCharacteristic(Characteristic.Manufacturer, 'Selve')
              .setCharacteristic(Characteristic.Model, 'Selve')
              .setCharacteristic(Characteristic.SerialNumber, config.name),
            covering,
            config.showIntermediate1 ? new Service.Switch(`${config.name} Position 1`, '1') : null,
            config.showIntermediate2 ? new Service.Switch(`${config.name} Position 2`, '2') : null,
            config.showStop ? new Service.Switch(`${config.name} Stop`, '3') : null,
          ].filter(Boolean);
        },
      })));
    }
  });
};
