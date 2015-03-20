chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    var url = details.url;
    if (url.indexOf("dpapp") != -1) {
      return {
        redirectUrl: "http://localhost:3000/dpapp-debugger.js"
      }
    }
  }, {
    urls: ["<all_urls>"]
  }, ["blocking"]
)