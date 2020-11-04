import {Logger} from 'homebridge';
import axios, {AxiosRequestConfig} from 'axios';
import * as querystring from 'querystring';
import {AuthenticationError, RatelimitError} from './errors';
import {ClimateMode} from './accessories/ClimateAccessory';

export const TuyaDeviceTypes = ['climate', 'light', 'fan', 'dimmer', 'switch', 'outlet', 'scene'] as const;
export type TuyaDeviceType = typeof TuyaDeviceTypes[number];
export type HomeAssitantDeviceType = 'light' | 'fan' | 'dimmer' | 'switch' | 'outlet' | 'scene';

export const TuyaPlatforms = ['tuya', 'smart_life', 'jinvoo_smart'] as const;
export type TuyaPlatform = typeof TuyaPlatforms[number];

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

type TuyaHeader = {
  code: 'SUCCESS' | 'FrequentlyInvoke' | string,
  payloadVersion: 1,
  msg?: string
}
type DiscoveryPayload = {
  payload: {
    devices: TuyaDevice[]
  },
  header: TuyaHeader
}

type DeviceQueryPayload<State extends TuyaDeviceState = TuyaDeviceState> = {
  payload: {
    data: State
  },
  header: TuyaHeader
}

export type TuyaApiMethod =
    'turnOnOff' |
    'brightnessSet' |
    'windSpeedSet' |
    'colorSet' |
    'colorTemperatureSet' |
    'modeSet' |
    'temperatureSet'
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
          : Method extends 'modeSet'
            ? { value: ClimateMode }
            : Method extends 'temperatureSet'
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
    private tuyaPlatform: TuyaPlatform = 'tuya',
    private log?: Logger) {
  }

  public async getAllDeviceStates(): Promise<TuyaDevice[] | undefined> {
    return this.discoverDevices();
  }

  public async discoverDevices(): Promise<TuyaDevice[] | undefined> {
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
      return data.payload.devices;
    } else {
      if (data.header && data.header.code === 'FrequentlyInvoke') {
        throw new RatelimitError('Requesting too quickly.', data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
  }

  public async getDeviceState<T>(deviceId: string): Promise<TuyaDeviceState & T | undefined> {
    if (!this.session?.hasValidToken()) {
      throw new Error('No valid token');
    }

    const {data} = await this.sendRequest<DeviceQueryPayload<TuyaDeviceState & T>>(
      '/homeassistant/skill',
      {
        header: {
          name: 'QueryDevice',
          namespace: 'query',
          payloadVersion: 1,
        },
        payload: {
          accessToken: this.session.accessToken,
          devId: deviceId,
          value: 1,
        },
      },
      'GET',
    );

    if (data.header && data.header.code === 'SUCCESS') {
      return data.payload.data;
    } else {
      if (data.header && data.header.code === 'FrequentlyInvoke') {
        throw new RatelimitError('Requesting too quickly.', data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
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
      throw new RatelimitError('Requesting too quickly.', data.header.msg);
    } else {
      throw new Error(`Invalid payload in response: ${JSON.stringify(data)}`);
    }
  }

  public async getOrRefreshToken(): Promise<Session | undefined> {
    if (!this.session?.hasToken()) {
            this.log?.debug('Requesting new token');
            // No token, lets get a token from the Tuya Web API
            if (!this.username) {
              throw new AuthenticationError('No username configured');
            }
            if (!this.password) {
              throw new AuthenticationError('No password configured');
            }
            if (!this.countryCode) {
              throw new AuthenticationError('No country code configured');
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
              throw new AuthenticationError(data.errorMsg);
            } else {
              this.session = new Session(
                data.access_token,
                data.refresh_token,
                data.expires_in,
                data.access_token.substr(0, 2),
              );

              return this.session;
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

  public async sendRequest<T = Record<string, unknown>>
  (url: AxiosRequestConfig['url'], data: AxiosRequestConfig['data'], method: AxiosRequestConfig['method'])
    : Promise<{ data: T & { header: TuyaHeader } }> {
        this.log?.debug('Sending HTTP %s request to %s - Header: %s.', method, url, JSON.stringify(data.header));
        const response = await axios({
          baseURL: this.session?.areaBaseUrl,
          url,
          data,
          method,
        });

        return {data: response.data};
  }
}
