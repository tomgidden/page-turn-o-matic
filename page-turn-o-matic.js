var hid = require("ble_hid_keyboard");

var long_click = 2000;  // 2 seconds
var double_click = 250; // 0.25 second

// Detect short press ( < 2 seconds)
var short = false;
var short_timeout = false;

// Detect fast-click count ( < 0.25 seconds)
var clickcount = 0;
var clearclick_timeout;

// Reset
function init() {
  // Clear any current button event handlers
  clearWatch();
  
  // Set up HID (keyboard) services
  NRF.setServices(undefined, { hid : hid.report });
  
  // Name it
  NRF.setAdvertising({},{name:"Page-Turn-O-Matic 4000™"});
  
  // Set up button event handlers for both rising and falling
  setWatch(btnPressed, BTN, { repeat:true, edge:'rising', debounce : 50 });
  setWatch(btnReleased, BTN, { repeat:true, edge:'falling', debounce : 50 });
}

// The primary action, on a single click
function primary() {
  hid.tap(hid.KEY.RIGHT, 0);
}

// The secondary action, on a double click
function secondary() {
  hid.tap(hid.KEY.LEFT, 0);
}

// The reset function, on a long click (>2s)
function long() {
  NRF.disconnect();
  init();
}

function btnPressed() {

  // When the button's pressed, we clear the LEDs. Any
  // LED activity is on _release_
  digitalWrite([LED1,LED2,LED3], 0);

  // Count clicks in chain
  clickcount ++;

  // Reset execution of short-click chain
  if (undefined !== clearclick_timeout) {
    clearTimeout(clearclick_timeout);
    clearclick_timeout = undefined;
  }
  
  // Assume it's a short press
  short = true; 

  // Set a timeout for two seconds to recognise a long press
  short_timeout = setTimeout(function () {
    // It's been two seconds, so...
    
    // Long press detected
    short = false;
    short_timeout = null;
    
    // Full blast RGB
    digitalWrite([LED1,LED2,LED3], 0x111);
    
    // and don't do anything until release...
    
  }, long_click);
}

// Once a chain of repeated rapid clicks is over (ie.
// the 0.25 second threshold has passed)...
function chainEnded() {
  var o = clickcount;
  clickcount = 0;
  clearclick_timeout = undefined;

  switch (o) {
  case 1:
    // Simple click;  GREEN
    digitalWrite([LED1,LED2,LED3], 0b010);
    primary();
    break;

  case 2:
    // Double-click;  RED
    digitalWrite([LED1,LED2,LED3], 0b100);
    secondary();
    break;

      
  // Triple-click, etc. can be added as additional
  // `case`s.
      
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
  
  if (short) {
    // Set a timeout to process short clicks
    clearclick_timeout = setTimeout(chainEnded, 250);
  }
  else {
    // Long press: reset
    digitalWrite([LED1,LED2,LED3], 0x001);
    clearclick_timeout = undefined;
    long();
  }
  
  // And clear any LEDs after a reasonable period.
  setTimeout(function () {
    digitalWrite([LED1,LED2,LED3], 0);
  }, double_click);
}

// Set the initialisation function
E.on('init', init);

