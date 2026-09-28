//
const btn_connect_ref = document.getElementById('btn_connect');
const btn_disconnect_ref = document.getElementById('btn_disconnect');

const panel_status_ref = document.getElementById('panel_status');

//color RGB range
const range_red_ref = document.getElementById('range-red-id');
const range_green_ref = document.getElementById('range-green-id');
const range_blue_ref = document.getElementById('range-blue-id');

const red_value_ref = document.getElementById('red-value-id');
const green_value_ref = document.getElementById('green-value-id');
const blue_value_ref = document.getElementById('blue-value-id');

const button_rgb_validation = document.getElementById('btn-validation-id');
//
const SERVICE_UUID = "0000181a-0000-1000-8000-00805f9b34fb";
const TEMP_CHAR_UUID = "00002a6e-0000-1000-8000-00805f9b34fb";
const HUM_CHAR_UUID = "00002a6f-0000-1000-8000-00805f9b34fb";
const DEW_CHAR_UUID = "00002a7b-0000-1000-8000-00805f9b34fb";
const RGB_CHAR_UUID = "00002a6d-0000-1000-8000-00805f9b34fb";
//
let bleServer = null; // Variable globale pour stocker le périphérique
let userDisconnected = false;
let jsonCharacteristic = null;
//
let theRGBValue = {
	red: 0,
	green: 0,
	blue: 0
}
////////////////////////////////////
// les canvas gauges
////////////////////////////////////
/// gauge local temperature
const gaugeLocalTemperature = new LcdGauge('canvas_local_temperature_id', {
	title: 'Temp',
	unit: '°C',
	min: -5,
	max: 50,
	value: 0,
	tickInterval: 5,
});
//********************* */
//// gauge local humidity
const gaugeLocalHumidity = new LcdGauge('canvas_local_humidity_id', {
	title: 'Hum',
	unit: '%',
	min: 0,
	max: 100,
	value: 0,
	tickInterval: 10,
});
//************************ */
///// gauge local DewPoint
const gaugeLocalDewPoint = new LcdGauge('canvas_local_dewpoint_id', {
	title: 'DewPoint',
	unit: '°C',
	min: 0,
	max: 50,
	value: 0,
	tickInterval: 5,
});
//************************* */
// range eventlistener
range_red_ref.addEventListener('change', (event) => {
	const val = event.target.value;
	red_value_ref.textContent = val;
	theRGBValue.red = val;
});
//
range_green_ref.addEventListener('change', (event) => {
	const val = event.target.value;
	green_value_ref.textContent = val;
	theRGBValue.green = val;
});
//
range_blue_ref.addEventListener('change', (event) => {
	const val = event.target.value;
	blue_value_ref.textContent = val;
	theRGBValue.blue = val;
});
//************************** */
button_rgb_validation.addEventListener('click', async () => {
	//console.log(theRGBValue);
	//
	const jsonString = JSON.stringify(theRGBValue);
	const encoder = new TextEncoder();
	const byteArray = encoder.encode(jsonString);
	//
	try {
		if (!jsonCharacteristic) {
			log("Erreur : La caractéristique JsonRGB BLE n'est pas initialisée.");
			return;
		}
		// writeValueWithResponse garantit que le paquet est bien reçu
		await jsonCharacteristic.writeValueWithResponse(byteArray);
		console.log("JSON envoyé avec succès :", jsonString);

	} catch (error) {
		console.error("Erreur lors de l'envoi du JSON :", error);
	}
});
//************************** */
function afficheStatus(txt) {
	panel_status_ref.textContent = txt;
}
//*********************** */
function showConnectButton() {
	btn_connect_ref.classList.remove('hidden');
	btn_disconnect_ref.classList.add('hidden');
}
//********************** */
function showDisconnectButton() {
	btn_connect_ref.classList.add('hidden');
	btn_disconnect_ref.classList.remove('hidden');
}
//****************************************** */
function setBleConnected(thename) {
	afficheStatus(`${thename} is connected`);
	showDisconnectButton();
}
//****************************** */
function setBleDisconnected(msg) {
	//afficheStatus(msg || 'BLE Device Disconnected');
	showConnectButton();
}
//*************************************************** */
btn_disconnect_ref.addEventListener('click', async () => {
	if (!bleServer || !bleServer.connected) {
		afficheStatus('Bluetooth is not connected');
		return;
	}
	//
	userDisconnected = true;
	try {
		await bleServer.disconnect();
		setBleDisconnected('Disconnected');

	} catch (error) {
		afficheStatus('Disconnected error: ' + error.message);
	}
});
//*********************************************** */
btn_connect_ref.addEventListener('click', async () => {
	if (!('bluetooth' in navigator)) {
		afficheStatus("Your browser does not support Web BLE (use Chrome/Edge over HTTPS");
		return;
	}
	//
	try {
		userDisconnected = false;

		console.log("Recherche de l'appareil ESP32...");
		// 1. Filtrer pour trouver notre ESP32
		const device = await navigator.bluetooth.requestDevice({
			filters: [{ services: [SERVICE_UUID] }]
		});

		// callback disconnected
		device.addEventListener('gattserverdisconnected', (event) => {
			const device = event.target;
			afficheStatus(`${device.name} is disconnected.`);
		});
		//
		console.log("Connexion au serveur GATT...");
		bleServer = await device.gatt.connect();

		//
		setBleConnected(bleServer.device.name);

		console.log("Récupération du service...");
		const service = await bleServer.getPrimaryService(SERVICE_UUID);

		// Gestion de la caractéristique jsonRGB
		console.log("Configuration jsonRGB...");
		jsonCharacteristic = await service.getCharacteristic(RGB_CHAR_UUID);


		// Gestion de la caractéristique Température
		console.log("Configuration Température...");
		const tempChar = await service.getCharacteristic(TEMP_CHAR_UUID);
		await tempChar.startNotifications();
		tempChar.addEventListener('characteristicvaluechanged', (event) => {
			const decoder = new TextDecoder('utf-8');
			const val = decoder.decode(event.target.value);
			gaugeLocalTemperature.setValue(val);
		});

		// Gestion de la caractéristique Humidité
		console.log("Configuration Humidité...");
		const humChar = await service.getCharacteristic(HUM_CHAR_UUID);
		await humChar.startNotifications();
		humChar.addEventListener('characteristicvaluechanged', (event) => {
			const decoder = new TextDecoder('utf-8');
			const val = decoder.decode(event.target.value);
			gaugeLocalHumidity.setValue(val);
		});

		// Gestion de la caractéristique DewPoint
		console.log("Configuration DewPoint...");
		const dewChar = await service.getCharacteristic(DEW_CHAR_UUID);
		await dewChar.startNotifications();
		dewChar.addEventListener('characteristicvaluechanged', (event) => {
			const decoder = new TextDecoder('utf-8');
			const val = decoder.decode(event.target.value);
			gaugeLocalDewPoint.setValue(val);
		});

		//
	} catch (error) {
		console.error("Erreur de connexion BLE : ", error);
		setBleDisconnected('Connection failed: ' + error.message);
	}
});
//end

