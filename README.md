# homebridge-tuya-web

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Homebridge plugin for Tuya devices using a cloud Tuya Web Api.

This Homebridge plugin is based on the Home Assistent Tuya integration that implements a special Tuya Home Assistant API.

See [Home Assistant Tuya integration](https://www.home-assistant.io/components/tuya/) and [Tuyaha python library](https://github.com/PaulAnnekov/tuyaha).

## Features

This Homebridge Plugin implements the following features:

- Controlling Tuya WIFI enabled devices form within HomeKit enabled iOS Apps.
- Uses simple and lightweight Cloud Web API to control and get state update from Tuya devices. You will need a stable internet connection to control the devices and get frequent state updates.
- Device State Caching. State of devices is cached in memory, every time a HomeKit app request status updates from the devices this results in a very fast and responsive response. State cache is updated every 10 seconds and when controled from a HomeKit app. There can be a latancy in updates when a device is controled form an App/Hub/Controller other than HomeKit, e.g. from the Tuya Android/iOS App.

## Installation

```
npm i @milo526/homebridge-tuya-web -g
```

## Configuration

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      "username": "xxxx@gmail.com",
      "password": "xxxxxxxxxx",
      "countryCode": "xx",
      "platform": "tuya"
    }
}
```

The `options` has these properties:

- `username` Required. The username for the account that is registered in the Android/iOS App.
- `password` Required. The password for the account that is registered in the Android/iOS App.
- `countryCode` Required. Your account [country code](https://www.countrycode.org/), e.g., 1 for USA or 86 for China.
- `platform` Optional. The App where your account is registered. `tuya` for Tuya Smart, `smart_life` for Smart Life, `jinvoo_smart` for Jinvoo Smart. Defaults to `tuya`.
- `pollingInterval` Optional. The frequency in **seconds** that the plugin polls the cloud to get device updates. When the devices are exclusively controlled through Homebridge, you can set this to a low frequency (high interval number, e.g. 180 = 3 minutes). Defaults to no polling.

## Overruling Device Types

As of version 0.1.6 it is possible to override values from the default. As of now, only overruling device types is possible. See example configuration below.

```json
{
  "platform": "TuyaWebPlatform",
  "name": "TuyaWebPlatform",
  "options":
    {
      ...
    },
  "defaults": [
    {
      "id": "<id>",
      "device_type": "<device_type>"
    }
  ]
}
```

The `defaults` has these properties:

- `id` The id for the device that is registered in the Android/iOS App.
- `device_type` The `device_type` to be overruled. This can be useful for dimmers that are reported as `light` by the Tuya API and don't support hue and saturation or for outlets that are reported as `switch`. 

## Supported Device Types

There is currently support for the following device types within this Homebridge plugin:

- **Switch/Outlet** - The platform supports switch and outlets/sockets.
- **Light/Dimmer** - The platform supports most types of Tuya lights. This is partly implemented and only currently supports controlling the on/off state and the brightness. This can be used with a dimmer.
- **Fan** - The platform supports most kinds of Tuya fans. This is partly implemented and only currently supports controlling the on/off state and speed control. Oscillation is not implemented due to lack of support in the Tuya API. 

The Web API also supports these devices, but are not implemented yet in the plugin.

- **Scene** - Not yet supported, see discussions in #1 and #8.
- **Climate** - Not yet supported.
- **Cover** - Not yet supported.

## How to check whether the API this library uses can control your device?

- Copy [this script](https://github.com/milo526/homebridge-tuya-web/blob/master/tools/debug_discovery.py) to your PC with Python
  installed or to https://repl.it/
- Set/update config inside and run it
- Check if your devices are listed
  - If they are - open an issue and provide the output
  - If they are not - don't open an issue. Ask [Tuya support](mailto:support@tuya.com) to support your device in their 
    `/homeassistant` API
- Remove the updated script, so your credentials won't leak

## TODO

These features are on my wishlist and need to be implemented:

- Implement devices that are not supported yet.

## Unit tests

The source code also has some unit tests to test API calls. Run the following command to run the unit tests.

```
 mocha test/tuyawebapi_test.js
```

## Version history

#### For newer versions please consult the [releases](https://github.com/milo526/homebridge-tuya-web/releases).

##### Version 0.1.7 - 2019-08-18

* Fixed not correct updating after reboot of Homebridge.

##### Version 0.1.6 - 2019-08-18

* Added light accessory (made by niksauer, thanks!!)
* Added overruling device type in config. Some dimmers are reported by Tuya API as `lights`. Dimmers don't have hue and saturation and therfor the device type has to  be overruled to `dimmer`.

##### Version 0.1.5 - 2019-08-18

* Fixed issue #17 - Outlets and switches not turning off in Home app when turned off with other app.

##### Version 0.1.4 - 2019-08-09

* Switch to regional Tuya Web API server after authentication was successful (EU / China / USA).
