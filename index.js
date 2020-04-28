var Service, Characteristic, UUIDGen, FakeGatoHistoryService;
var request = require("request");
var inherits = require('util').inherits;
var pollingToEvent = require('polling-to-event');
var totalPower = 0;
var refresh = 0;

//Initialize
module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
	FakeGatoHistoryService = require('fakegato-history')(homebridge);
	
	CurrentpowerConsumption = function () {
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
	CurrentpowerConsumption.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
	inherits(CurrentpowerConsumption, Characteristic);

	TotalPowerConsumption = function () {
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
	TotalPowerConsumption.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
	inherits(TotalPowerConsumption, Characteristic);

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

	FakeGatoHistoryService = FakeGatoHistoryService;
	inherits(FakeGatoHistoryService, Service);

	homebridge.registerAccessory("homebridge-eedomus-outlet-meter", "eedomusOutlet", eedomusOutlet)
}

// function eedomusOutlet
function eedomusOutlet(log, config) {
	var self = this;
	this.log = log;
	this.name = config["name"];
	this.url = config["url"];
	refresh = config["refreshSeconds"] * 1000 || 10000;
	this.periph_id = config["periph_id"];
	this.periph_ip_meter = config["periph_id_meter"] || this.periph_id + 1;
	this.eedomus_ip = config["eedomus_ip"] || "cloud";
	this.api_user = config["api_user"];
	this.api_secret = config["api_secret"];
	this.lock_on = config["lock_on"] || false;
	if (this.eedomus_ip == "cloud") {
		this.get_url = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_id + "";
		this.set_url = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.value&periph_id=" + this.periph_id + "&value=";
		this.get_url_meter = "https://api.eedomus.com/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_ip_meter + "";      
	} else {
		this.get_url = "http://" + this.eedomus_ip + "/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_id + "";
		this.set_url = "http://" + this.eedomus_ip + "/api/set?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.value&periph_id=" + this.periph_id + "&value=";  
		this.get_url_meter = "http://" + this.eedomus_ip + "/api/get?api_user=" + this.api_user + "&api_secret=" + this.api_secret + "&action=periph.caract&periph_id=" + this.periph_ip_meter + "";
	}

	this.informationService = new Service.AccessoryInformation();
	var package = require('./package.json');
	this.informationService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.Manufacturer, "Homebridge")
		.setCharacteristic(Characteristic.Model, "eedomus outlet")
		.setCharacteristic(Characteristic.FirmwareRevision, package.version)
		.setCharacteristic(Characteristic.SerialNumber, this.periph_id);

	this.service = new Service.Outlet(this.name);

	this.service.getCharacteristic(Characteristic.On)
	.on('get', this.getState.bind(this))
	.on('set', this.setState.bind(this));

	this.service.getCharacteristic(Characteristic.OutletInUse)
	.on('get', this.getState.bind(this));

	this.service.getCharacteristic(CurrentpowerConsumption)
	.on('get', this.getpowerConsumption.bind(this));

	this.service.getCharacteristic(TotalPowerConsumption)
	.on('get',  (callback) => {
 		this.ExtraPersistedData = this.powerLoggingService.getExtraPersistedData();
 		if (this.ExtraPersistedData != undefined) {
 			totalPower = this.ExtraPersistedData.totalPower;
 		}
		callback(null, totalPower);
	});

	this.service.getCharacteristic(ResetTotal)
		.on('set', (value, callback) => {
			this.totalPower = 0;
			this.lastReset = value;
			this.powerLoggingService.setExtraPersistedData({ totalPower: this.totalPower, lastReset: this.lastReset });
			callback(null);
		})
		.on('get', (callback) => {
			this.ExtraPersistedData = this.powerLoggingService.getExtraPersistedData();
			if (this.ExtraPersistedData != undefined)
				this.lastReset = this.ExtraPersistedData.lastReset;
			callback(null, this.lastReset);
		});

	this.powerLoggingService = new FakeGatoHistoryService("energy", this, {storage: 'fs'});


	// setting up scheduled pulling
	emitter = pollingToEvent( function(done) {
		request.get(
			{url: self.get_url_meter},
			function(err, response, body) {
				if(!err && response.statusCode == 200) {
					done(err, body);
				}
			}
		);
	},
	{ longpolling: true, interval: refresh }
	);

	emitter.on("longpoll", function(data) {
		var totalPowerTemp = 0;

		var json = JSON.parse(data);
		if (self.powerLoggingService.isHistoryLoaded()) {
			self.ExtraPersistedData = self.powerLoggingService.getExtraPersistedData();
			if (self.ExtraPersistedData != undefined && self.ExtraPersistedData.totalPower != undefined) {
				self.totalPower = self.ExtraPersistedData.totalPower + totalPowerTemp + json.body.last_value * refresh / 3600 / 1000;
				self.powerLoggingService.setExtraPersistedData({ totalPower: totalPower, lastReset: self.ExtraPersistedData.lastReset });
			}
			else {
				totalPower = totalPowerTemp + json.body.last_value * refresh / 3600 / 1000;
				self.powerLoggingService.setExtraPersistedData({ totalPower: totalPower, lastReset: 0 });
			}
			totalPowerTemp = 0;

		}
		else {
			totalPowerTemp = totalPowerTemp + json.body.last_value * refresh / 3600 / 1000;
			totalPower = totalPowerTemp;
		}
		self.service.getCharacteristic(CurrentpowerConsumption).getValue(null);
		self.service.getCharacteristic(TotalPowerConsumption).getValue(null);
		self.powerLoggingService.addEntry({ time: Date.now(), power: json.body.last_value });
	});
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
				var power = json.body.last_value;
				callback( null, Math.round(power));
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
		this.service.getCharacteristic(Characteristic.On).updateValue("1");
		this.service.getCharacteristic(Characteristic.OutletInUse).updateValue("1");
	}, 250);
}

eedomusOutlet.prototype.getServices = function() {
	return [this.informationService, this.service, this.powerLoggingService];
}
