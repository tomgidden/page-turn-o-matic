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
var is_ble_sleeping = true;

// BLE advertisements
var ad_values = {};
var ad_options = { 'name': "Page-Turn-o-Matic 4000" };


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
    if (!is_ble_sleeping) ble_toggle();
  }, long_delay ? 3600000 : 300000);
}

function primary() {
  flash_leds(false, true, false, 25, 1);
  hid.tap(hid.KEY.RIGHT, 0);
}

function secondary() {
  flash_leds(false, true, false, 25, 2);
  hid.tap(hid.KEY.LEFT, 0);
}

function tertiary() {
  // NOP
}

function longclick() {
  clickcount = 0;
  ble_toggle(true);
}

function ble_toggle(force) {
  if (undefined !== force) {
    is_ble_sleeping = force;
  }

  is_ble_sleeping = !is_ble_sleeping;
  if (is_ble_sleeping) {
    is_connected = false;
    NRF.sleep();
    flash_leds(true, false, false, 500);
  }
  else {
    NRF.wake();
    flash_leds(false, false, true, 500);
  }
}

function btn_released() {
  ble_toggle();
}

function btn_pressed() {
  // NOP
}

function sw_pressed() {

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

function sw_released() {

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

  reset_sleep_timer(true);

  //if (is_ble_sleeping) {
  //    flash_leds(true, true, true, 50);
  //  ble_toggle();
  //    return;
  //  }

  if (!is_connected) {
    flash_leds(true, false, false, 50);
    return;
  }
  
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
    ad_values[0x180F] = Math.round(Puck.getBatteryPercentage());
    NRF.setAdvertising(ad_values, ad_options);
  };

  if (update_bluetooth_interval)
    clearInterval(update_bluetooth_interval);

  update_bluetooth_interval = setInterval(f, 30000);

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
  flash_leds(null, null, true, 10);
  is_connected = true;
}

function on_disconnect() {
  flash_leds(true, true, null, 10);
  is_connected = false;
}


function init () {
  NRF.on('connect', on_connect);
  NRF.on('disconnect', on_disconnect);

  clearWatch();
  clearInterval();
  clearTimeout();

  setTimeout(function () {
    digitalWrite(D31, true);
    pinMode(D1, 'input_pulldown');
    setWatch(btn_pressed, BTN, { repeat:true, edge:'rising', debounce : 50 });
    setWatch(btn_released, BTN, { repeat:true, edge:'falling', debounce : 50 });
    setWatch(sw_pressed, D1, { repeat:true, edge:'rising', debounce : 50 });
    setWatch(sw_released, D1, { repeat:true, edge:'falling', debounce : 50 });

    NRF.setServices(undefined, { hid : hid.report });
    start_update_bluetooth();
  }, 3000);
}

E.on('init', init);
