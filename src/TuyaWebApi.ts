import {Logger} from 'homebridge';
import axios from 'axios';
import * as querystring from 'querystring';
import debounce from 'lodash.debounce';
import {DebouncedPromise} from './helpers/DebouncedPromise';

class RatelimitError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type TuyaDeviceType = 'light' | 'fan' | 'dimmer' | 'switch' | 'outlet';
export type HomeAssitantDeviceType = 'light' | 'fan' | 'dimmer' | 'switch' | 'outlet';

export type TuyaDeviceState = {
    online: boolean,
};

export type TuyaDevice<State extends TuyaDeviceState = TuyaDeviceState> = {
    data: State,
    name: string,
    id: string,
    dev_type: TuyaDeviceType,
    ha_type: HomeAssitantDeviceType
}

type TuyaHeader = { code: 'SUCCESS', payloadVersion: 1 } | { code: 'FrequentlyInvoke', payloadVersion: 1 };
type DiscoveryPayload = {
    payload: {
        devices: TuyaDevice[]
    },
    header: TuyaHeader
}

export type TuyaApiMethod = 'turnOnOff' | 'brightnessSet' | 'windSpeedSet' | 'colorSet' | 'colorTemperatureSet'
export type TuyaApiPayload<Method extends TuyaApiMethod> = Method extends 'turnOnOff'
    ? { value: 0 | 1 }
    : Method extends 'brightnessSet'
        ? { value: number }
        : Method extends 'windSpeedSet'
            ? { value: number }
            : Method extends 'colorSet'
                ? { color: { hue: number, saturation: number, brightness: number } }
                : Method extends 'colorTemperatureSet'
                    ? { value: number }
                    : never

class Session {
    private _areaBaseUrl!: string;
    private expiresOn!: number;

    constructor(private _accessToken: string, private _refreshToken: string, private expiresIn: number, private _areaCode: string) {
      this.areaCode = _areaCode;
      this.resetToken(_accessToken, _refreshToken, expiresIn);
    }

    public get accessToken(): string {
      return this._accessToken;
    }

    public get areaBaseUrl(): string {
      return this._areaBaseUrl;
    }

    public get refreshToken(): string {
      return this._refreshToken;
    }

    public set areaCode(newAreaCode: string) {
      const areaCodeLookup = {
        'AY': 'https://px1.tuyacn.com',
        'EU': 'https://px1.tuyaeu.com',
        'US': 'https://px1.tuyaus.com',
      };
      this._areaCode = newAreaCode;
      this._areaBaseUrl = areaCodeLookup[newAreaCode] || areaCodeLookup['US'];
    }

    public resetToken(accessToken, refreshToken, expiresIn): void {
      this._accessToken = accessToken;
      this._refreshToken = refreshToken;
      this.expiresOn = Session.getCurrentEpoch() + expiresIn - 100; // subtract 100 ticks to expire token before it actually does
    }

    public hasToken(): boolean {
      return !!this._accessToken;
    }

    public isTokenExpired(): boolean {
      return this.expiresOn < Session.getCurrentEpoch();
    }

    public hasValidToken(): boolean {
      return this.hasToken() && !this.isTokenExpired();
    }

    private static getCurrentEpoch(): number {
      return Math.round((new Date()).getTime() / 1000);
    }
}

export class TuyaWebApi {
    private session: Session | undefined;
    private authBaseUrl = 'https://px1.tuyaeu.com';

    constructor(
        private username: string,
        private password: string,
        private countryCode: string,
        private tuyaPlatform: string = 'tuya',
        private log?: Logger) {
    }

    public async getAllDeviceStates(): Promise<TuyaDevice[] | undefined> {
      return this.discoverDevices();
    }

    public async discoverDevices(errorCallback?: (error: Error) => void): Promise<TuyaDevice[] | undefined> {
      const acceptedOutstandingDeviceStateRequest = new Map(this.outstandingDeviceStateRequests);
      this.outstandingDeviceStateRequests = new Map();

      if (!this.session?.hasValidToken()) {
        throw new Error('No valid token');
      }

      const {data} = await this.sendRequest<DiscoveryPayload>(
        '/homeassistant/skill',
        {
          header: {
            name: 'Discovery',
            namespace: 'discovery',
            payloadVersion: 1,
          },
          payload: {
            accessToken: this.session.accessToken,
          },
        },
        'GET',
      );

      if (data.header && data.header.code === 'SUCCESS') {
        if (data.payload && data.payload.devices) {
          acceptedOutstandingDeviceStateRequest.forEach((promise, deviceId) => {
            const tuyaDevice = data.payload.devices.find(device => device.id === deviceId);
            if (tuyaDevice?.data) {
              promise.resolve(tuyaDevice.data);
            } else {
              promise.reject(new Error('Device not found in discovery'));
            }
          });
          return data.payload.devices;
        }
      } else if (data.header && data.header.code === 'FrequentlyInvoke') {
        const rateLimitError = new RatelimitError('Requesting too quickly.');
        for (const {reject} of this.outstandingDeviceStateRequests.values()) {
          reject(rateLimitError);
        }
        if (errorCallback) {
          errorCallback(rateLimitError);
        } else {
          throw rateLimitError;
        }
      } else {
        const error = new Error(`No valid response from API: ${JSON.stringify(data)}`);
        for (const {reject} of this.outstandingDeviceStateRequests.values()) {
          reject(error);
        }
        if (errorCallback) {
          errorCallback(error);
        } else {
          throw error;
        }
      }
    }

    private debouncedDeviceDiscovery = debounce(this.discoverDevices, 500, {maxWait: 1000})

    private outstandingDeviceStateRequests: Map<string, DebouncedPromise<TuyaDeviceState>> = new Map()

    public async getDeviceState<T>(deviceId: string): Promise<TuyaDeviceState & T | undefined> {
      let debouncedPromise = this.outstandingDeviceStateRequests.get(deviceId);

      if (!debouncedPromise) {
        debouncedPromise = new DebouncedPromise<TuyaDeviceState>();
        this.outstandingDeviceStateRequests.set(deviceId, debouncedPromise);
      }


      this.debouncedDeviceDiscovery((error) => {
            this.log?.error(error);
      });

      return debouncedPromise.promise as Promise<TuyaDeviceState & T | undefined>;
    }

    public async setDeviceState<Method extends TuyaApiMethod>
    (deviceId: string, method: Method, payload: TuyaApiPayload<Method>): Promise<void> {
      if (!this.session?.hasValidToken()) {
        throw new Error('No valid token');
      }

      const {data} = await this.sendRequest(
        '/homeassistant/skill',
        {
          header: {
            name: method,
            namespace: 'control',
            payloadVersion: 1,
          },
          payload: {
            ...payload,
            accessToken: this.session?.accessToken,
            devId: deviceId,
          },
        },
        'POST',
      );

      if (data.header && data.header.code === 'SUCCESS') {
        return;
      } else if (data.header && data.header.code === 'FrequentlyInvoke') {
        throw new RatelimitError('Requesting too quickly.');
      } else {
        throw new Error(`Invalid payload in response: ${JSON.stringify(data)}`);
      }
    }

    public async getOrRefreshToken(): Promise<Session | undefined> {
      if (!this.session?.hasToken()) {
            this.log?.debug('Requesting new token');
            // No token, lets get a token from the Tuya Web API
            if (!this.username) {
              throw new Error('No username configured');
            }
            if (!this.password) {
              throw new Error('No password configured');
            }
            if (!this.countryCode) {
              throw new Error('No country code configured');
            }

            const form = {
              userName: this.username,
              password: this.password,
              countryCode: this.countryCode,
              bizType: this.tuyaPlatform,
              from: 'tuya',
            };

            const formData = querystring.stringify(form);
            const contentLength = formData.length;

            try {
              const {data} = await
              axios({
                headers: {
                  'Content-Length': contentLength,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                url: '/homeassistant/auth.do',
                baseURL: this.authBaseUrl,
                data: formData,
                method: 'POST',
              });
              if (data.responseStatus === 'error') {
                    this.log?.error(`Authentication fault: ${data.errorMsg}`);
              } else {
                this.session = new Session(
                  data.access_token,
                  data.refresh_token,
                  data.expires_in,
                  data.access_token.substr(0, 2),
                );

                return this.session;
              }
            } catch (e) {
                this.log?.debug('Authentication error - %s', JSON.stringify(e));
                throw e;
            }

      } else {
            this.log?.debug('Refreshing token');
            if (this.session.isTokenExpired()) {
              // Refresh token
              const {data} = await this.sendRequest(
                '/homeassistant/access.do?grant_type=refresh_token&refresh_token=' + this.session.refreshToken,
                {},
                'GET',
              );

              // Received token
              this.session.resetToken(
                data.access_token,
                data.refresh_token,
                data.expires_in,
              );
              return this.session;
            }
      }
    }

    /*
     * --------------------------------------
     * HTTP methods
    */

    public async sendRequest<T = Record<string, unknown>>(url, data, method): Promise<{ data: T & { header: TuyaHeader } }> {
        this.log?.debug(`Sending HTTP ${method} request to ${url}.`);
        const response = await axios({
          baseURL: this.session?.areaBaseUrl,
          url,
          data,
          method,
        });

        return {data: response.data};
    }
}
