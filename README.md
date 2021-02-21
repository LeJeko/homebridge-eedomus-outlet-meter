<p align="center">
  <a href="https://github.com/homebridge/homebridge"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

<span align="center">

# homebridge-eedomus-outlet-meter

[![npm](https://img.shields.io/npm/v/homebridge-eedomus-outlet-meter.svg)](https://www.npmjs.com/package/homebridge-eedomus-outlet-meter) [![npm](https://img.shields.io/npm/dt/homebridge-eedomus-outlet-meter.svg)](https://www.npmjs.com/package/homebridge-eedomus-outlet-meter)

</span>

## Description
A simple Homebridge plugin for eddomus outlets providing data to Elgato Eve app using Fakegato-History.
Appears as a regular outlet with _"in use"_ state in Home app.

eedomus box create two separate periph_id for "state" and "power metering". Usually the second one was the next periph_id but you can change it if needed.
You can avoid accidental shutdown, with the "lock_on" option.

## Installation
```shell
npm install -g homebridge-eedomus-outlet-meter
```
## Configuration

This plugin needs one accessory per outlet.
The following parameters are supported:

```
{
   "accessory": "eedomusOutlet",       // mandatory
   "name": "TV power",                 // name in HomeKit
   "periph_id": 123456,                // eedomus API periph_id
   "periph_id_meter": 123457,          // (Optional) Default : periph_id + 1
   "eedomus_connection": "ip",         // connection method (Default: "cloud")
   "eedomus_ip": "1.2.3.4",            // eedomus ip address
   "api_user": "XXXXXX",               // eedomus API user
   "api_secret": "YYYYYYYYYYYYYYYY",   // eedomus API secret
   "refreshSeconds": 5,                // (Optional) Default: 10
   "lock_on": true                     // (Optional) Default: false
}
```

## Credits
[https://github.com/t-j-n/homebridge-mystromoutlet](https://github.com/t-j-n/homebridge-mystromoutlet)  
[https://github.com/simont77/homebridge-myhome](https://github.com/simont77/homebridge-myhome)