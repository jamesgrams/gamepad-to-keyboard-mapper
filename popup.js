var GAMEPAD_INTERVAL = 500;
var GAMEPAD_INPUT_INTERVAL = 10;
var AXIS_MIN_TO_BE_BUTTON = 0.5;
var MAX_JOYSTICK_VALUE = 128;
var gamePadInterval;
var gamepadButtonsDown = {};
var gamepadAxisLastValues = {};
var gamepadButtonsPressed = {};

var focusInterval = null;
var FOCUS_NEXT_INTERVAL = 500;

window.addEventListener("load", function() {
    chrome.storage.local.get(["controllerMap"], function(result) {
        var controllerMap = result.controllerMap;
        for(var i=0; i<controllerMap.length; i++ ) {
            createMappingInput( controllerMap[i].button, controllerMap[i].keyCode, controllerMap[i].key, controllerMap[i].code );
        }
        console.log(result);
    });

    document.querySelector("#add").onclick = function() {
        createMappingInput();
        saveMapping();
    };

    gamePadInterval = setInterval(pollGamepads, GAMEPAD_INTERVAL);
});

/**
 * Create a mapping.
 * @param {string} [button] - gamepad button/axis<direction>. 
 * @param {string} [keyCode] - Keyboard charcode.
 * @param {string} [key] - The key value to display.
 * @param {string} [code] - The keyboard "code" (e.g. KeyA);
 */
function createMappingInput( button, keyCode, key, code ) {
    if( button === undefined ) button = "";
    if( keyCode === undefined ) keyCode = "";
    if( key === undefined ) key = "";
    if( code === undefined ) code = "";

    var section = document.createElement("div");
    section.classList.add("mapping");

    var label = document.createElement("label");
    label.innerText = "Gamepad: ";
    var input = document.createElement("input");
    input.classList.add("gamepad-input");
    input.setAttribute("type", "text");
    input.setAttribute("pattern", "^(\\d+[\\+\\-]?)?$");
    input.value = button;
    var re = new RegExp(input.getAttribute("pattern"));
    var prevVal = button;
    input.oninput = function(e) {
        console.log(input.value);
        if( input.value.match(re) ) {
            prevVal = input.value;
        }
        else {
            input.value  = prevVal;
        }
        saveMapping();
    };
    label.appendChild(input);
    section.appendChild(label);

    var keyboardLabel = document.createElement("label");
    keyboardLabel.innerText = "Keyboard: ";
    var keyboardInput = document.createElement("input");
    keyboardInput.classList.add("keyboard-input");
    keyboardInput.setAttribute("type", "search");
    keyboardInput.setAttribute("data-keycode", keyCode);
    keyboardInput.setAttribute("data-code",code);
    keyboardInput.value = key;
    keyboardInput.onkeydown = function(e) {
        keyboardInput.value = e.key;
        keyboardInput.setAttribute("data-keycode", e.key.match(/[a-z]/) ? e.key.charCodeAt(0) : e.keyCode); // charCodeAt gets lowercase
        keyboardInput.setAttribute("data-code", e.code);
        saveMapping();
        e.preventDefault();
        var allInputs = document.querySelectorAll("#mappings input");
        var index = Array.from(allInputs).indexOf(keyboardInput);
        focusNextInput(allInputs[index + 1]);
    };
    keyboardLabel.appendChild(keyboardInput);
    section.appendChild(keyboardLabel);

    var deleteButton = document.createElement("button");
    deleteButton.innerText = "X";
    section.appendChild(deleteButton);
    deleteButton.onclick = function() {
        section.parentElement.removeChild(section);
        saveMapping();
    }

    document.querySelector("#mappings").appendChild(section);
}

/**
 * Save the current mapping.
 */
function saveMapping() {
    var mappings = document.querySelectorAll(".mapping");
    var controllerMap = [];
    for( var i=0; i<mappings.length; i++ ) {
        var button = mappings[i].querySelector(".gamepad-input").value;
        if( button ) {
            var keyboardInput =  mappings[i].querySelector(".keyboard-input");
            var keyCode = keyboardInput.getAttribute("data-keycode");
            var key = keyboardInput.value;
            var code = keyboardInput.getAttribute("data-code");
            if( key ) {
                controllerMap.push({
                    button: button,
                    keyCode: keyCode,
                    key: key,
                    code: code
                });
            }
        }
    }
    console.log(controllerMap);
    chrome.storage.local.set({"controllerMap": controllerMap});
}

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
                }
            }

            // Check the gamepad's axes
            for( var j=0; j<gp.axes.length; j++ ) {

                // the axis is mapped to a button
                var direction = gp.axes[j] >= 0 ? "+" : "-";
                var previousDirection = gamepadAxisLastValues[i][j] >= 0 ? "+" : "-";
                if( Math.abs(gp.axes[j]) >= AXIS_MIN_TO_BE_BUTTON && ( Math.abs(gamepadAxisLastValues[i][j]/MAX_JOYSTICK_VALUE) < AXIS_MIN_TO_BE_BUTTON || previousDirection != direction ) ) {
                    var oppositeDirection = direction == "+" ? "-" : "+";
                    gamepadButtonsDown[i][ j + direction ] = true;
                    gamepadButtonsPressed[i][ j + direction ] = true;
                    // in case we rapidly switched directions and it didn't get cleared out
                    gamepadButtonsDown[i][ oppositeDirection ] = false;
                    gamepadButtonsPressed[i][ oppositeDirection ] = false;
                }
                else if( Math.abs(gp.axes[j]) < AXIS_MIN_TO_BE_BUTTON && Math.abs(gamepadAxisLastValues[i][j]/MAX_JOYSTICK_VALUE) >= AXIS_MIN_TO_BE_BUTTON ) {
                    gamepadButtonsDown[i][ j + "+" ] = false;
                    gamepadButtonsDown[i][ j + "-" ] = false;
                }
                gamepadAxisLastValues[i][j] = gp.axes[j] * MAX_JOYSTICK_VALUE;
            }

            var inputs = document.querySelectorAll(".gamepad-input");
            var allInputs = document.querySelectorAll("#mappings input");
            if( !focusInterval ) {
                for( var j=0; j<inputs.length; j++ ) {
                    if( inputs[j] === document.activeElement ) {
                        var gamepadButtonsDownKeys = Object.keys(gamepadButtonsDown[0]).sort( function(a,b) {
                            var aMatch = a.match(/^\d+$/);
                            var bMatch = b.match(/^\d+$/);
                            if( aMatch && !bMatch ) return -1;
                            if( bMatch && !aMatch ) return 1;
                            if( a < b ) return -1;
                            if( a > b ) return 1;
                            return 0;
                        } ); // we want buttons to get priority and go first
                        for( var k=0; k<gamepadButtonsDownKeys.length; k++ ) {
                            var currentButton = gamepadButtonsDownKeys[k];
                            if( gamepadButtonsPressed[i][currentButton] ) {
                                // button
                                inputs[j].value = currentButton;
                                var index = Array.from(allInputs).indexOf(inputs[j]);
                                focusNextInput(allInputs[index + 1]);
                            }
                        }
                    }
                }
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
 * Focus on the next input.
 * @param {HTMLElement} nextInput - The next input to focus on.
 */
 function focusNextInput( nextInput ) {
    if( nextInput ) {
        if( focusInterval ) {
            clearTimeout(focusInterval);
            focusInterval = null;
        }
        focusInterval = setTimeout( function() { nextInput.focus(); focusInterval=null; }, FOCUS_NEXT_INTERVAL );
    } 
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