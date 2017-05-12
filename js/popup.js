


var resetin = document.getElementById("resetin")
var lockin = document.getElementById("lockin")
var reloadin = document.getElementById("reloadin")

var timerin = document.getElementById("timerin")
var timerisin = document.getElementById("timerisin")
var timersetin = document.getElementById("timersetin")


// loop on/off
timersetin.onmouseover = function () {
  this.src = '../img/clockh.svg'
}
timersetin.onmouseout = function () {
  this.src = '../img/clockok.svg'
}

// loop on/off
resetin.onmouseover = function () {
  this.src = '../img/reseth.svg'
}
resetin.onmouseout = function () {
  chrome.extension.getBackgroundPage().setReset(chrome.extension.getBackgroundPage().isReset())
}

//login/out
lockin.onmouseover = function () {
  this.src = '../img/lockh.svg'
}
lockin.onmouseout = function () {
  chrome.extension.getBackgroundPage().setLogged(chrome.extension.getBackgroundPage().isLogged())
}

//fetch
reloadin.onmouseover = function () {
  if (!chrome.extension.getBackgroundPage().isFetching()) {
    this.src = '../img/reloadh.svg'
  }
}
reloadin.onmouseout = function () {
  chrome.extension.getBackgroundPage().setFetching(chrome.extension.getBackgroundPage().isFetching())
}








timersetin
  .addEventListener("click"
  , chrome.extension.getBackgroundPage().setTimer);


resetin
  .addEventListener("click"
  , chrome.extension.getBackgroundPage().switchloop);

lockin
  .addEventListener("click"
  , chrome.extension.getBackgroundPage().loginidentity);

reloadin
  .addEventListener("click"
  , chrome.extension.getBackgroundPage().runsubs);



//each popup opening
chrome.extension.getBackgroundPage().getTimer()
chrome.extension.getBackgroundPage().addInnerLives()
chrome.extension.getBackgroundPage().setReset(chrome.extension.getBackgroundPage().isReset())
