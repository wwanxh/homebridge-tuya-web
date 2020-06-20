const axios = require('axios').default;
const querystring = require('querystring');

class RatelimitError extends Error {
    constructor(message) {
        super(message);
    }
}

class Session {
    constructor(accessToken, refreshToken, expiresIn, areaCode) {
        this.accessToken;
        this.refreshToken;
        this.expiresOn;
        this.areaCode = areaCode;
        this.resetToken(accessToken, refreshToken, expiresIn);
    }

    set areaCode(newAreaCode) {
        var areaCodeLookup = {
            'AY': 'https://px1.tuyacn.com',
            'EU': 'https://px1.tuyaeu.com',
            'US': 'https://px1.tuyaus.com'
        }
        this.areaBaseUrl = areaCodeLookup[newAreaCode] || areaCodeLookup['US']
    }

    resetToken(accessToken, refreshToken, expiresIn) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresOn = this._getCurrentEpoch() + expiresIn - 100; // subtract 100 ticks to expire token before it actually does
    }

    hasToken() {
        return this.accessToken && true;
    }

    isTokenExpired() {
        return this.token.expiresOn > this._getCurrentEpoch();
    }

    hasValidToken() {
        return this.accessToken && this.expiresOn > this._getCurrentEpoch();
    }

    _getCurrentEpoch() {
        return Math.round((new Date()).getTime() / 1000);
    }
}

class TuyaWebApi {
    constructor(username, password, countryCode, tuyaPlatform = 'tuya', log = null) {
        this.username = username;
        this.password = password;
        this.countryCode = countryCode;
        this.tuyaPlatform = tuyaPlatform;

        this.session = new Session();

        this.authBaseUrl = 'https://px1.tuyaeu.com';

        this.log = log;
    }

    discoverDevices() {
        if (!this.session.hasValidToken()) {
            throw new Error('No valid token');
        }

        var data = {
            header: {
                name: 'Discovery',
                namespace: 'discovery',
                payloadVersion: 1
            },
            payload: {
                accessToken: this.session.accessToken
            }
        }
        return new Promise((resolve, reject) => {
            this.sendRequest(
                '/homeassistant/skill',
                data,
                'GET',
            ).then(({data}) => {
                if (data.header && data.header.code === 'SUCCESS') {
                    if (data.payload && data.payload.devices) {
                        resolve(data.payload.devices);
                    }
                } else if (data.header && data.header.code === 'FrequentlyInvoke') {
                    this.log.debug('Requesting too quickly.');
                    //reject(new RatelimitError('Requesting too quickly.'));
                } else {
                    reject(new Error(`No valid response from API: ${JSON.stringify(data)}`))
                }
            }).catch((error) => {

                reject(error);
            });
        });
    }

    getAllDeviceStates() {
        return this.discoverDevices();
    }

    getDeviceState(deviceId) {
        if (!this.session.hasValidToken()) {
            throw new Error('No valid token');
        }

        var data = {
            header: {
                name: 'QueryDevice',
                namespace: 'query',
                payloadVersion: 1
            },
            payload: {
                accessToken: this.session.accessToken,
                devId: deviceId,
                value: 1
            }
        }

        return new Promise((resolve, reject) => {
            this.sendRequest(
                '/homeassistant/skill',
                data,
                'GET'
            ).then(({data}) => {
                if (data.payload && data.header && data.header.code === 'SUCCESS') {
                    resolve(data.payload.data);
                } else if (data.header && data.header.code === 'FrequentlyInvoke') {
                    // reject(new RatelimitError('Requesting too quickly.'));
                } else {
                    reject(new Error(`Invalid payload in response: ${JSON.stringify(data)}`))
                }
            }).catch((error) => {
                reject(error);
            });
        });
    }

    setDeviceState(deviceId, method, payload = {}) {
        if (!this.session.hasValidToken()) {
            throw new Error('No valid token');
        }

        /* Methods
         * turnOnOff -> 0 = off, 1 = on
         * brightnessSet --> 0..100
        */

        var data = {
            header: {
                name: method,
                namespace: 'control',
                payloadVersion: 1
            },
            payload: payload
        }

        data.payload.accessToken = this.session.accessToken;
        data.payload.devId = deviceId;

        return new Promise((resolve, reject) => {
            this.sendRequest(
                '/homeassistant/skill',
                data,
                'POST'
            ).then(({data}) => {
                if (data.header && data.header.code === 'SUCCESS') {
                    resolve();
                } else if (data.header && data.header.code === 'FrequentlyInvoke') {
                    reject(new RatelimitError('Requesting too quickly.'));
                } else {
                    reject(new Error(`Invalid payload in response: ${JSON.stringify(data)}`))
                }
            }).catch((error) => {
                reject(error)
            });
        });
    }

    getOrRefreshToken() {
        if (!this.session.hasToken()) {
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

            var form = {
                userName: this.username,
                password: this.password,
                countryCode: this.countryCode,
                bizType: this.tuyaPlatform,
                from: "tuya"
            }

            var formData = querystring.stringify(form);
            var contentLength = formData.length;

            return new Promise((resolve, reject) => {
                axios({
                    headers: {
                        'Content-Length': contentLength,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    url: '/homeassistant/auth.do',
                    baseURL: this.authBaseUrl,
                    data: formData,
                    method: 'POST'
                }).then((res) => {
                    if (res.data.responseStatus === 'error') {
                        reject(new Error(`Authentication fault: ${res.data.errorMsg}`));
                    } else {
                        // Received token
                        this.session.resetToken(
                            res.data.access_token,
                            res.data.refresh_token,
                            res.data.expires_in
                        );
                        // Change url based on areacode in accesstoken first two chars
                        this.session.areaCode = res.data.access_token.substr(0, 2);

                        resolve(this.session);
                    }
                }).catch((err) => {
                    this.log.debug("Authentication error - %s", JSON.stringify(err))
                    reject(new Error('Authentication fault, could not retreive token.', err));
                });
            });
        } else {
            if (this.session.isTokenExpired()) {
                // Refresh token
                return new Promise((resolve, reject) => {
                    this.sendRequest(
                        '/homeassistant/access.do?grant_type=refresh_token&refresh_token=' + this.session.refreshToken,
                        '',
                        'GET'
                    ).then((response, obj) => {
                        // Received token
                        this.session.resetToken(
                            obj.access_token,
                            obj.refresh_token,
                            obj.expires_in
                        );
                        resolve(this.session);
                    }).catch((error) => {
                        reject(error)
                    });
                });
            }
        }
    }

    /*
     * --------------------------------------
     * HTTP methods
    */

    sendRequest(url, data, method) {
        return new Promise((resolve, reject) => {
            axios({
                baseURL: this.session.areaBaseUrl,
                url,
                data,
                method
            }).then((response) => {
                resolve({response, data: response.data})
            }).catch((error) => {
                reject(error)
            });
        });
    }
}

module.exports = TuyaWebApi;
