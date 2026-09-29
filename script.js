//
const SERVICE_UUID = "0000181a-0000-1000-8000-00805f9b34fb";
const TEMP_CHAR_UUID = "00002a6e-0000-1000-8000-00805f9b34fb";
const HUM_CHAR_UUID = "00002a6f-0000-1000-8000-00805f9b34fb";
const DEW_CHAR_UUID = "00002a7b-0000-1000-8000-00805f9b34fb";
const RGB_CHAR_UUID = "00002a6d-0000-1000-8000-00805f9b34fb";
//
class App {

	constructor() {
		this.btn_connect_ref = document.getElementById('btn_connect');
		this.btn_disconnect_ref = document.getElementById('btn_disconnect');

		this.panel_status_ref = document.getElementById('panel_status');

		//color RGB range
		this.range_red_ref = document.getElementById('range-red-id');
		this.range_green_ref = document.getElementById('range-green-id');
		this.range_blue_ref = document.getElementById('range-blue-id');

		this.red_value_ref = document.getElementById('red-value-id');
		this.green_value_ref = document.getElementById('green-value-id');
		this.blue_value_ref = document.getElementById('blue-value-id');

		this.button_rgb_validation = document.getElementById('btn-validation-id');

		// gauge local temperature
		this.gaugeLocalTemperature = new LcdGauge('canvas_local_temperature_id', {
			title: 'Temp',
			unit: '°C',
			min: -5,
			max: 50,
			value: 0,
			tickInterval: 5,
		});
		//gauge local humidity
		this.gaugeLocalHumidity = new LcdGauge('canvas_local_humidity_id', {
			title: 'Hum',
			unit: '%',
			min: 0,
			max: 100,
			value: 0,
			tickInterval: 10,
		});
		// gauge local DewPoint
		this.gaugeLocalDewPoint = new LcdGauge('canvas_local_dewpoint_id', {
			title: 'DewPoint',
			unit: '°C',
			min: 0,
			max: 50,
			value: 0,
			tickInterval: 5,
		});
		//
		this.bleServer = null; // Variable globale pour stocker le périphérique
		this.userDisconnected = false;
		this.jsonCharacteristic = null;
		//
		this.theRGBValue = {
			red: 0,
			green: 0,
			blue: 0
		}
		//
		this.#initEvent();
	}
	//
	//*********************** */
	#showConnectButton() {
		this.btn_connect_ref.classList.remove('hidden');
		this.btn_disconnect_ref.classList.add('hidden');
	}
	//********************** */
	#showDisconnectButton() {
		this.btn_connect_ref.classList.add('hidden');
		this.btn_disconnect_ref.classList.remove('hidden');
	}
	//****************************************** */
	#setBleConnected(thename) {
		this.#afficheStatus(`${thename} is connected`);
		this.#showDisconnectButton();
	}
	//****************************** */
	#setBleDisconnected() {
		this.#showConnectButton();
	}
	//************************** */
	#afficheStatus(txt) {
		this.panel_status_ref.textContent = txt;
	}
	//*********** */
	#initEvent() {
		// range eventlistener
		this.range_red_ref.addEventListener('change', (event) => {
			const val = event.target.value;
			this.red_value_ref.textContent = val;
			this.theRGBValue.red = val;
		});
		//
		this.range_green_ref.addEventListener('change', (event) => {
			const val = event.target.value;
			this.green_value_ref.textContent = val;
			this.theRGBValue.green = val;
		});
		//
		this.range_blue_ref.addEventListener('change', (event) => {
			const val = event.target.value;
			this.blue_value_ref.textContent = val;
			this.theRGBValue.blue = val;
		});
		//
		this.btn_connect_ref.addEventListener('click', async () => {
			if (!('bluetooth' in navigator)) {
				this.#afficheStatus("Your browser does not support Web BLE (use Chrome/Edge over HTTPS");
				return;
			}
			//
			try {
				this.userDisconnected = false;

				console.log("Recherche de l'appareil ESP32...");
				// 1. Filtrer pour trouver notre ESP32
				const device = await navigator.bluetooth.requestDevice({
					filters: [{ services: [SERVICE_UUID] }]
				});

				// callback disconnected
				device.addEventListener('gattserverdisconnected', (event) => {
					const device = event.target;
					this.#afficheStatus(`${device.name} is disconnected.`);
				});
				//
				console.log("Connexion au serveur GATT...");
				this.bleServer = await device.gatt.connect();

				//
				this.#setBleConnected(this.bleServer.device.name);

				console.log("Récupération du service...");
				const service = await this.bleServer.getPrimaryService(SERVICE_UUID);

				// Gestion de la caractéristique jsonRGB
				console.log("Configuration jsonRGB...");
				this.jsonCharacteristic = await service.getCharacteristic(RGB_CHAR_UUID);


				// Gestion de la caractéristique Température
				console.log("Configuration Température...");
				const tempChar = await service.getCharacteristic(TEMP_CHAR_UUID);
				await tempChar.startNotifications();
				tempChar.addEventListener('characteristicvaluechanged', (event) => {
					const decoder = new TextDecoder('utf-8');
					const val = decoder.decode(event.target.value);
					this.gaugeLocalTemperature.setValue(val);
				});

				// Gestion de la caractéristique Humidité
				console.log("Configuration Humidité...");
				const humChar = await service.getCharacteristic(HUM_CHAR_UUID);
				await humChar.startNotifications();
				humChar.addEventListener('characteristicvaluechanged', (event) => {
					const decoder = new TextDecoder('utf-8');
					const val = decoder.decode(event.target.value);
					this.gaugeLocalHumidity.setValue(val);
				});

				// Gestion de la caractéristique DewPoint
				console.log("Configuration DewPoint...");
				const dewChar = await service.getCharacteristic(DEW_CHAR_UUID);
				await dewChar.startNotifications();
				dewChar.addEventListener('characteristicvaluechanged', (event) => {
					const decoder = new TextDecoder('utf-8');
					const val = decoder.decode(event.target.value);
					this.gaugeLocalDewPoint.setValue(val);
				});

				//
			} catch (error) {
				console.error("Erreur de connexion BLE : ", error);
				this.#setBleDisconnected();
				this.#afficheStatus("Erreur de connexion BLE : ", error.message);
			}
		});
		//
		this.button_rgb_validation.addEventListener('click', async () => {
			const jsonString = JSON.stringify(this.theRGBValue);
			const encoder = new TextEncoder();
			const byteArray = encoder.encode(jsonString);
			//
			try {
				if (!this.jsonCharacteristic) {
					log("Erreur : La caractéristique JsonRGB BLE n'est pas initialisée.");
					return;
				}
				// writeValueWithResponse garantit que le paquet est bien reçu
				await this.jsonCharacteristic.writeValueWithResponse(byteArray);
				console.log("JSON envoyé avec succès :", jsonString);

			} catch (error) {
				console.error("Erreur lors de l'envoi du JSON :", error);
			}
		});
		//
		this.btn_disconnect_ref.addEventListener('click', async () => {
			if (!this.bleServer || !this.bleServer.connected) {
				this.#afficheStatus('Bluetooth is not connected');
				return;
			}
			//
			this.userDisconnected = true;
			try {
				await this.bleServer.disconnect();
				this.#setBleDisconnected();

			} catch (error) {
				this.#afficheStatus('Disconnected error: ' + error.message);
			}
		});
		//
	}
}
//**************************************** */
window.addEventListener('DOMContentLoaded', () => {
	window.app = new App();
});
//
//end

