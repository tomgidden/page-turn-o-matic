var hid = require("ble_hid_keyboard");

// Detect short press ( < 2 seconds)
var is_short = false;
var short_timeout = false;

// Detect fast-click count ( < 0.25 seconds)
var clickcount = 0;
var clearclick_timeout;

// Sleep when not in use.
var sleep_timeout;

// Track whether there's a live connection: don't want to send HID reports when not connected
var is_connected = false;

// Track NRF.sleep/NRF.wake state: don't want to setAdvertising, etc. when NRF not active
var is_ble_sleeping = false;

// BLE advertisements
var ad_values = {};
var ad_options = { name: "Page-Turn-o-Matic 4000" };


// r,g,b:  true=lit, false=unlit, null=preserve
// d: duration in ms
// c: multiple pulses (default: 1)
function flash_leds (r,g,b,d,c) {
  if (!c) c = 1;
  if (null !== r) digitalWrite(LED1, r);
  if (null !== g) digitalWrite(LED2, g);
  if (null !== b) digitalWrite(LED3, b);
  setTimeout(function () {
    if (null !== r) digitalWrite(LED1, 0);
    if (null !== g) digitalWrite(LED2, 0);
    if (null !== b) digitalWrite(LED3, 0);
    c--;
    if (c > 0) flash_leds(r,g,b,d,c);
  }, d);
}


// Activate NRF.sleep in 5 minutes (or an hour) unless timeout is restarted.
function reset_sleep_timer (long_delay) {

  if (undefined !== sleep_timeout)
    clearTimeout(sleep_timeout);

  sleep_timeout = setTimeout(function () {
    sleep_timeout = undefined;
    flash(true, null, null, 25);
    ble_sleep();
  }, long_delay ? 3600000 : 300000);
}

function ble_sleep() {
  NRF.disconnect();
  stop_update_bluetooth();
  is_ble_sleeping = true;
  NRF.sleep();
}

function ble_wake() {
  if (!is_connected) {
    flash_leds(null, true, null, 25);
    NRF.wake();
    is_ble_sleeping = false;
    start_update_bluetooth();
  }
}




function primary() {
  if (is_connected) {
    flash_leds(false, true, false, 25, 1);
    hid.tap(hid.KEY.RIGHT, 0);
  }
  else
    flash_leds(true, false, false, 500);
}

function secondary() {
  if (is_connected) {
    flash_leds(false, true, false, 25, 2);
    hid.tap(hid.KEY.LEFT, 0);
  }
  else
    flash_leds(true, false, false, 500);
}

function tertiary() {
  if (!is_ble_sleeping)
    ble_sleep();
  else
    flash_leds(false, false, true, 500);
}

function longclick() {
  clickcount = 0;
  if (is_connected) {
    flash_leds(false, true, false, 500);
    NRF.disconnect();
  }
  reset_sleep_timer(true);
}

function btn_pressed() {

  ble_wake();

  // Multi-click in quick succession.
  clickcount ++;

  if (undefined !== clearclick_timeout) {
    clearTimeout(clearclick_timeout);
    clearclick_timeout = undefined;
  }

  // Long press detection
  is_short = true;
  short_timeout = setTimeout(function () {
    is_short = false;
    short_timeout = null;
  }, 2000);
}

function btn_released() {

  if (short_timeout) {
    clearTimeout(short_timeout);
    short_timeout = null;
  }

  if (is_short) {
    clearclick_timeout = setTimeout(chain_ended, 350);
  }
  else {
    clearclick_timeout = undefined;
    longclick();
  }
}

function chain_ended() {
  var o = clickcount;
  clickcount = 0;
  clearclick_timeout = undefined;

  reset_sleep_timer();

  switch (o) {
  case 1: primary();   break;
  case 2: secondary(); break;
  case 3: tertiary();  break;
  default: break;
  }
}



// BLE advertisement
//
// Interval-based updates (in addition to BLE standard advert
// updates) to revise the battery charge level
var update_bluetooth_interval;

function start_update_bluetooth() {
  var f = function () {
      if (!is_ble_sleeping) { // Only update is BLE is active
        ad_values[0x180F] = Math.round(Puck.getBatteryPercentage());
        NRF.setAdvertising(ad_values, ad_options);
        NRF.setServices(undefined, { hid : hid.report });
      }
  };

  if (update_bluetooth_interval)
    clearInterval(update_bluetooth_interval);
  update_bluetooth_interval = setInterval(f, 300000);

  f();
}

function stop_update_bluetooth() {
  if (update_bluetooth_interval) {
    clearInterval(update_bluetooth_interval);
    update_bluetooth_interval = undefined;
  }
}



// Connection tracking
function on_connect () {
  flash_leds(false, true, true, 100);
  is_connected = true;
}

function on_disconnect() {
  flash_leds(true, false, false, 100);
  is_connected = false;
}


function init () {
  NRF.on('connect', on_connect);
  NRF.on('disconnect', on_disconnect);

  clearWatch();
  clearInterval();
  clearTimeout();

  setTimeout(function () {
    setWatch(btn_pressed, BTN, { repeat:true, edge:'rising', debounce : 50 });
    setWatch(btn_released, BTN, { repeat:true, edge:'falling', debounce : 50 });

    NRF.disconnect(); // To make BLE changes occur
    start_update_bluetooth();
  }, 3000);
}

E.on('init', init);


