import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice} from '../TuyaWebApi';
import debounce from 'lodash.debounce';
import {DebouncedPromise} from '../helpers/DebouncedPromise';
import {BrightnessCharacteristic, HueCharacteristic, SaturationCharacteristic} from './characteristics';
import {Characteristic} from 'hap-nodejs';


export abstract class ColorAccessory<DeviceConfig extends TuyaDevice = TuyaDevice> extends BaseAccessory<DeviceConfig> {
  private async setRemoteColor(color: { hue: number, saturation: number }): Promise<void> {
    const cachedBrightness = this.getCachedState(Characteristic.Brightness);
    const brightness = Number(cachedBrightness ? cachedBrightness : BrightnessCharacteristic.DEFAULT_VALUE);
    const tuyaData = {
      hue: color.hue,
      saturation: color.saturation / 100,
      brightness,
    };

    await this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'colorSet', {color: tuyaData});

  }

    private setColorDebounced = debounce(() => {
      const {resolve, reject} = this.debouncePromise!;
      this.debouncePromise = undefined;
      const hue = Number(this.hue !== undefined ? this.hue : HueCharacteristic.DEFAULT_VALUE);
      const saturation = Number(this.saturation !== undefined ? this.saturation : SaturationCharacteristic.DEFAULT_VALUE);
      this.setRemoteColor({hue, saturation}).then(resolve).catch(reject);
    }, 100, {maxWait: 500});


    private debouncePromise?: DebouncedPromise<void>
    private hue?: number;
    private saturation?: number;

    public setColor(color: Partial<{ hue: number, saturation: number }>): Promise<void> {
      if (!this.debouncePromise) {
        this.debouncePromise = new DebouncedPromise<void>();
      }

      this.hue = color.hue !== undefined ? color.hue : this.hue;
      this.saturation = color.saturation !== undefined ? color.saturation : this.saturation;

      this.setColorDebounced();

      return this.debouncePromise.promise;
    }
}
