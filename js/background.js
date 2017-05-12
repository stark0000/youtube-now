chrome.browserAction.setBadgeBackgroundColor({
    color: '#555'
});
chrome.browserAction.setBadgeText({
    text: '0'
});

var CLIENT_ID = {YOUR_CLIENT_ID}
var GOOGLE_KEY = {YOUR_GOOGLE_KEY}



// If you make changes here, you have to reload the extension (in settings) for them to take effect

// Any function in this file can be referenced elsewhere by using chrome.extension.getBackgroundPage().myFunction()
// For example, you can reference the login function as chrome.extension.getBackgroundPage().login()

var config = {
    implicitGrantUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: CLIENT_ID,
    scopes: 'https://www.googleapis.com/auth/youtube',
    logoutUrl: 'https://accounts.google.com/Logout'
}

var token = null;
var logger = console;
var timeout;

function init(cfg, log) {
    config = cfg;
    logger = log;
}

function getLastToken() {
    return token;
}

function login(config, callback) {

    var authUrl = config.implicitGrantUrl
        + '?response_type=token&client_id=' + config.clientId
        + '&scope=' + config.scopes
        + '&redirect_uri=' + chrome.identity.getRedirectURL("oauth2");

    logger.debug('launchWebAuthFlow:', authUrl);

    chrome.identity.launchWebAuthFlow({ 'url': authUrl, 'interactive': true }, function (redirectUrl) {
        if (redirectUrl) {
            logger.debug('launchWebAuthFlow login successful: ', redirectUrl);
            var parsed = parse(redirectUrl.substr(chrome.identity.getRedirectURL("oauth2").length + 1));
            token = parsed.access_token;
            logger.debug('Background login complete');
            setLogged(true)
            return callback(redirectUrl); // call the original callback now that we've intercepted what we needed
        } else {
            logger.debug("launchWebAuthFlow login failed. Is your redirect URL (" + chrome.identity.getRedirectURL("oauth2") + ") configured with your OAuth2 provider?");
            return (null);
        }
    });
}

function logout(config, callback) {
    var logoutUrl = config.logoutUrl;

    chrome.identity.launchWebAuthFlow({ 'url': logoutUrl, 'interactive': false }, function (redirectUrl) {
        logger.debug('launchWebAuthFlow logout complete');
        setLogged(false)
        return callback(redirectUrl)
    });
}

function parse(str) {
    if (typeof str !== 'string') {
        return {};
    }
    str = str.trim().replace(/^(\?|#|&)/, '');
    if (!str) {
        return {};
    }
    return str.split('&').reduce(function (ret, param) {
        var parts = param.replace(/\+/g, ' ').split('=');
        // Firefox (pre 40) decodes `%3D` to `=`
        // https://github.com/sindresorhus/query-string/pull/37
        var key = parts.shift();
        var val = parts.length > 0 ? parts.join('=') : undefined;
        key = decodeURIComponent(key);
        // missing `=` should be `null`:
        // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
        val = val === undefined ? null : decodeURIComponent(val);
        if (!ret.hasOwnProperty(key)) {
            ret[key] = val;
        }
        else if (Array.isArray(ret[key])) {
            ret[key].push(val);
        }
        else {
            ret[key] = [ret[key], val];
        }
        return ret;
    }, {});
}




//==========================================================================

var BASE_URL = 'https://www.googleapis.com/youtube/v3/'
var SUBS_URL = 'subscriptions?part=snippet&mine=true'
var SPEC_URL = '&maxResults=50&key=' + GOOGLE_KEY

var SUBS_P1 = BASE_URL + SUBS_URL + SPEC_URL
var SUBS_T1 = BASE_URL + 'subscriptions?pageToken='
var SUBS_T2 = '&part=snippet&mine=true' + SPEC_URL

var LIVE_L1 = BASE_URL + 'search?part=snippet&channelId='
var LIVE_L2 = '&type=video&eventType=live%7Cupcoming' + SPEC_URL

var xdlol = document.getElementById('xdlol');
var fetchstatus = document.getElementById('fetchstatus');

var testb1 = document.getElementById('t1');
var testb2 = document.getElementById('t2');


var logerr = document.getElementById('log');

var subsId = []
var stillOn = []
var loop = true


function loginidentity() {
    console.log("get token")
    login(config, settoken)
}

function settoken(redirecturi) {
    var parsedResponse = JSON.stringify(redirecturi)
    var pr = parsedResponse.substring(parsedResponse.search("access_token="))
    var token = pr.substring(13, pr.search('&'))
    saveChanges(token)
}
function saveChanges(token) {
    var theValue = token;
    chrome.storage.local.set({ "token": theValue }, function () {
        console.log('Settings saved');
    });
}

function runsubs() {
    if (!isLogged()) {
        console.log("not logged")
    } else if (isReset()) {
        setFetching(true)
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () { orsc(xhr, 0) };
        callXhr(xhr, null);
    } else {
        console.log("no loop")
    }
}

function nexttoken(token, index) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () { orsc(xhr, index) };
    callXhr(xhr, token);
}

function callXhr(xhr, token) {


    var SUBS_P1 = BASE_URL + SUBS_URL + SPEC_URL
    var SUBS_T1 = BASE_URL + 'subscriptions?pageToken='
    var SUBS_T2 = '&part=snippet&mine=true' + SPEC_URL

    var request = ''
    if (token == null) {
        request = SUBS_P1
    } else {
        request = SUBS_T1 + token + SUBS_T2
    }
    xhr.open('GET', request, true);

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'OAuth ' + getLastToken());

    xhr.send();
}

function orsc(xhr, index) {
    if (index === 0) {
        subsId = []
    }
    if (xhr.readyState == 4) {
        if (xhr.status == 200 || xhr.status == 304) {


            var activitiesResponse = JSON.parse(xhr.responseText);


            refreshFetchSubs(activitiesResponse.pageInfo.totalResults, index)

            var items = activitiesResponse.items;
            for (var i = 0; i < items.length; i++) {
                subsId.push(items[i].snippet.resourceId.channelId)
                //console.log("channel found> " + items[i].snippet.title)
            }
            if (activitiesResponse.nextPageToken) {
                nexttoken(activitiesResponse.nextPageToken, index + 1)
            } else {
                //getLives(subsId)
                setWatchOffline()
                getLivesSeries(subsId, 0)
            }
        } else {
            logErrorSubsR(xhr)
        }
    }
}



function getLivesSeries(subsId, index) {
    refreshFetchLives(subsId.length, index)
    if (index < subsId.length) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () { livesHandlerSeries(xhr, subsId, index) };
        callXhrLive(xhr, subsId[index]);
    } else {
        endFetch()
    }
}

function callXhrLive(xhr, channelId) {

    var LIVE_L1 = BASE_URL + 'search?part=snippet&channelId='
    var LIVE_L2 = '&type=video&eventType=live' + SPEC_URL

    var request = LIVE_L1 + channelId + LIVE_L2
    xhr.open('GET', request, true);

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'OAuth ' + getLastToken());

    xhr.send();
}

function livesHandlerSeries(xhr, subsId, index) {
    if (xhr.readyState == 4) {
        if (xhr.status == 200 || xhr.status == 304) {

            var activitiesResponse = JSON.parse(xhr.responseText);
            if (activitiesResponse.pageInfo.totalResults === 0) {
            } else {
                console.log("live found>" + activitiesResponse.items[0].snippet.title)

                if (activitiesResponse.items) {
                    addLiveStorage(activitiesResponse.items[0])
                }
            }

        } else {
            logErrorLiveR(xhr)
        }
        ind = index + 1
        getLivesSeries(subsId, ind)

    }
}

function addLiveStorage(item) {
    storeAtLives(item)
    addInnerLives()
}

function storeAtLives(item) {
    chrome.storage.local.get({ lives: [] }, function (result) {
        var lives = result.lives
        var isin = false
        if (lives.length > 0) {
            for (var i = 0; i < lives.length; i++) {

                if (lives[i].item.snippet.channelId === item.snippet.channelId) {
                    isin = true
                    watchOfflines(i)
                    break;
                }
            }
        }
        if (!isin) {

            notify(
                item.snippet.thumbnails.default.url,
                'https://www.youtube.com/watch?v=' + item.id.videoId,
                item.snippet.channelTitle,
                item.snippet.title
            )

            lives.push({ item })
            chrome.storage.local.set({ lives: lives }, function () {
                chrome.storage.local.get('lives', function (result) {
                })
            })
        } else {
        }
    });
}

function notify(picurl, vidurl, subname, vidtitle) {
    if (!Notification) {
        alert('Desktop notifications not available');
        return;
    }

    if (Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification(subname, {
            icon: '../img/ytn.png',
            body: vidtitle,
        });

        notification.onclick = function () {
            window.open(vidurl);
        };

    }
}

function addInnerLives() {
    addInnerLive(null)
    chrome.storage.local.get({ lives: [] }, function (result) {
        var lives = result.lives
        nblives(lives.length)
        if (lives.length < 1) {
            addInnerLive(null)
        } else {
            for (var i = 0; i < lives.length; i++) {
                addInnerLive(lives[i].item)
            }
        }
    });
}

function nblives(nb) {
    var nblive = nb.toString()
    chrome.browserAction.setBadgeText({
        text: nblive
    });
}


function setWatchOffline() {
    stillOn = []
    chrome.storage.local.get({ lives: [] }, function (result) {
        var lives = result.lives
        for (var i = 0; i < lives.length; i++) {
            stillOn.push(false)
        }
    });
}
function watchOfflines(index) {
    stillOn[index] = true
}
function removeOfflines() {
    chrome.storage.local.get({ lives: [] }, function (result) {
        var lives = result.lives
        var cleanedLives = []
        for (var i = 0; i < lives.length; i++) {
            if (i >= stillOn.length || stillOn[i]) {
                cleanedLives.push(lives[i])
            }
        }
        chrome.storage.local.set({ lives: cleanedLives }, function () {
            chrome.storage.local.get('lives', function (result) {
            })
        })

    });
}


var isfetching = false
var islogged = false

function isLogged() {
    return islogged
}
function setLogged(b) {
    islogged = b
    if (isPopupOpen()) {
        if (b) {
            getlockin().src = '../img/lockok.svg'
        } else {
            getlockin().src = '../img/lockno.svg'
        }
    }
}

function isFetching() {
    return isfetching
}
function setFetching(b) {
    isfetching = b
    if (isPopupOpen()) {
        if (b) {
            getReloadin().src = '../img/reloadno.svg'
        } else {
            getReloadin().src = '../img/reloadok.svg'
        }
    }
}
function isReset() {
    return loop
}
function setReset(b) {
    if (isPopupOpen()) {
        if (b) {
            getResetin().src = '../img/resetok.svg'
        } else {
            getResetin().src = '../img/resetno.svg'
        }
    }
}


function switchloop() {
    loop = (loop ? false : true)
    if (isPopupOpen()) {
        getFetchStatus().innerHTML = "loop:" + loop
    }
    if (!loop) {
        //setFetching(false)
        clearTimeout(timeout)
    }
    console.log("loop:" + loop)
}

function endFetch() {
    removeOfflines()
    if (isPopupOpen()) {
        getFetchStatus().innerHTML = "fetch done"
    }
    setFetching(false)
    console.log("end fetch")
    if (isReset()) {

        timeout = setTimeout(runsubs, getTimerSync())
    }
}




function refreshFetchSubs(max, index) {
    if (isPopupOpen()) {
        getFetchStatus().innerHTML = "subs: /" + max
    }
    //console.log("subs:" + max)
}
function refreshFetchLives(max, index) {
    if (isPopupOpen()) {
        getFetchStatus().innerHTML = 'lives: ' + index + '/' + max
    }
    //console.log('lives: ' + index + '/' + max)
}


function logErrorSubsR(xhr) {
    if (isPopupOpen()) {
        getLogger().innerHTML = "error while fetching subs"
    }
    setFetching(false)
    console.log("error while fetching subs")
}
function logErrorLiveR(xhr) {
    if (isPopupOpen()) {
        getLogger().innerHTML = "error while fetching lives"
    }
    setFetching(false)
    console.log("error while fetching lives")
}

function addInnerLive(item) {
    if (isPopupOpen()) {
        if (!item) {
            getXdlol().innerHTML = ""
        } else {
            getXdlol().innerHTML +=
                '<div class="liveitem" id="' + item.id.videoId + '" >'
                + '<a target="_blank" href="https://www.youtube.com/watch?v=' + item.id.videoId + '" >'
                + '<table><tr><td>'
                + '<img class="lipic" src="' + item.snippet.thumbnails.default.url + '" />'
                + '</td><td>'
                + '<p class="lichannel elipsed">' + item.snippet.channelTitle + '</p>'
                + '<p class="lititle elipsed">' + item.snippet.title + '</p>'
                + '<p class="lidesc elipsed">' + item.snippet.description + '</p>'
                + '</td></tr></table></a></div><hr>'

        }
    }
}

function isPopupOpen() {
    var popups = chrome.extension.getViews({ type: "popup" });
    return 0 < popups.length
}
function getXdlol() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('xdlol');
    }
    return null
}
function getFetchStatus() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('fetchstatus');
    }
    return null

}
function getLogger() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('log');
    }
    return null
}

function getlockin() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('lockin');
    }
    return null
}
function getReloadin() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('reloadin');
    }
    return null
}
function getResetin() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('resetin');
    }
    return null
}
function getTimerin() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('timerin');
    }
    return null
}
function getTimerisin() {
    var popups = chrome.extension.getViews({ type: "popup" });
    if (0 < popups.length) {
        return popups[0].document.getElementById('timerisin');
    }
    return null
}

var synctimer = 10*60*1000
function getTimerSync(){
    return synctimer;
}
function setTimerSync(timer){
    synctimer=timer*60*1000
}

function getTimer() {
    chrome.storage.local.get("timer", function (obj) {
        var timer = parseInt(obj.timer)
        if (timer && timer >= 0) {
            if (isPopupOpen()) {
                getTimerisin().value = timer
            }
            setTimerSync(timer)
        } else {
            if (isPopupOpen()) {
                getTimerisin().value = 10
            }
            setTimerSync(10)
        }
    })
}
function setTimer() {
    if (isPopupOpen()) {
        var timer = getTimerin().value
        if (timer && timer >= 0) {
            chrome.storage.local.set({ "timer": timer }, function () {
                getTimer()
                console.log("timer set")
            })
        }
    }

}

chrome.storage.onChanged.addListener(function (changes, namespace) {
    addInnerLives()

    for (key in changes) {
        var storageChange = changes[key];
        console.log('Storage key "%s" in namespace "%s" changed. ' +
            'Old value was "%s", new value is "%s".',
            key,
            namespace,
            storageChange.oldValue,
            storageChange.newValue);
        console.log("store:" + key + " o:" + storageChange.oldValue + " n:" + storageChange.newValue)
        if (key == "token") runsubs()
        if (key == "timer") getTimer()
    }

});

loginidentity();
