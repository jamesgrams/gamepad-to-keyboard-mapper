chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
    console.log(message);
    if(message.key){
        chrome.tabs.query({active: true}, function(tabs) {
            chrome.debugger.attach({ tabId: tabs[0].id }, "1.0", function() {
                chrome.debugger.sendCommand({ tabId: tabs[0].id }, 'Input.dispatchKeyEvent', { type: message.down ? "keyDown" : "keyUp", windowsVirtualKeyCode:message.key, nativeVirtualKeyCode: message.key, macCharCode: message.key, text: String.fromCharCode(message.key)  }, function() {
                    chrome.debugger.detach({ tabId: tabs[0].id });
                });
            });
        });
    }
});