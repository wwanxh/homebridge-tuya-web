var TuyaWebApi = require('../lib/tuyawebapi');

var config = require('./environment').config;

var assert = require('assert');
var describe = require('mocha').describe;
var it = require('mocha').it;
var before = require('mocha').before;

// Global variables used in the tests
this.api;

describe('TuyaWebApi', () => {

    before(() => {
        api = new TuyaWebApi(config.username, config.password, config.countryCode, config.platform);
    })

    describe('get access token', () => {
        it('should get an access token from the web api', (done) => {

            api.getOrRefreshToken().then((session) => {
                api.session = session || null;
                assert.notEqual(session.accessToken, null, 'No valid access token.');
                done()
            }).catch((error) => {
                done(error);
            });

        })
        it('should have the arecode set to EU', (done) => {
            assert.equal(api.session.areaCode, 'EU', 'Area code is not set.');
            done();
        });

        it('should have the area base url set to EU server', (done) => {
            assert.equal(api.session.areaBaseUrl, 'https://px1.tuyaeu.com', 'Area Base URL is not set.');
            done();
        })
    })

    describe('discover devices', () => {
        it('should get a list with devices', (done) => {

            api.discoverDevices().then((devices) => {
                assert.notEqual(devices.length, 0, 'No devices found');
                done()
            }).catch((error) => {
                done(error);
            });

        })
    })

    describe('get device state', () => {
        it('should get the state of a device', (done) => {

            const deviceId = config.deviceId;
            api.getDeviceState(deviceId).then((data) => {
                assert.notEqual(data.state, null, 'No device state received');
                done()
            }).catch((error) => {
                done(error);
            });

        })
    })

    describe('set device state', () => {
        it('should set the state of a device', (done) => {

            const deviceId = config.deviceId;
            api.setDeviceState(deviceId, 'turnOnOff', {value: 1}).then(() => {
                assert.ok(true, "Device has been set");
                done()
            }).catch((error) => {
                done(error);
            });

        })
    })

});
