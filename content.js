/**
* Gamepad to Keyboard Mapper script to run on all pages.
*/


var RELOAD_INTERVAL = 5000;

var GAMEPAD_INTERVAL = 500;
var GAMEPAD_INPUT_INTERVAL = 10;
var AXIS_MIN_TO_BE_BUTTON = 0.5;
var MAX_JOYSTICK_VALUE = 128;
var gamePadInterval;
var gamepadButtonsDown = {};
var gamepadAxisLastValues = {};
var gamepadButtonsPressed = {};

var controllerMap = [];

window.addEventListener("load", function() {
    chrome.storage.local.get(['controllerMap'], function(result) {
        controllerMap = result.controllerMap;
        gamePadInterval = setInterval(pollGamepads, GAMEPAD_INTERVAL);
    });

    // reload the controller map on the page every so often
    setInterval( function() {
        try {
            chrome.storage.local.get(['controllerMap'], function(result) {
                controllerMap = result.controllerMap;
            });
        }
        catch(err) {
            console.log(err);
        }
    }, 5000 );
});

/**
 * Poll for gamepads. 
 * Used for Chrome support
 * See here: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
 */
 function pollGamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
    for (var i = 0; i < gamepads.length; i++) {
        var gp = gamepads[i];
        if (gp) {
            manageGamepadInput();
            clearInterval(gamePadInterval);
        }
    }
}

/**
 * Manage gamepad input.
 */
 function manageGamepadInput() {

    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
    if(!gamepads) {
        gamePadInterval = setInterval(pollGamepads, GAMEPAD_INTERVAL);
        return;
    }
    
    try {
        for (var i=0; i<gamepads.length; i++) {
            var gp = gamepads[i];
            if( !gp ) continue;

            if(!gamepadButtonsDown[i] || !document.hasFocus()) {
                gamepadButtonsDown[i] = {};
                gamepadAxisLastValues[i] = {};
            }
            // reset each time
            gamepadButtonsPressed[i] = {};

            if( !document.hasFocus() ) continue;

            // Check the gamepad's buttons
            // First we will determine what buttons are pressed, then we will use those buttons
            for( var j=0; j<gp.buttons.length; j++ ) {
                if( ( !gamepadButtonsDown[i][j] && buttonPressed(gp.buttons[j]) ) || ( gamepadButtonsDown[i][j] && !buttonPressed(gp.buttons[j]) ) ) {
                    if( !gamepadButtonsDown[i][j] ) {
                        gamepadButtonsDown[i][j] = true;
                        gamepadButtonsPressed[i][j] = true;
                    }
                    else {
                        gamepadButtonsDown[i][j] = false;
                    }
                    sendButtonsToMapper( j, gamepadButtonsDown[i][j] );
                }
            }

            // Check the gamepad's axes
            for( var j=0; j<gp.axes.length; j++ ) {

                // the axis is mapped to a button
                var direction = gp.axes[j] >= 0 ? "+" : "-";
                var previousDirection = gamepadAxisLastValues[i][j] >= 0 ? "+" : "-";
                if( Math.abs(gp.axes[j]) >= AXIS_MIN_TO_BE_BUTTON && ( Math.abs(gamepadAxisLastValues[i][j]/MAX_JOYSTICK_VALUE) < AXIS_MIN_TO_BE_BUTTON || previousDirection != direction ) ) {
                    var oppositeDirection = direction == "+" ? "-" : "+";
                    sendButtonsToMapper( j + direction, true );
                    // in case we rapidly switched directions and it didn't get cleared out
                    sendButtonsToMapper( j + oppositeDirection, false );
                    gamepadButtonsDown[i][ j + direction ] = true;
                    gamepadButtonsPressed[i][ j + direction ] = true;
                    // in case we rapidly switched directions and it didn't get cleared out
                    gamepadButtonsDown[i][ oppositeDirection ] = false;
                    gamepadButtonsPressed[i][ oppositeDirection ] = false;
                }
                else if( Math.abs(gp.axes[j]) < AXIS_MIN_TO_BE_BUTTON && Math.abs(gamepadAxisLastValues[i][j]/MAX_JOYSTICK_VALUE) >= AXIS_MIN_TO_BE_BUTTON ) {
                    sendButtonsToMapper( j + "+", false );
                    sendButtonsToMapper( j + "-", false );
                    gamepadButtonsDown[i][ j + "+" ] = false;
                    gamepadButtonsDown[i][ j + "-" ] = false;
                }
                gamepadAxisLastValues[i][j] = gp.axes[j] * MAX_JOYSTICK_VALUE;
            }
        }
    }
    catch( err ) {
        console.log(err);
        gamePadInterval = setInterval(pollGamepads, GAMEPAD_INTERVAL);
        return;
    }
    setTimeout(manageGamepadInput, GAMEPAD_INPUT_INTERVAL);
}

/**
 * Send screencast buttons to a mapper from a client gamepad.
 * This function translates the client gamepad button with the button mapping.
 * @param {string} clientButton - Either the button number or the axis number and a direction.
 * @param {boolean} [down] - Optional parameter to force a direction (used for axis whose states aren't tracked in gamepadButtonsDown)
 */
 function sendButtonsToMapper( clientButton, down ) {
    var mapping = findMapping(clientButton);
    if( mapping ) {
        for( var i=0; i<mapping.length; i++ ) {
            // everything is a string until the background page
            if( ["INPUT", "TEXTAREA"].indexOf(document.activeElement.tagName) !== -1 ) {
                chrome.runtime.sendMessage({ key: parseInt(mapping[i].keyCode), down: down });
            }
            else {
                document.activeElement.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", {
                    key: mapping[i].key,
                    keyCode: parseInt(mapping[i].keyCode),
                    code: mapping[i].code,
                    which: parseInt(mapping[i].keyCode),
                    bubbles: true,
                    cancelable: true
                }));
            }
        }
    }
}

/**
 * Find all the mappings for a gamepad button.
 * @param {string} button - The gamepad button.
 * @returns {Array<string>} An array of all the keycodes the button is mapped to.
 */
function findMapping(button) {
    var mappings = [];
    for( var i=0; i<controllerMap.length; i++ ) {
        if( controllerMap[i].button == button ) mappings.push( controllerMap[i] ).key;
    }
    return mappings;
}

/**
 * Determine if a button is pressed.
 * @param {*} b - An object to test.
 */
 function buttonPressed(b) {
    if (typeof(b) == "object") {
        return b.pressed;
    }
    return b == 1.0;
}