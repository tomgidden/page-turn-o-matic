var hid = require("ble_hid_keyboard");

var is_connected = false;

var ad_values = {};
var ad_options = { name: "Page-Turn-o-Matic 4000" };



// Object to handle multiple-clicking and long-clicking on
// a button, using EventEmitter.
function Btn(btn) {
  var o = this;
  o.es = [0,'click','double','triple','quadruple'];

  o.br = function (e) {
    if ( 2.0 < e.time - e.lastTime) {
      if (o.h)
        clearTimeout(o.h);
      o.i = o.h = o.l = undefined;
      o.emit('long', 0);
    }
    else {
      // If there's no previous click or it's more than
      // a second ago, it's a new chain of clicks.
      if (!o.i || !o.l || 1.0 < e.time - o.l)
        o.i = 1;
      else
        o.i ++;

      o.l = e.time;

      if (o.h)
        clearTimeout(o.h);

      o.h = setTimeout(function () {
        o.h = undefined;
        if (o.es[o.i]) o.emit(o.es[o.i], o.i);
        o.i = 0;
      }, 400);
    }
  };

  o.w = setWatch(o.br, btn, { repeat:true, edge:'falling', debounce : 50 });

  return o;
}

var btn;





// Connection tracking

function on_connect () {
  digitalPulse(LED3, true, 100);
  is_connected = true;
}

function on_disconnect() {
  digitalPulse(LED1, true, 100);
  is_connected = false;
  NRF.sleep();
}


// Button click events

function click (c) {
  if (is_connected) {
    digitalPulse(LED2, true, 25);
    hid.tap(hid.KEY.RIGHT, 0);
  }
  else {
    NRF.wake();
    digitalPulse(LED1, true, 100);
  }
}

function double (c) {
  if (is_connected) {
    digitalPulse(LED2, true, 25);
    setTimeout(function(){digitalPulse(LED2, true, 25);},100);
    hid.tap(hid.KEY.LEFT, 0);
  }
  else {
    NRF.wake();
    digitalPulse(LED1, true, 100);
  }
}

function triple (c) {
  NRF.disconnect(); // on('disconnect') causes NRF.sleep
  digitalWrite([LED2,LED3], 0b11);
  setTimeout(function(){digitalWrite([LED2,LED3],0);},25);
}

function quadruple (c) {
  digitalPulse(LED3, true, 25);
  digitalPulse(LED2, true, 25);
  digitalPulse(LED1, true, 25);
  NRF.wake();
}


function update_advert() {
//  ad_values[0x180F] = [Math.round(Puck.getBatteryPercentage())];
  NRF.setAdvertising(ad_values, ad_options);
}

// Initialisation

function init () {
  NRF.on('connect', on_connect);
  NRF.on('disconnect', on_disconnect);

  update_advert();
  NRF.setServices(undefined, { hid : hid.report });

  btn = new Btn(BTN);
  btn.on('click', click);
  btn.on('double', double);
  btn.on('triple', triple);
  btn.on('quadruple', quadruple);
}

E.on('init', init);


