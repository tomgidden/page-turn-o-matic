// Rewritten, trying to reduce power usage.
// However, have started to get:
//     NRF ERROR 0x8 at ?:0
//     REBOOTING.
// even after green light reset (no boot code) and E.setBootCode();
// the code is subsequently uploaded and it crashes during the save().
//
// Could be power, maybe?
// If not, thinking about clip-leading in Serial.



var hid = require("ble_hid_keyboard");

var led = require("RGBLed").connect([LED1,LED2,LED3], false);

// Detect short press ( < 2 seconds)
var is_short = false;
var short_timeout = false;

// Detect fast-click count ( < 0.25 seconds)
var clickcount = 0;
var clearclick_timeout;

// Sleep when not in use.  Needs to be long enough that it doesn't
// interfere with attempts to connect to it via the IDE.  Saying that,
// a triple click will postpone the sleep.
var sleep_timeout;
const sleep_delay = 15000; // 30 seconds
const sleep_longdelay = 60*60*1000; // 1 hour

var is_connected = false;

const ble_name = "Page-Turn-o-Matic 4000";
const enable_lpc = false;

function schedule_sleep(delay) {

  if (undefined !== sleep_timeout)
    clearTimeout(sleep_timeout);

  // Schedule the sleep function to run in the future.  A button click
  // will reset this timer.
  sleep_timeout = setTimeout(sleep, delay ? delay : sleep_delay);
}

function sleep() {

  // Flicker the LED to indicate sleep.  This is really for debugging
  flash('3f3f3f');

  // Clear the timeout
  sleep_timeout = undefined;

  // Disconnect any running HID sessions -- problematic; doesn't reconnect well.
  NRF.disconnect();
}

led.led_timeout = undefined;
led.off_after = function (delay) {
  var self = this;
  if (this.led_timeout) clearTimeout(this.led_timeout);
  this.led_timeout = setTimeout(function () { 
    self.off();
    self.led_timeout = undefined;
  }, delay ? delay : 100);
  return this;
};

function flash (color) {
  led.setColor(color);
  led.on();
  led.off_after(100);
}

function primary() {
  flash('00ff00');
  hid.tap(hid.KEY.RIGHT, 0);
}

function secondary() {
  flash('ff0000');
  hid.tap(hid.KEY.LEFT, 0);
}

function tertiary() {
  flash('ff7f00');

  schedule_sleep(sleep_longdelay);

  // Switch Bluetooth back to normal
  if (enable_lpc) NRF.setLowPowerConnection(false);

  // And disconnect
  NRF.disconnect();
}

// The reset function, on a long click (>2s)
function longclick() {
  flash('7fff00');
  clickcount = 0;
  if (enable_lpc) NRF.setLowPowerConnection(false);
  NRF.disconnect();
  NRF.restart();
  reset();
}



function btnPressed() {

  // Count clicks in chain
  clickcount ++;

  // Reset execution of short-click chain
  if (undefined !== clearclick_timeout) {
    clearTimeout(clearclick_timeout);
    clearclick_timeout = undefined;
  }

  // Assume it's a short press
  is_short = true;

  // Set a timeout for two seconds to recognise a long press
  short_timeout = setTimeout(function () {
    // It's been two seconds, so...

    // Long press detected
    is_short = false;
    short_timeout = null;

    // and don't do anything until release...
  }, 2000);
}

// Once a chain of repeated rapid clicks is over (ie.
// the 0.25 second threshold has passed)...
function chainEnded() {
  var o = clickcount;
  clickcount = 0;
  clearclick_timeout = undefined;

  // Reset the sleep watchdog
  schedule_sleep();

  switch (o) {
  case 1:
    // Simple click;  GREEN
    primary();
    break;

  case 2:
    // Double-click;  RED
    secondary();
    break;

  case 3:
    // Triple-click;  YELLOW?
    tertiary();
    break;

  default:
    // Too many clicks. Ignore.
    break;
  }
}

function btnReleased() {

  // `short_timeout` is there to _deny_ a short
  // click.  If it times out, then it means the button
  // has been held longer than a short click.
  //
  // So, for a short click, if the timeout is still going
  // then clear it:  `short` should remain whatever it is,
  // including `true`.
  if (short_timeout) {
    clearTimeout(short_timeout);
    short_timeout = null;
  }

  if (is_short) {
    // Set a timeout to process short clicks
    clearclick_timeout = setTimeout(chainEnded, 250);
  }
  else {
    // Long press: reset
    clearclick_timeout = undefined;
    longclick();
  }
}

function on_connect() {
  flash('00ff7f');
  is_connected = true;
}

function on_disconnect() {
  flash('ff007f');
  is_connected = false;
}

// Upon reset of the device
function init() {

  // Start connection monitor for is_connected flag
  NRF.removeAllListeners();

  NRF.on('connect', on_connect);
  NRF.on('disconnect', on_disconnect);

  NRF.setAdvertising( {}, { name: ble_name, discoverable: true } );
  NRF.setServices(undefined, { hid : hid.report });

  // Modifies the connection interval so next time it connects it's only
  // polling twice a second rather than ~50 times a second
  if (enable_lpc) NRF.setLowPowerConnection(true);

  // Set up button event handlers for both rising and falling.  These will
  // also take it out of sleepage.
  clearWatch();
  setWatch(btnPressed, BTN, { repeat:true, edge:'rising', debounce : 50 });
  setWatch(btnReleased, BTN, { repeat:true, edge:'falling', debounce : 50 });
}

// Set the initialisation function
E.on('init', init);


setTimeout(save, 1500);
