var Service, Characteristic, UUIDGen, FakeGatoHistoryService;
var request = require("request");
var sprintf = require("sprintf-js").sprintf;
var inherits = require('util').inherits;
var correctingInterval = require('correcting-interval');

//Initialize
module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
	FakeGatoHistoryService = require('fakegato-history')(homebridge);
	
	CurrentPowerConsumption = function () {
		Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.UINT16,
			unit: "Watt",
			maxValue: 100000,
			minValue: 0,
			minStep: 1,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	CurrentPowerConsumption.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
	inherits(CurrentPowerConsumption, Characteristic);

	TotalConsumption = function () {
		Characteristic.call(this, 'Energy', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: "kWh",
			maxValue: 100000000000,
			minValue: 0,
			minStep: 0.001,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
		});
		this.value = this.getDefaultValue();
	};
	TotalConsumption.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
	inherits(TotalConsumption, Characteristic);

	ResetTotal = function () {
		Characteristic.call(this, 'Reset', 'E863F112-079E-48FF-8F27-9C2605A29F52');
		this.setProps({
			format: Characteristic.Formats.UINT32,
			perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.WRITE]
		});
		this.value = this.getDefaultValue();
	};
	ResetTotal.UUID = 'E863F112-079E-48FF-8F27-9C2605A29F52';
	inherits(ResetTotal, Characteristic);

	PowerMeterService = function (displayName, subtype) {
		Service.call(this, displayName, '00000001-0000-1777-8000-775D67EC4377', subtype);
		this.addCharacteristic(CurrentPowerConsumption);
		this.addCharacteristic(TotalConsumption);
		this.addCharacteristic(ResetTotal);
	};
	inherits(PowerMeterService, Service);

	FakeGatoHistoryService = FakeGatoHistoryService;
	inherits(FakeGatoHistoryService, Service);

	homebridge.registerAccessory("homebridge-eedomus-outlet-meter", "eedomusOutlet", eedomusOutlet)
}

// function eedomusOutlet
function eedomusOutlet(log, config) {
	this.log = log;
	this.config = config || {};
	this.name = config.name;
	this.displayName = config.name;
	this.url = config.url;
	this.refresh = config.refreshSeconds || 10;
	this.periph_id = config.periph_id;
	this.periph_ip_meter = config.periph_id_meter || this.periph_id + 1;
	this.eedomus_ip = config.eedomus_ip || "cloud";
	this.api_user = config.api_user;
	this.api_secret = config.api_secret;
	this.lock_on = config.lock_on || false;
	if (this.eedomus_ip == "cloud") {
		this.get_url = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_id + "";
		this.set_url = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.value&periph_id=" + this.periph_id + "&value=";
		this.get_url_meter = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_ip_meter + "";      
	} else {
		this.get_url = "http://" + this.eedomus_ip + "/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_id + "";
		this.set_url = "http://" + this.eedomus_ip + "/api/set?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.value&periph_id=" + this.periph_id + "&value=";  
		this.get_url_meter = "http://" + this.eedomus_ip + "/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_ip_meter + "";
	}
	this.UUID = UUIDGen.generate(sprintf("powermeter-%s", config.periph_id));
	var package = require('./package.json');
	this.intPower = 0;
	this.acquiredSamples = 0;
	this.lastReset = 0;
	this.value = 0;
	this.totalenergy = 0;
	this.totalenergytemp = 0;
	this.ExtraPersistedData = {};
	
	correctingInterval.setCorrectingInterval(function () {
		if (this.powerLoggingService.isHistoryLoaded()) {
			this.ExtraPersistedData = this.powerLoggingService.getExtraPersistedData();
			if (this.ExtraPersistedData != undefined) {
				this.totalenergy = this.ExtraPersistedData.totalenergy + this.totalenergytemp + this.value * this.refresh / 3600 / 1000;
				this.powerLoggingService.setExtraPersistedData({ totalenergy: this.totalenergy, lastReset: this.ExtraPersistedData.lastReset });
			}
			else {
				this.totalenergy = this.totalenergytemp + this.value * this.refresh / 3600 / 1000;
				this.powerLoggingService.setExtraPersistedData({ totalenergy: this.totalenergy, lastReset: 0 });
			}
			this.totalenergytemp = 0;

		}
		else {
			this.totalenergytemp = this.totalenergytemp + this.value * this.refresh / 3600 / 1000;
			this.totalenergy = this.totalenergytemp;
		}
		this.outlet.getCharacteristic(CurrentPowerConsumption).getValue(null);
		this.outlet.getCharacteristic(TotalConsumption).getValue(null);
		this.powerLoggingService.addEntry({ time: Date.now(), power: this.value });
	}.bind(this), this.refresh * 1000);
	
	this.informationService = new Service.AccessoryInformation();
		
	this.informationService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.Manufacturer, "Homebridge")
		.setCharacteristic(Characteristic.Model, "eedomus outlet")
		.setCharacteristic(Characteristic.FirmwareRevision, package.version)
		.setCharacteristic(Characteristic.SerialNumber, this.periph_id);

	this.outlet = new Service.Outlet(this.name);
	this.outlet.getCharacteristic(Characteristic.On)
	.on('get', this.getState.bind(this))
	.on('set', this.setState.bind(this));

	this.outlet.getCharacteristic(Characteristic.OutletInUse)
	.on('get',  (callback) => {
		callback(null, this.inUse);
	});
	
	this.outlet.getCharacteristic(CurrentPowerConsumption)
	.on('get', this.getpowerConsumption.bind(this));

	this.outlet.getCharacteristic(TotalConsumption)
	.on('get',  (callback) => {
 		this.ExtraPersistedData = this.powerLoggingService.getExtraPersistedData();
 		if (this.ExtraPersistedData != undefined) {
			 this.totalenergy = this.ExtraPersistedData.totalenergy;
			 this.log.debug("getConsumption = %f", this.totalenergy);
 		}
		callback(null, this.totalenergy);
	});

	this.outlet.getCharacteristic(ResetTotal)
		.on('set', (value, callback) => {
			this.totalenergy = 0;
			this.lastReset = value;
			this.powerLoggingService.setExtraPersistedData({ totalenergy: this.totalenergy, lastReset: this.lastReset });
			callback(null);
		})
		.on('get', (callback) => {
			this.ExtraPersistedData = this.powerLoggingService.getExtraPersistedData();
			if (this.ExtraPersistedData != undefined)
				this.lastReset = this.ExtraPersistedData.lastReset;
			callback(null, this.lastReset);
		});

	this.powerLoggingService = new FakeGatoHistoryService("energy", this, {storage: 'fs'});
}

// getState
eedomusOutlet.prototype.getState = function(callback) {

	if (this.lock_on) { 
		callback(null, "1");
	} else {
		request.get(
			{url: this.get_url},
			function(err, response, body) {
				if(!err && response.statusCode == 200) {
					var json = JSON.parse(body);
					var state = json.body.last_value == 100 ? "1" : "0";
					callback( null, state);
				} else {
					this.log("getState error: %s", err);
				}
			}.bind(this)
		);
	
	}
}

eedomusOutlet.prototype.getpowerConsumption = function(callback) {
	request.get(
		{url: this.get_url_meter},
		function(err, response, body) {
			if(!err && response.statusCode == 200) {
				var json = JSON.parse(body);
				var power = Math.round(json.body.last_value);
				this.value = power;
				this.inUse = power == "0" ? false : true;
				callback( null, power);
			} else {
				callback(err);
				this.log("getPower error: %s", err);
			}
		}.bind(this)
	);
}


// set State
eedomusOutlet.prototype.setState = function( state, callback) {
	if (this.lock_on && !state) {
		callback();
		this.lockOn();
	} else {
		let requestUrl = this.set_url + (state ? 100 : 0);

		request.get(
			{url: requestUrl},
			function(err, response, body) {
				if(!err && response.statusCode == 200) {
					callback();
				} else {
					callback(err);
					this.log("SetState error: %s", err);
				}
			}.bind(this)
		);
	}
}

// Lock ON
eedomusOutlet.prototype.lockOn = function() {
	setTimeout(() => {
		this.outlet.getCharacteristic(Characteristic.On).updateValue("1");
	}, 250);
}

eedomusOutlet.prototype.getServices = function() {
	return [this.informationService, this.powerLoggingService, this.outlet];
}
