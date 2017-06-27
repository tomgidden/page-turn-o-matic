var hid = require("ble_hid_keyboard");

function init () {

  var sleep_timeout;
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

  function blinken (colour, count)
  {
    digitalWrite([LED1,LED2,LED3], colour);
    setTimeout(function(){
      digitalWrite([LED1,LED2,LED3], 0);
      if (count > 1) {
        setTimeout(function () {
          blinken(colour, --count);
        }, 50);
      }
    }, 25);
  }

  function set_sleep_timeout() {
    if (sleep_timeout)
      clearTimeout(sleep_timeout);

    sleep_timeout = setTimeout(function () {
      clear_sleep_timeout();
      NRF.disconnect();
    }, 1000*60*5);
  }

  function clear_sleep_timeout() {
    if (sleep_timeout) {
      clearTimeout(sleep_timeout);
      sleep_timeout = undefined;
    }
  }

  // Connection tracking

  function on_connect () {
    blinken(0b011);
    is_connected = true;
  }

  function on_disconnect() {
    clear_sleep_timeout();
    blinken(0b101);
    is_connected = false;

    // Delay sleep slightly to work around problem: http://forum.espruino.com/comments/13708515/
    setTimeout(function () {
      NRF.sleep(); // Prevent reconnection until manually woken
    }, 250);
  }


  // Button click events

  function on_click (c) {
    set_sleep_timeout();

    if (is_connected) {
      // Single flash - move right
      blinken(0b010, 1);
      hid.tap(hid.KEY.RIGHT, 0);
    }
    else {
      NRF.wake();
      blinken(0b001);
    }
  }

  function on_double (c) {
    set_sleep_timeout();

    if (is_connected) {
      // Double flash - move left
      blinken(0b010, 2);
      hid.tap(hid.KEY.LEFT, 0);
    }
    else {
      NRF.wake();
      blinken(0b001);
    }
  }

  function on_triple (c) {
    NRF.disconnect(); // on('disconnect') causes NRF.sleep
  }

  function on_quadruple (c) {
    blinken(0b110);
    NRF.wake();
  }

//  Serial1.setConsole(true);

  clearWatch();
  clearTimeout();

  btn = new Btn(BTN);

  NRF.removeAllListeners();
  NRF.on('connect', on_connect);
  NRF.on('disconnect', on_disconnect);

  NRF.setAdvertising({}, ad_options);
  NRF.setServices(undefined, { hid : hid.report });

  btn.on('click', on_click);
  btn.on('double', on_double);
  btn.on('triple', on_triple);
  btn.on('quadruple', on_quadruple);

  console.log(NRF.getBattery());
}

E.removeAllListeners();
E.on('init', init);
save();
